import { ChatInput } from "@/components/custom/chatinput";
import { PreviewMessage, ThinkingMessage } from "../../components/custom/message";
import { useScrollToBottom } from '@/components/custom/use-scroll-to-bottom';
import { useState, useEffect } from "react";
import { message } from "../../interfaces/interfaces"
import { Overview } from "@/components/custom/overview";
import { Header } from "@/components/custom/header";
import { v4 as uuidv4 } from 'uuid';
import { api, isError } from "@/lib/api";
import { toast } from "sonner";
import { useChat } from '@/context/ChatContext';

export function Chat() {
  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();
  const [messages, setMessages] = useState<message[]>([]);
  const [question, setQuestion] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { currentChatId, selectChat, refreshChats } = useChat();
  const [_error, setError] = useState<string | null>(null);
  const [_aiStatus, setAiStatus] = useState<{available: boolean; fallbackMode?: boolean}>({available: true});

  // Check AI status on component mount
  useEffect(() => {
    const checkAiStatus = async () => {
      try {
        console.log("Checking AI backend status...");
        const response = await api.checkAIStatus();

        if (response.success && response.data) {
          const aiData = response.data;
          setAiStatus({
            available: aiData.configured && aiData.status === 'ready',
            fallbackMode: !aiData.configured
          });

          if (aiData.configured) {
            toast.success("AI service connected successfully", {
              description: `Using ${aiData.provider}: ${aiData.model}`
            });
          } else {
            toast.warning("AI service not configured", {
              description: "Some features may be limited."
            });
          }
        } else {
          setAiStatus({available: false, fallbackMode: true});
          toast.warning("AI service unavailable", {
            description: "Using fallback mode with limited capabilities."
          });
        }
      } catch (error) {
        console.error("Failed to check AI status:", error);
        setAiStatus({available: false, fallbackMode: true});
        toast.error("Failed to connect to AI service");
      }
    };

    checkAiStatus();
  }, []);

  // Load messages when switching chats
  useEffect(() => {
    const load = async () => {
      if (!currentChatId) {
        setMessages([]);
        return;
      }
      const res = await api.getChat(currentChatId);
      if (res.success && res.data) {
        const msgs = res.data.messages.map((m) => ({
          id: m._id,
          role: m.role,
          content: m.content,
        })) as message[];
        setMessages(msgs);
      } else {
        toast.error('Failed to load chat');
      }
    };
    load();
  }, [currentChatId]);

  // (Messages are cleared automatically when currentChatId is null)

  async function handleSubmit(text?: string) {
    if (isLoading) return;

    const messageText = text || question;
    if (!messageText.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Add user message to UI immediately
      const userMessage = {
        content: messageText,
        role: "user",
        id: uuidv4()
      };
      setMessages(prev => [...prev, userMessage]);

      // Clear input
      setQuestion("");

      // If no current chat, create one first. IMPORTANT: do not select the chat yet.
      // Selecting immediately triggers a messages reload effect that can overwrite
      // our optimistic first user message before it's saved on the server.
      let chatId = currentChatId || null;
      if (!chatId) {
        const createResponse = await api.createChat('New Chat');
        if (createResponse.success && createResponse.data) {
          chatId = createResponse.data.chat._id;
          // Defer selectChat/refreshChats until after sendMessage completes
        } else {
          throw new Error(createResponse.error || 'Failed to create chat');
        }
      }

      // Send message to backend
  const response = await api.sendMessage(messageText, chatId as string);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get response');
      }

      const data = response.data;

      // Add AI response
      const aiMessage = {
        content: data.aiMessage.content || 'No response received',
        role: "assistant",
        id: uuidv4()
      };
      setMessages(prev => [...prev, aiMessage]);
      // Now that the first round-trip is complete, select the chat (if it was just created)
      // and refresh chats to update title inferred from first message.
      if (!currentChatId && chatId) {
        selectChat(chatId);
      }
      await refreshChats();

    } catch (error) {
      console.error('Error sending message:', error);

      // Show toast notification
      toast.error("Error sending message", {
        description: isError(error) ? error.message : 'An unexpected error occurred'
      });

      // Add error message
      const errorMessage = {
        content: `Sorry, I'm having trouble responding right now. ${isError(_error) ? _error.message : 'Please try again.'}`,
        role: "assistant",
        id: uuidv4()
      };
      setMessages(prev => [...prev, errorMessage]);

      setError(isError(_error) ? _error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
          <div className="max-w-4xl mx-auto px-4 py-8">
            {messages.length === 0 ? (
              <Overview />
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <PreviewMessage
                    key={message.id}
                    message={message}
                  />
                ))}
                {isLoading && <ThinkingMessage />}
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <ChatInput
              question={question}
              setQuestion={setQuestion}
              onSubmit={() => handleSubmit()}
              isLoading={isLoading}
            />
            <div className="mt-2 flex justify-end items-center text-xs text-muted-foreground">
              <span>Press Enter to send</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}