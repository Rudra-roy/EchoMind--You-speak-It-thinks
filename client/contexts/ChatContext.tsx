import * as React from 'react';
import { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  selectedSessionId: string | null;
  setSelectedSessionId: (sessionId: string | null) => void;
  shouldLoadSpecificSession: boolean;
  setShouldLoadSpecificSession: (should: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [shouldLoadSpecificSession, setShouldLoadSpecificSession] = useState(false);

  return (
    <ChatContext.Provider
      value={{
        selectedSessionId,
        setSelectedSessionId,
        shouldLoadSpecificSession,
        setShouldLoadSpecificSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
