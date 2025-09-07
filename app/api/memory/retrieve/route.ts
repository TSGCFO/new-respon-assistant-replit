import { NextRequest, NextResponse } from "next/server";
import { db, userMemory } from "@/lib/db";
import { getSessionId } from "@/lib/session";
import { eq, desc, and, or, like, gte, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const sessionId = await getSessionId();
    
    if (!sessionId) {
      return NextResponse.json({ memories: [] });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const minImportance = searchParams.get('minImportance');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = db.select()
      .from(userMemory)
      .where(eq(userMemory.sessionId, sessionId));

    // Apply filters
    const conditions = [eq(userMemory.sessionId, sessionId)];
    
    if (category) {
      conditions.push(eq(userMemory.category, category));
    }
    
    if (search) {
      conditions.push(
        or(
          like(userMemory.key, `%${search}%`),
          like(userMemory.value, `%${search}%`)
        )!
      );
    }
    
    if (minImportance) {
      conditions.push(gte(userMemory.importance, parseInt(minImportance)));
    }

    const memories = await db.select({
      id: userMemory.id,
      key: userMemory.key,
      value: userMemory.value,
      category: userMemory.category,
      importance: userMemory.importance,
      createdAt: userMemory.createdAt,
      updatedAt: userMemory.updatedAt,
      accessCount: userMemory.accessCount,
    })
    .from(userMemory)
    .where(and(...conditions))
    .orderBy(desc(userMemory.importance), desc(userMemory.updatedAt))
    .limit(limit);

    // Update access timestamps
    if (memories.length > 0) {
      const memoryIds = memories.map(m => m.id);
      await db.update(userMemory)
        .set({
          lastAccessedAt: new Date(),
          accessCount: sql`${userMemory.accessCount} + 1`,
        })
        .where(
          and(
            eq(userMemory.sessionId, sessionId),
            // This is a workaround - in production you'd use IN operator
            or(...memoryIds.map(id => eq(userMemory.id, id)))!
          )
        );
    }

    return NextResponse.json({ memories });
  } catch (error) {
    console.error("Error retrieving memories:", error);
    return NextResponse.json(
      { error: "Failed to retrieve memories" },
      { status: 500 }
    );
  }
}