import { db, userMemory } from "./db";
import { eq, and } from "drizzle-orm";

export interface UserPreferences {
  communication: {
    style: 'formal' | 'casual' | 'mixed';
    detail: 'concise' | 'detailed' | 'balanced';
    technicalLevel: 'beginner' | 'intermediate' | 'advanced';
  };
  workStyle: {
    approach: 'methodical' | 'experimental' | 'balanced';
    collaboration: 'solo' | 'collaborative' | 'mixed';
    pace: 'fast' | 'steady' | 'careful';
  };
  learning: {
    format: 'visual' | 'textual' | 'mixed';
    method: 'examples' | 'theory' | 'balanced';
    structure: 'step-by-step' | 'overview-first' | 'flexible';
  };
  technical: {
    languages: string[];
    frameworks: string[];
    tools: string[];
    platforms: string[];
  };
}

export class PreferenceTracker {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // Analyze message to detect preferences
  async analyzePreferences(message: string): Promise<Partial<UserPreferences>> {
    const preferences: Partial<UserPreferences> = {};
    const lowerMessage = message.toLowerCase();

    // Initialize communication preferences if any are detected
    const commPrefs: Partial<UserPreferences['communication']> = {};
    
    // Communication style detection
    if (lowerMessage.includes('please') || lowerMessage.includes('could you') || lowerMessage.includes('would you')) {
      commPrefs.style = 'formal';
    } else if (lowerMessage.includes('hey') || lowerMessage.includes('gonna') || lowerMessage.includes('wanna')) {
      commPrefs.style = 'casual';
    }

    // Detail preference detection
    if (lowerMessage.includes('brief') || lowerMessage.includes('quick') || lowerMessage.includes('summary')) {
      commPrefs.detail = 'concise';
    } else if (lowerMessage.includes('detailed') || lowerMessage.includes('explain') || lowerMessage.includes('step by step')) {
      commPrefs.detail = 'detailed';
    }

    // Technical level detection
    if (lowerMessage.includes('beginner') || lowerMessage.includes('new to') || lowerMessage.includes('explain like')) {
      commPrefs.technicalLevel = 'beginner';
    } else if (lowerMessage.includes('advanced') || lowerMessage.includes('expert') || lowerMessage.includes('deep dive')) {
      commPrefs.technicalLevel = 'advanced';
    }
    
    // Only add communication preferences if any were detected
    if (Object.keys(commPrefs).length > 0) {
      preferences.communication = commPrefs as UserPreferences['communication'];
    }

    // Work style detection
    const workPrefs: Partial<UserPreferences['workStyle']> = {};
    
    if (lowerMessage.includes('let me try') || lowerMessage.includes('experiment') || lowerMessage.includes('play around')) {
      workPrefs.approach = 'experimental';
    } else if (lowerMessage.includes('best practice') || lowerMessage.includes('correct way') || lowerMessage.includes('standard')) {
      workPrefs.approach = 'methodical';
    }
    
    if (Object.keys(workPrefs).length > 0) {
      preferences.workStyle = workPrefs as UserPreferences['workStyle'];
    }

    // Learning preference detection
    const learnPrefs: Partial<UserPreferences['learning']> = {};
    
    if (lowerMessage.includes('show me') || lowerMessage.includes('example') || lowerMessage.includes('demo')) {
      learnPrefs.method = 'examples';
    } else if (lowerMessage.includes('how does') || lowerMessage.includes('why') || lowerMessage.includes('concept')) {
      learnPrefs.method = 'theory';
    }
    
    if (Object.keys(learnPrefs).length > 0) {
      preferences.learning = learnPrefs as UserPreferences['learning'];
    }

    // Technical preferences extraction
    const techPatterns = {
      languages: /\b(python|javascript|typescript|java|c\+\+|rust|go|ruby|php|swift)\b/gi,
      frameworks: /\b(react|vue|angular|django|flask|express|spring|rails|laravel)\b/gi,
      tools: /\b(git|docker|kubernetes|aws|azure|gcp|vscode|vim|jenkins)\b/gi,
    };

    for (const [key, pattern] of Object.entries(techPatterns)) {
      const matches = message.match(pattern);
      if (matches) {
        if (!preferences.technical) preferences.technical = { languages: [], frameworks: [], tools: [], platforms: [] };
        preferences.technical[key as keyof typeof techPatterns] = [...new Set(matches.map(m => m.toLowerCase()))];
      }
    }

    return preferences;
  }

  // Save preferences to memory
  async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    for (const [category, prefs] of Object.entries(preferences)) {
      if (prefs && typeof prefs === 'object') {
        const prefString = JSON.stringify(prefs);
        const key = `preference_${category}`;
        
        try {
          // Check if preference exists
          const existing = await db.select()
            .from(userMemory)
            .where(
              and(
                eq(userMemory.sessionId, this.sessionId),
                eq(userMemory.key, key)
              )
            );

          if (existing.length > 0) {
            // Update existing preference
            await db.update(userMemory)
              .set({
                value: prefString,
                updatedAt: new Date(),
                accessCount: (existing[0].accessCount || 0) + 1,
              })
              .where(eq(userMemory.id, existing[0].id));
          } else {
            // Create new preference
            await db.insert(userMemory)
              .values({
                sessionId: this.sessionId,
                key,
                value: prefString,
                category: 'preferences',
                importance: 7,
                conversationId: null,
              });
          }
        } catch (error) {
          console.error('Failed to save preference:', error);
        }
      }
    }
  }

  // Load user preferences from memory
  async loadPreferences(): Promise<UserPreferences> {
    const defaultPreferences: UserPreferences = {
      communication: { style: 'mixed', detail: 'balanced', technicalLevel: 'intermediate' },
      workStyle: { approach: 'balanced', collaboration: 'mixed', pace: 'steady' },
      learning: { format: 'mixed', method: 'balanced', structure: 'flexible' },
      technical: { languages: [], frameworks: [], tools: [], platforms: [] },
    };

    try {
      const memories = await db.select()
        .from(userMemory)
        .where(
          and(
            eq(userMemory.sessionId, this.sessionId),
            eq(userMemory.category, 'preferences')
          )
        );

      for (const memory of memories) {
        const key = memory.key.replace('preference_', '');
        if (key in defaultPreferences) {
          try {
            const parsed = JSON.parse(memory.value);
            (defaultPreferences as any)[key] = { ...(defaultPreferences as any)[key], ...parsed };
          } catch (e) {
            console.error('Failed to parse preference:', e);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }

    return defaultPreferences;
  }

  // Build preference context string for the assistant
  async buildPreferenceContext(): Promise<string> {
    const preferences = await this.loadPreferences();
    const contextParts: string[] = ['User preferences:'];

    // Communication preferences
    if (preferences.communication) {
      contextParts.push(`- Communication: ${preferences.communication.style} style, ${preferences.communication.detail} responses, ${preferences.communication.technicalLevel} technical level`);
    }

    // Work style preferences
    if (preferences.workStyle) {
      contextParts.push(`- Work style: ${preferences.workStyle.approach} approach, ${preferences.workStyle.collaboration} work, ${preferences.workStyle.pace} pace`);
    }

    // Learning preferences
    if (preferences.learning) {
      contextParts.push(`- Learning: prefers ${preferences.learning.format} format, ${preferences.learning.method} method, ${preferences.learning.structure} structure`);
    }

    // Technical preferences
    if (preferences.technical) {
      const tech: string[] = [];
      if (preferences.technical.languages?.length > 0) {
        tech.push(`languages: ${preferences.technical.languages.join(', ')}`);
      }
      if (preferences.technical.frameworks?.length > 0) {
        tech.push(`frameworks: ${preferences.technical.frameworks.join(', ')}`);
      }
      if (preferences.technical.tools?.length > 0) {
        tech.push(`tools: ${preferences.technical.tools.join(', ')}`);
      }
      if (tech.length > 0) {
        contextParts.push(`- Technical: ${tech.join('; ')}`);
      }
    }

    return contextParts.length > 1 ? contextParts.join('\n') : '';
  }
}