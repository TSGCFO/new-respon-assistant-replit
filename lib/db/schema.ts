import { pgTable, serial, text, timestamp, integer, jsonb, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Conversations table - stores conversation metadata
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  title: text('title'),
  summary: text('summary'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastMessageAt: timestamp('last_message_at'),
  messageCount: integer('message_count').default(0),
  isActive: boolean('is_active').default(true),
}, (table) => ({
  sessionIdx: index('conversation_session_idx').on(table.sessionId),
  createdAtIdx: index('conversation_created_at_idx').on(table.createdAt),
}));

// Messages table - stores individual messages
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user', 'assistant', 'system'
  content: jsonb('content').notNull(), // Store the full content structure
  metadata: jsonb('metadata'), // Additional metadata like tool calls, annotations
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('message_conversation_idx').on(table.conversationId),
  createdAtIdx: index('message_created_at_idx').on(table.createdAt),
}));

// User memory table - stores important user information
export const userMemory = pgTable('user_memory', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  key: text('key').notNull(), // Memory identifier
  value: text('value').notNull(), // The actual memory content
  category: text('category'), // 'preference', 'fact', 'goal', 'context', etc.
  importance: integer('importance').default(1), // 1-10 scale
  conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at'),
  accessCount: integer('access_count').default(0),
}, (table) => ({
  sessionIdx: index('memory_session_idx').on(table.sessionId),
  categoryIdx: index('memory_category_idx').on(table.category),
  sessionKeyUnique: uniqueIndex('memory_session_key_unique').on(table.sessionId, table.key),
}));

// Context references - links memories to conversations
export const contextReferences = pgTable('context_references', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  memoryId: integer('memory_id').notNull().references(() => userMemory.id, { onDelete: 'cascade' }),
  relevanceScore: integer('relevance_score').default(50), // 0-100 scale
  usedAt: timestamp('used_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('context_conversation_idx').on(table.conversationId),
  memoryIdx: index('context_memory_idx').on(table.memoryId),
}));

// Define relations
export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
  contextReferences: many(contextReferences),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const userMemoryRelations = relations(userMemory, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [userMemory.conversationId],
    references: [conversations.id],
  }),
  contextReferences: many(contextReferences),
}));

export const contextReferencesRelations = relations(contextReferences, ({ one }) => ({
  conversation: one(conversations, {
    fields: [contextReferences.conversationId],
    references: [conversations.id],
  }),
  memory: one(userMemory, {
    fields: [contextReferences.memoryId],
    references: [userMemory.id],
  }),
}));