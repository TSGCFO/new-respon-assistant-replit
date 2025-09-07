import { NextRequest, NextResponse } from "next/server";
import { db, conversations, messages } from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";
import { VectorMemoryStore } from "@/lib/memory-vector-store";
import { eq, desc } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOrCreateSessionId();
    const { conversationId, title, messagesData } = await request.json();
    
    // Initialize vector memory store for summarization
    const memoryStore = new VectorMemoryStore(sessionId, conversationId);

    // Generate summary if conversation has enough messages
    let summary = null;
    if (messagesData && messagesData.length > 4) {
      summary = await memoryStore.summarizeConversation(messagesData);
    }

    // If conversationId is provided, update existing conversation
    if (conversationId) {
      // Update conversation with summary if available
      const updateData: any = {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        messageCount: messagesData.length,
      };
      
      if (summary) {
        updateData.summary = summary;
      }
      
      await db.update(conversations)
        .set(updateData)
        .where(eq(conversations.id, conversationId));

      // Delete old messages and insert new ones (simpler than diffing)
      await db.delete(messages).where(eq(messages.conversationId, conversationId));
      
      if (messagesData && messagesData.length > 0) {
        const messagesToInsert = messagesData.map((msg: any) => ({
          conversationId,
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata || null,
        }));
        
        await db.insert(messages).values(messagesToInsert);
      }

      return NextResponse.json({ id: conversationId, success: true });
    } else {
      // Create new conversation with summary if available
      const [newConversation] = await db.insert(conversations)
        .values({
          sessionId,
          title: title || 'New Conversation',
          summary: summary,
          lastMessageAt: new Date(),
          messageCount: messagesData.length,
        })
        .returning();

      // Insert messages
      if (messagesData && messagesData.length > 0) {
        const messagesToInsert = messagesData.map((msg: any) => ({
          conversationId: newConversation.id,
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata || null,
        }));
        
        await db.insert(messages).values(messagesToInsert);
      }

      return NextResponse.json({ id: newConversation.id, success: true });
    }
  } catch (error) {
    console.error("Error saving conversation:", error);
    return NextResponse.json(
      { error: "Failed to save conversation" },
      { status: 500 }
    );
  }
}