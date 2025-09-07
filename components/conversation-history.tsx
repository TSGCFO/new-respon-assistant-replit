"use client";
import React, { useEffect, useState } from "react";
import useConversationStore from "@/stores/useConversationStore";
import { Button } from "./ui/button";
import { ChevronRight, MessageSquare, Plus, Trash2, Clock } from "lucide-react";

export default function ConversationHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    conversationsList,
    currentConversationId,
    loadConversationsList,
    loadConversation,
    resetConversation,
  } = useConversationStore();

  useEffect(() => {
    loadConversationsList();
    // Refresh list every 30 seconds
    const interval = setInterval(() => {
      loadConversationsList();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadConversationsList]);

  const handleLoadConversation = async (id: number) => {
    await loadConversation(id);
    setIsOpen(false);
  };

  const handleNewConversation = () => {
    resetConversation();
    setIsOpen(false);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      try {
        const response = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          loadConversationsList();
          if (currentConversationId === id) {
            resetConversation();
          }
        }
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 48) {
      return 'Yesterday';
    } else {
      return d.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-0 top-20 z-40 bg-white border border-r-0 rounded-r-lg px-2 py-3 shadow-md hover:shadow-lg transition-all duration-200 hover:translate-x-1"
        aria-label="Toggle conversation history"
      >
        <ChevronRight 
          className={`w-5 h-5 text-zinc-600 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-white border-r shadow-xl z-30 transition-all duration-300 ${
          isOpen ? 'w-80' : 'w-0'
        } overflow-hidden`}
      >
        <div className="w-80 h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-800">Conversations</h2>
              <Button
                onClick={handleNewConversation}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {conversationsList.length === 0 ? (
              <div className="p-4 text-center text-zinc-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-zinc-300" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Start a new conversation to see it here</p>
              </div>
            ) : (
              <div className="py-2">
                {conversationsList.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleLoadConversation(conv.id)}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-l-2 transition-all ${
                      currentConversationId === conv.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-zinc-800 truncate">
                          {conv.title || 'Untitled Conversation'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <p className="text-xs text-zinc-500">
                            {formatDate(conv.updatedAt)}
                          </p>
                          {conv.messageCount && (
                            <>
                              <span className="text-xs text-zinc-400">•</span>
                              <p className="text-xs text-zinc-500">
                                {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="ml-2 p-1 text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete conversation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t bg-gray-50">
            <p className="text-xs text-zinc-500 text-center">
              Conversations are saved automatically
            </p>
          </div>
        </div>
      </div>
    </>
  );
}