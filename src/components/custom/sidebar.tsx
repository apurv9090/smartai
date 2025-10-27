import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, MessageCircle, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@/context/ChatContext';
import { toast } from 'sonner';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteChat?: (chatId: string) => void;
  onStartNewChat?: () => void; // notify chat page to clear local state
}

export function Sidebar({ isOpen, onClose, onDeleteChat, onStartNewChat }: SidebarProps) {
  const { chats, currentChatId, selectChat, startNewChat, deleteChat, refreshChats } = useChat();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    // Ensure chats are loaded when sidebar opens
    if (isOpen) refreshChats();
    // We intentionally omit refreshChats to avoid reloading on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const createNewChat = () => {
    startNewChat();
    onStartNewChat?.();
    toast.success('New chat started');
  };

  const onSelectChat = (chatId: string) => {
    selectChat(chatId);
    onClose();
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    try {
      setBusy(chatId);
      const ok = await deleteChat(chatId);
      if (ok) {
        toast.success('Chat deleted');
        onDeleteChat?.(chatId);
      } else {
        toast.error('Failed to delete chat');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 w-64 bg-background border-r transform transition-transform duration-200 ease-in-out z-50",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex flex-col h-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Chats</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Button
          onClick={createNewChat}
          className="mb-4 flex items-center gap-2"
          variant="outline"
        >
          <PlusCircle className="h-4 w-4" />
          New Chat
        </Button>

        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {chats.map((chat) => (
              <div key={chat._id} className="flex items-center gap-2">
                <Button
                  variant={currentChatId === chat._id ? "secondary" : "ghost"}
                  className="flex-1 justify-start gap-2"
                  onClick={() => onSelectChat(chat._id)}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="truncate text-left">
                    {chat.title}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={(e) => handleDeleteChat(e, chat._id)}
                  disabled={busy === chat._id}
                  aria-label={`Delete chat ${chat.title}`}
                  title="Delete chat"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
