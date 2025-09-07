import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Item } from "@/lib/assistant";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { INITIAL_MESSAGE } from "@/config/constants";

interface ConversationState {
  // Current conversation ID from database
  currentConversationId: number | null;
  // Items displayed in the chat
  chatMessages: Item[];
  // Items sent to the Responses API
  conversationItems: any[];
  // Whether we are waiting for the assistant response
  isAssistantLoading: boolean;
  // Conversation history list
  conversationsList: any[];
  // Flag for auto-save
  autoSaveEnabled: boolean;

  setCurrentConversationId: (id: number | null) => void;
  setChatMessages: (items: Item[]) => void;
  setConversationItems: (messages: any[]) => void;
  addChatMessage: (item: Item) => void;
  addConversationItem: (message: ChatCompletionMessageParam) => void;
  setAssistantLoading: (loading: boolean) => void;
  setConversationsList: (conversations: any[]) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  rawSet: (state: any) => void;
  resetConversation: () => void;
  saveConversation: () => Promise<void>;
  loadConversation: (id: number) => Promise<void>;
  loadConversationsList: () => Promise<void>;
}

const useConversationStore = create<ConversationState>((set, get) => ({
  currentConversationId: null,
  chatMessages: [
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: INITIAL_MESSAGE }],
    },
  ],
  conversationItems: [],
  isAssistantLoading: false,
  conversationsList: [],
  autoSaveEnabled: true,
  
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setChatMessages: (items) => {
    set({ chatMessages: items });
    // Auto-save if enabled
    if (get().autoSaveEnabled && items.length > 1) {
      get().saveConversation();
    }
  },
  setConversationItems: (messages) => set({ conversationItems: messages }),
  addChatMessage: (item) => {
    set((state) => ({ chatMessages: [...state.chatMessages, item] }));
    // Auto-save if enabled
    if (get().autoSaveEnabled) {
      get().saveConversation();
    }
  },
  addConversationItem: (message) =>
    set((state) => ({
      conversationItems: [...state.conversationItems, message],
    })),
  setAssistantLoading: (loading) => set({ isAssistantLoading: loading }),
  setConversationsList: (conversations) => set({ conversationsList: conversations }),
  setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
  rawSet: set,
  
  resetConversation: () => {
    set(() => ({
      currentConversationId: null,
      chatMessages: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: INITIAL_MESSAGE }],
        },
      ],
      conversationItems: [],
    }));
  },
  
  saveConversation: async () => {
    const state = get();
    if (state.chatMessages.length <= 1) return; // Don't save if only initial message
    
    try {
      // Generate title from first user message if not set
      const firstUserMessage = state.chatMessages.find(m => m.type === 'message' && m.role === 'user');
      const title = (firstUserMessage && firstUserMessage.type === 'message' && firstUserMessage.content?.[0]?.text?.substring(0, 100)) || 'New Conversation';
      
      // Prepare messages data
      const messagesData = state.chatMessages
        .filter(m => m.type === 'message')
        .map(m => ({
          role: m.role,
          content: m.content,
          metadata: null,
        }));
      
      const response = await fetch('/api/conversations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: state.currentConversationId,
          title,
          messagesData,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (!state.currentConversationId) {
          set({ currentConversationId: data.id });
        }
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  },
  
  loadConversation: async (id: number) => {
    try {
      const response = await fetch(`/api/conversations/${id}`);
      if (response.ok) {
        const { conversation, messages } = await response.json();
        
        // Convert database messages to chat format
        const chatMessages: Item[] = messages.map((msg: any) => ({
          type: 'message',
          role: msg.role,
          content: msg.content,
        }));
        
        set({
          currentConversationId: id,
          chatMessages,
          conversationItems: [], // Clear for new conversation
        });
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  },
  
  loadConversationsList: async () => {
    try {
      const response = await fetch('/api/conversations/list');
      if (response.ok) {
        const { conversations } = await response.json();
        set({ conversationsList: conversations });
      }
    } catch (error) {
      console.error('Failed to load conversations list:', error);
    }
  },
}));

export default useConversationStore;
