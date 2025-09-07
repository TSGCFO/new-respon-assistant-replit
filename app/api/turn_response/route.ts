import { getDeveloperPrompt, MODEL } from "@/config/constants";
import { getTools } from "@/lib/tools/tools";
import { getOrCreateSessionId } from "@/lib/session";
import { VectorMemoryStore } from "@/lib/memory-vector-store";
import { PreferenceTracker } from "@/lib/preference-tracker";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const sessionId = await getOrCreateSessionId();
    const { messages, toolsState } = await request.json();

    // Initialize memory and preference systems
    const memoryStore = new VectorMemoryStore(sessionId);
    const preferenceTracker = new PreferenceTracker(sessionId);

    // Extract memories from the latest user message if present
    const latestUserMessage = messages
      .filter((m: any) => m.role === 'user')
      .pop();
    
    let contextEnhancedInstructions = getDeveloperPrompt();
    
    if (latestUserMessage) {
      // Extract and store memories
      await memoryStore.extractAndStoreMemory(
        latestUserMessage.content,
        'user',
        7 // Default importance for conversation messages
      );

      // Analyze and save preferences
      const detectedPreferences = await preferenceTracker.analyzePreferences(latestUserMessage.content);
      if (Object.keys(detectedPreferences).length > 0) {
        await preferenceTracker.savePreferences(detectedPreferences);
      }

      // Build comprehensive context
      const memoryContext = await memoryStore.buildContextForQuery(latestUserMessage.content);
      const preferenceContext = await preferenceTracker.buildPreferenceContext();
      
      // Combine all context sources
      const contexts: string[] = [getDeveloperPrompt()];
      if (memoryContext) contexts.push(memoryContext);
      if (preferenceContext) contexts.push(preferenceContext);
      
      contextEnhancedInstructions = contexts.join('\n\n');
    }

    const tools = await getTools(toolsState);

    console.log("Tools:", tools);
    console.log("Received messages:", messages);

    const openai = new OpenAI();

    const events = await openai.responses.create({
      model: MODEL,
      input: messages,
      instructions: contextEnhancedInstructions,
      tools,
      stream: true,
      parallel_tool_calls: false,
    });

    // Create a ReadableStream that emits SSE data
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of events) {
            // Sending all events to the client
            const data = JSON.stringify({
              event: event.type,
              data: event,
            });
            controller.enqueue(`data: ${data}\n\n`);
          }
          // End of stream
          controller.close();
        } catch (error) {
          console.error("Error in streaming loop:", error);
          controller.error(error);
        }
      },
    });

    // Return the ReadableStream as SSE
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
