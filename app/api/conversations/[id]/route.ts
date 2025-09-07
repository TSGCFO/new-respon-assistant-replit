import { NextRequest, NextResponse } from "next/server";
import { db, conversations, messages } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = await getSessionId();
    const conversationId = parseInt(params.id);
    
    if (!sessionId || isNaN(conversationId)) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Get conversation details
    const [conversation] = await db.select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.sessionId, sessionId)
        )
      );

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Get messages for this conversation
    const conversationMessages = await db.select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));

    return NextResponse.json({
      conversation,
      messages: conversationMessages
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = await getSessionId();
    const conversationId = parseInt(params.id);
    
    if (!sessionId || isNaN(conversationId)) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    // Delete conversation (messages will cascade delete)
    await db.delete(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.sessionId, sessionId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}