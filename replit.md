# Overview

This is a NextJS conversational AI assistant application that serves as a starter template for building customized chatbots using OpenAI's Responses API. The application provides a comprehensive chat interface with multi-turn conversation handling, streaming responses, and tool integration capabilities. It features persistent conversation storage, user memory management, and integration with various external services including Google Calendar and Gmail.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 15 with React 18 using TypeScript and App Router
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and animations
- **State Management**: Zustand for client-side state with persistence middleware
- **Component Structure**: Modular component design with separate concerns for chat, tools, and configuration

## Backend Architecture
- **API Routes**: Next.js API routes handling conversation management, tool integration, and external service connections
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Session Management**: Cookie-based session handling with in-memory token storage for OAuth
- **Memory System**: Dual approach with structured key-value storage and vector embeddings for contextual retrieval

## Core Features
- **Multi-turn Conversations**: Persistent conversation history with database storage
- **Streaming Responses**: Real-time message streaming from OpenAI API
- **Tool Integration**: Support for web search, file search, function calling, code interpreter, and MCP servers
- **Memory Management**: Automatic extraction and storage of user preferences and context
- **File Management**: Vector store creation and file upload for knowledge base search

## Authentication & Authorization
- **OAuth Integration**: Google OAuth2 with PKCE for secure authentication
- **Session Handling**: Secure cookie-based sessions with refresh token management
- **Connector Authorization**: Token-based authorization for Google services integration

## Tool System
- **Web Search**: Configurable web search with location-based results
- **File Search**: Vector store-based document search and retrieval
- **Function Calling**: Custom function definitions with parameter validation
- **Code Interpreter**: Sandboxed code execution environment
- **MCP Servers**: Model Context Protocol server integration with approval workflows

## Data Models
- **Conversations**: Metadata and summary storage for chat sessions
- **Messages**: Individual message storage with role-based content structure
- **User Memory**: Categorized storage of user preferences and important information
- **Vector Storage**: Embeddings-based similarity search for contextual memory retrieval

# External Dependencies

## Core Services
- **OpenAI API**: Primary AI service for responses, embeddings, and tool integration
- **PostgreSQL**: Primary database for persistent data storage

## Authentication & Social
- **Google OAuth2**: Authentication and authorization for Google services
- **Google Calendar API**: Calendar events and scheduling integration
- **Google Gmail API**: Email search and content access

## Development Tools
- **Drizzle ORM**: Type-safe database operations and schema management
- **OpenID Client**: OAuth2/OpenID Connect implementation
- **React Dropzone**: File upload and drag-drop functionality

## UI & Presentation
- **React Markdown**: Markdown rendering for message content
- **React Syntax Highlighter**: Code syntax highlighting
- **Highlight.js**: Additional syntax highlighting support
- **KaTeX**: Mathematical notation rendering
- **Recharts**: Data visualization and charting
- **Lucide React**: Icon library for UI components

## Utility Libraries
- **Zod**: Runtime type validation and schema definition
- **Partial JSON**: JSON parsing for streaming responses
- **Class Variance Authority**: Component variant management
- **Tailwind Merge**: CSS class merging utility