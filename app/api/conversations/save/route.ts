import { NextRequest, NextResponse } from "next/server";
import { db, conversations, messages } from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";
import { eq, desc } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOrCreateSessionId();
    const { conversationId, title, messagesData } = await request.json();

    // If conversationId is provided, update existing conversation
    if (conversationId) {
      // Update conversation
      await db.update(conversations)
        .set({
          updatedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: messagesData.length,
        })
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
      // Create new conversation
      const [newConversation] = await db.insert(conversations)
        .values({
          sessionId,
          title: title || 'New Conversation',
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