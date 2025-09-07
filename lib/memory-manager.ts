// Memory management utilities for extracting and storing important information
import { db, userMemory } from "./db";
import { eq, and } from "drizzle-orm";

export type MemoryCategory = 
  | 'personal_info'    // Name, age, location, etc.
  | 'preferences'      // Likes, dislikes, preferred ways of working
  | 'goals'           // What the user wants to achieve
  | 'context'         // Current projects, situations
  | 'facts'           // Specific facts the user has shared
  | 'relationships'   // People they've mentioned
  | 'technical'       // Technical preferences, stack choices
  | 'general';        // Everything else

export interface ExtractedMemory {
  key: string;
  value: string;
  category: MemoryCategory;
  importance: number; // 1-10 scale
}

export class MemoryManager {
  private sessionId: string;
  private conversationId?: number;

  constructor(sessionId: string, conversationId?: number) {
    this.sessionId = sessionId;
    this.conversationId = conversationId;
  }

  // Extract important information from a message
  async extractMemories(message: string, role: 'user' | 'assistant'): Promise<ExtractedMemory[]> {
    if (role !== 'user') return []; // Only extract from user messages
    
    const memories: ExtractedMemory[] = [];
    
    // Personal information patterns
    const namePattern = /my name is (\w+)/i;
    const nameMatch = message.match(namePattern);
    if (nameMatch) {
      memories.push({
        key: 'user_name',
        value: nameMatch[1],
        category: 'personal_info',
        importance: 9,
      });
    }

    // Preference patterns
    const preferencePatterns = [
      /I prefer (\w+)/i,
      /I like (\w+)/i,
      /I always (\w+)/i,
      /I usually (\w+)/i,
    ];
    
    for (const pattern of preferencePatterns) {
      const match = message.match(pattern);
      if (match) {
        memories.push({
          key: `preference_${Date.now()}`,
          value: match[0],
          category: 'preferences',
          importance: 6,
        });
      }
    }

    // Goal patterns
    const goalPatterns = [
      /I want to (\w+)/i,
      /I'm trying to (\w+)/i,
      /my goal is (\w+)/i,
      /I need to (\w+)/i,
    ];
    
    for (const pattern of goalPatterns) {
      const match = message.match(pattern);
      if (match) {
        memories.push({
          key: `goal_${Date.now()}`,
          value: match[0],
          category: 'goals',
          importance: 7,
        });
      }
    }

    // Work/Project context
    if (message.toLowerCase().includes('working on') || 
        message.toLowerCase().includes('project') ||
        message.toLowerCase().includes('building')) {
      memories.push({
        key: `context_${Date.now()}`,
        value: message.substring(0, 200),
        category: 'context',
        importance: 5,
      });
    }

    return memories;
  }

  // Save memories to database
  async saveMemories(memories: ExtractedMemory[]): Promise<void> {
    for (const memory of memories) {
      try {
        // Check if similar memory exists
        const existing = await db.select()
          .from(userMemory)
          .where(
            and(
              eq(userMemory.sessionId, this.sessionId),
              eq(userMemory.key, memory.key)
            )
          );

        if (existing.length > 0) {
          // Update existing memory
          await db.update(userMemory)
            .set({
              value: memory.value,
              importance: memory.importance,
              updatedAt: new Date(),
              accessCount: (existing[0].accessCount || 0) + 1,
            })
            .where(eq(userMemory.id, existing[0].id));
        } else {
          // Create new memory
          await db.insert(userMemory)
            .values({
              sessionId: this.sessionId,
              key: memory.key,
              value: memory.value,
              category: memory.category,
              importance: memory.importance,
              conversationId: this.conversationId,
            });
        }
      } catch (error) {
        console.error('Failed to save memory:', error);
      }
    }
  }

  // Retrieve relevant memories for context
  async getRelevantMemories(query?: string, limit: number = 10): Promise<any[]> {
    try {
      const memories = await db.select()
        .from(userMemory)
        .where(eq(userMemory.sessionId, this.sessionId))
        .orderBy(userMemory.importance)
        .limit(limit);
      
      return memories;
    } catch (error) {
      console.error('Failed to retrieve memories:', error);
      return [];
    }
  }

  // Build context string from memories
  async buildContextString(): Promise<string> {
    const memories = await this.getRelevantMemories();
    
    if (memories.length === 0) {
      return '';
    }

    const contextParts: string[] = ['Based on our previous conversations:'];
    
    // Group memories by category
    const grouped: { [key: string]: any[] } = {};
    for (const memory of memories) {
      const category = memory.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(memory);
    }

    // Format memories by category
    if (grouped.personal_info) {
      const infos = grouped.personal_info.map(m => m.value).join(', ');
      contextParts.push(`- User information: ${infos}`);
    }
    
    if (grouped.preferences) {
      const prefs = grouped.preferences.map(m => m.value).join('; ');
      contextParts.push(`- Preferences: ${prefs}`);
    }
    
    if (grouped.goals) {
      const goals = grouped.goals.map(m => m.value).join('; ');
      contextParts.push(`- Goals: ${goals}`);
    }
    
    if (grouped.context) {
      const contexts = grouped.context.slice(0, 3).map(m => m.value).join('; ');
      contextParts.push(`- Current context: ${contexts}`);
    }

    return contextParts.join('\n');
  }
}