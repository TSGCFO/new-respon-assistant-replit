import OpenAI from "openai";
import { db, userMemory, conversations, messages } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VectorMemory {
  id: number;
  content: string;
  embedding?: number[];
  metadata: {
    sessionId: string;
    category: string;
    importance: number;
    timestamp: Date;
    conversationId?: number;
  };
}

export class VectorMemoryStore {
  private sessionId: string;
  private conversationId?: number;

  constructor(sessionId: string, conversationId?: number) {
    this.sessionId = sessionId;
    this.conversationId = conversationId;
  }

  // Generate embedding for text
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      return [];
    }
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }

  // Extract and store important information from conversations
  async extractAndStoreMemory(
    messageContent: string,
    role: 'user' | 'assistant',
    baseImportance: number = 5
  ): Promise<void> {
    if (role !== 'user') return; // Focus on user messages for memory extraction

    // Use GPT to extract important information with priority levels
    try {
      const extractionPrompt = `
        Extract important information from this message that should be remembered for future conversations.
        
        Categorize by priority:
        HIGH (8-10): Names, location, age, occupation, company, contact info
        MEDIUM (6-8): Preferences, goals, projects, challenges, technical choices
        LOW (4-6): Context, relationships, tools, historical info
        
        Message: "${messageContent}"
        
        Format response as JSON:
        {
          "memories": [
            {"content": "extracted info", "category": "personal_info|preferences|goals|context|technical", "importance": 1-10}
          ]
        }
        
        If nothing important, respond with: {"memories": []}
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You extract and categorize important user information for memory storage. Always respond with valid JSON." },
          { role: "user", content: extractionPrompt }
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{"memories": []}');
      
      // Store each extracted memory with its priority
      for (const memory of result.memories || []) {
        if (memory.content && memory.content.length > 0) {
          // Generate embedding for semantic search
          const embedding = await this.generateEmbedding(memory.content);
          
          // Store in database with proper importance level
          await db.insert(userMemory).values({
            sessionId: this.sessionId,
            key: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            value: memory.content,
            category: memory.category || this.categorizeMemory(memory.content),
            importance: memory.importance || baseImportance,
            conversationId: this.conversationId,
          });
        }
      }
    } catch (error) {
      console.error("Failed to extract memory:", error);
    }
  }

  // Categorize memory based on content
  private categorizeMemory(content: string): string {
    const lower = content.toLowerCase();
    
    if (lower.includes('name') || lower.includes('age') || lower.includes('location')) {
      return 'personal_info';
    } else if (lower.includes('prefer') || lower.includes('like') || lower.includes('favorite')) {
      return 'preferences';
    } else if (lower.includes('goal') || lower.includes('want') || lower.includes('plan')) {
      return 'goals';
    } else if (lower.includes('work') || lower.includes('project') || lower.includes('building')) {
      return 'context';
    } else if (lower.includes('using') || lower.includes('framework') || lower.includes('language')) {
      return 'technical';
    } else {
      return 'general';
    }
  }

  // Retrieve relevant memories based on current context
  async getRelevantMemories(
    queryText: string,
    limit: number = 5,
    minImportance: number = 3
  ): Promise<any[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Get all memories for this session
      const memories = await db.select()
        .from(userMemory)
        .where(
          and(
            eq(userMemory.sessionId, this.sessionId),
            gte(userMemory.importance, minImportance)
          )
        )
        .orderBy(desc(userMemory.importance), desc(userMemory.updatedAt));
      
      // Since we don't have embeddings stored in the DB yet, 
      // we'll generate them on the fly for similarity comparison
      // In production, these would be pre-computed and stored
      const memoriesWithScores = await Promise.all(
        memories.map(async (memory) => {
          const memoryEmbedding = await this.generateEmbedding(memory.value);
          const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding);
          return {
            ...memory,
            relevanceScore: similarity,
          };
        })
      );
      
      // Sort by relevance and return top results
      memoriesWithScores.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      // Update access counts for retrieved memories
      const topMemories = memoriesWithScores.slice(0, limit);
      for (const memory of topMemories) {
        await db.update(userMemory)
          .set({
            lastAccessedAt: new Date(),
            accessCount: sql`${userMemory.accessCount} + 1`,
          })
          .where(eq(userMemory.id, memory.id));
      }
      
      return topMemories;
    } catch (error) {
      console.error("Failed to retrieve relevant memories:", error);
      return [];
    }
  }

  // Build context string from relevant memories
  async buildContextForQuery(query: string): Promise<string> {
    const memories = await this.getRelevantMemories(query);
    
    if (memories.length === 0) {
      return '';
    }

    const contextParts: string[] = ['Relevant context from previous conversations:'];
    
    // Only include highly relevant memories (score > 0.7)
    const relevantMemories = memories.filter((m: any) => m.relevanceScore > 0.7);
    
    if (relevantMemories.length === 0) {
      return '';
    }
    
    // Group by category for better organization
    const grouped: { [key: string]: any[] } = {};
    for (const memory of relevantMemories) {
      const category = memory.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(memory);
    }
    
    // Format memories with relevance considered
    for (const [category, mems] of Object.entries(grouped)) {
      const formattedCategory = category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      const values = mems.map(m => m.value).join('; ');
      contextParts.push(`- ${formattedCategory}: ${values}`);
    }
    
    return contextParts.join('\n');
  }

  // Search conversation history semantically
  async searchConversationHistory(
    query: string,
    limit: number = 5
  ): Promise<any[]> {
    try {
      // Get all conversations for this session
      const allConversations = await db.select()
        .from(conversations)
        .where(eq(conversations.sessionId, this.sessionId))
        .orderBy(desc(conversations.updatedAt));
      
      // Generate embedding for search query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Score each conversation based on title/summary similarity
      const scoredConversations = await Promise.all(
        allConversations.map(async (conv) => {
          const textToEmbed = `${conv.title || ''} ${conv.summary || ''}`;
          const convEmbedding = await this.generateEmbedding(textToEmbed);
          const similarity = this.cosineSimilarity(queryEmbedding, convEmbedding);
          
          return {
            ...conv,
            relevanceScore: similarity,
          };
        })
      );
      
      // Sort by relevance and return top results
      scoredConversations.sort((a, b) => b.relevanceScore - a.relevanceScore);
      return scoredConversations.slice(0, limit);
    } catch (error) {
      console.error("Failed to search conversation history:", error);
      return [];
    }
  }

  // Summarize conversation for long-term memory
  async summarizeConversation(conversationMessages: any[]): Promise<string> {
    try {
      // Prepare messages for summarization
      const messageText = conversationMessages
        .filter(m => m.type === 'message')
        .map(m => `${m.role}: ${m.content?.[0]?.text || ''}`)
        .join('\n');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Summarize this conversation, highlighting key topics, decisions, and important information shared. Keep it concise (max 200 words)."
          },
          { role: "user", content: messageText }
        ],
        temperature: 0.5,
        max_tokens: 250,
      });
      
      return response.choices[0].message.content || '';
    } catch (error) {
      console.error("Failed to summarize conversation:", error);
      return '';
    }
  }
}