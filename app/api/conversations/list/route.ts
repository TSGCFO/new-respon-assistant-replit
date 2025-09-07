import { NextRequest, NextResponse } from "next/server";
import { db, conversations } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const sessionId = await getSessionId();
    
    if (!sessionId) {
      return NextResponse.json({ conversations: [] });
    }

    // Get all conversations for this session
    const userConversations = await db.select({
      id: conversations.id,
      title: conversations.title,
      summary: conversations.summary,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      lastMessageAt: conversations.lastMessageAt,
      messageCount: conversations.messageCount,
    })
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);

    return NextResponse.json({ conversations: userConversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}