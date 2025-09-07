import { NextRequest, NextResponse } from "next/server";
import { db, userMemory } from "@/lib/db";
import { getOrCreateSessionId } from "@/lib/session";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOrCreateSessionId();
    const { key, value, category, importance, conversationId } = await request.json();

    // Check if memory with this key already exists for this session
    const [existingMemory] = await db.select()
      .from(userMemory)
      .where(
        and(
          eq(userMemory.sessionId, sessionId),
          eq(userMemory.key, key)
        )
      );

    if (existingMemory) {
      // Update existing memory
      await db.update(userMemory)
        .set({
          value,
          category: category || existingMemory.category,
          importance: importance || existingMemory.importance,
          updatedAt: new Date(),
          accessCount: (existingMemory.accessCount || 0) + 1,
          lastAccessedAt: new Date(),
        })
        .where(eq(userMemory.id, existingMemory.id));

      return NextResponse.json({ 
        id: existingMemory.id, 
        updated: true,
        success: true 
      });
    } else {
      // Create new memory
      const [newMemory] = await db.insert(userMemory)
        .values({
          sessionId,
          key,
          value,
          category: category || 'general',
          importance: importance || 5,
          conversationId: conversationId || null,
        })
        .returning();

      return NextResponse.json({ 
        id: newMemory.id, 
        created: true,
        success: true 
      });
    }
  } catch (error) {
    console.error("Error saving memory:", error);
    return NextResponse.json(
      { error: "Failed to save memory" },
      { status: 500 }
    );
  }
}