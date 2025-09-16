import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { Chat, GetChatsResponse } from '@/lib/api';

interface ChatContextType {
  chats: Chat[];
  loading: boolean;
  error: string | null;
  currentChatId: string | null;
  selectChat: (chatId: string | null) => void;
  refreshChats: () => Promise<void>;
  startNewChat: () => void;
  deleteChat: (chatId: string) => Promise<boolean>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const loadChats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getChats();
      if (res.success && res.data) {
        const data = res.data as GetChatsResponse;
        setChats(data.chats);
        // Keep currentChatId if still present, else clear
        if (currentChatId && !data.chats.find(c => c._id === currentChatId)) {
          setCurrentChatId(null);
        }
      } else {
        setError(res.error || 'Failed to fetch chats');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch chats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  const value = useMemo<ChatContextType>(() => ({
    chats,
    loading,
    error,
    currentChatId,
    selectChat: (chatId: string | null) => setCurrentChatId(chatId),
    refreshChats: loadChats,
    startNewChat: () => setCurrentChatId(null),
    deleteChat: async (chatId: string) => {
      try {
        const res = await api.deleteChat(chatId);
        if (res.success) {
          // Optimistic update
          setChats(prev => prev.filter(c => c._id !== chatId));
          if (currentChatId === chatId) setCurrentChatId(null);
          return true;
        }
        setError(res.error || 'Failed to delete chat');
        return false;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete chat');
        return false;
      }
    }
  }), [chats, loading, error, currentChatId]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
