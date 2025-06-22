// streaming-chat.ts
export interface StreamingChatRequest {
  token: string
  message: string
  repository_id: string
  chat_id?: string
  conversation_id?: string
  provider?: string
  model?: string
  temperature?: number
  max_tokens?: number
  include_full_context?: boolean
  context_search_query?: string
}

export interface StreamingChunk {
  type: "token" | "metadata" | "error" | "done"
  content?: string
  chat_id?: string
  conversation_id?: string
  message?: string
  delta?: {
    content?: string
  }
}

export async function createStreamingChatRequest(request: StreamingChatRequest): Promise<Response> {
  // Create form data as expected by the API
  const formData = new FormData()

  // Add all required fields
  formData.append("token", request.token)
  formData.append("message", request.message)
  formData.append("repository_id", request.repository_id)

  // Add optional fields
  if (request.chat_id) formData.append("chat_id", request.chat_id)
  if (request.conversation_id) formData.append("conversation_id", request.conversation_id)
  if (request.provider) formData.append("provider", request.provider)
  if (request.model) formData.append("model", request.model)
  if (request.temperature !== undefined) formData.append("temperature", request.temperature.toString())
  if (request.max_tokens) formData.append("max_tokens", request.max_tokens.toString())
  if (request.include_full_context !== undefined)
    formData.append("include_full_context", request.include_full_context.toString())
  if (request.context_search_query) formData.append("context_search_query", request.context_search_query)

  // Make the request to your backend
  const response = await fetch("http://0.0.0.0:8003/api/backend-chat/chat/stream", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response
}

export async function* parseStreamingResponse(response: Response): AsyncGenerator<StreamingChunk, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream available");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep the last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        try {
          const data = JSON.parse(trimmedLine);
          
          // Map backend events to our StreamingChunk format
          switch (data.event) {
            case "token":
              // First token in the stream contains metadata
              if (data.chat_id && data.conversation_id) {
                yield {
                  type: "metadata",
                  chat_id: data.chat_id,
                  conversation_id: data.conversation_id,
                };
              }
              
              // Always yield the token content
              if (data.token) {
                yield {
                  type: "token",
                  content: data.token,
                };
              }
              break;
              
            case "complete":
              yield { type: "done" };
              break;
              
            case "error":
              yield {
                type: "error",
                message: data.error || "Unknown error",
              };
              break;
              
            default:
              console.warn("Unknown event type:", data.event);
          }
        } catch (parseError) {
          console.warn("Failed to parse JSON chunk:", trimmedLine, parseError);
          yield {
            type: "error",
            message: `Parse error: ${parseError instanceof Error ? parseError.message : "Unknown"}`,
          };
        }
      }
    }

    // Process any remaining data
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        if (data.event === "token" && data.token) {
          yield {
            type: "token",
            content: data.token,
          };
        }
      } catch (e) {
        console.warn("Failed to parse final buffer:", buffer);
      }
    }
    
    yield { type: "done" };
  } finally {
    reader.releaseLock();
  }
}