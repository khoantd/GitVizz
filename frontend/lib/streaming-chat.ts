// streaming-chat.ts
import type { DailyUsage } from '@/api-client/types.gen';

export interface StreamingChatRequest {
  token: string;
  message: string;
  repository_id: string;
  use_user: boolean;
  chat_id?: string;
  conversation_id?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  context_search_query?: string;
  scope_preference?: string;
}

export interface StreamingChunk {
  type: 'token' | 'metadata' | 'error' | 'done' | 'complete';
  content?: string;
  chat_id?: string;
  conversation_id?: string;
  message?: string;
  error_type?: string;
  delta?: {
    content?: string;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  provider?: string;
  model?: string;
  context_metadata?: Record<string, unknown>;
  daily_usage?: DailyUsage;
}

export async function createStreamingChatRequest(request: StreamingChatRequest): Promise<Response> {
  // Create form data as expected by the API
  const formData = new FormData();

  // Add all required fields
  formData.append('token', request.token);
  formData.append('message', request.message);
  formData.append('repository_id', request.repository_id);
  formData.append('use_user', request.use_user.toString());

  // Add optional fields
  if (request.chat_id) formData.append('chat_id', request.chat_id);
  if (request.conversation_id) formData.append('conversation_id', request.conversation_id);
  if (request.provider) formData.append('provider', request.provider);
  if (request.model) formData.append('model', request.model);
  if (request.temperature !== undefined)
    formData.append('temperature', request.temperature.toString());
  if (request.max_tokens) formData.append('max_tokens', request.max_tokens.toString());

  if (request.context_search_query)
    formData.append('context_search_query', request.context_search_query);
  if (request.scope_preference) formData.append('scope_preference', request.scope_preference);

  // Make the request to your backend
  const response = await fetch(`${'http://localhost:8003'}/api/backend-chat/chat/stream`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
  }

  return response;
}

export async function* parseStreamingResponse(
  response: Response,
): AsyncGenerator<StreamingChunk, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream available');

  const decoder = new TextDecoder();
  let buffer = '';
  let hasReceivedData = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      hasReceivedData = true;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        try {
          const data = JSON.parse(trimmedLine);
          console.log('Received streaming data:', data); // Debug log

          // Map backend events to our StreamingChunk format
          switch (data.event) {
            case 'token':
              // First token in the stream contains metadata
              if (data.chat_id && data.conversation_id) {
                yield {
                  type: 'metadata',
                  chat_id: data.chat_id,
                  conversation_id: data.conversation_id,
                  provider: data.provider,
                  model: data.model,
                };
              }

              // Always yield the token content
              if (data.token !== undefined) {
                // Check for undefined instead of truthy
                yield {
                  type: 'token',
                  content: data.token, // Can be empty string
                  chat_id: data.chat_id,
                  conversation_id: data.conversation_id,
                };
              }
              break;

            case 'complete':
              yield {
                type: 'complete',
                chat_id: data.chat_id,
                conversation_id: data.conversation_id,
                usage: data.usage,
                provider: data.provider,
                model: data.model,
                daily_usage: data.daily_usage,
              };
              yield { type: 'done' }; // Signal end
              break;

            case 'error':
              yield {
                type: 'error',
                message: data.error || 'Unknown error',
                error_type: data.error_type || 'unknown',
                chat_id: data.chat_id,
                conversation_id: data.conversation_id,
              };
              return; // Stop processing on error

            default:
              console.warn('Unknown event type:', data.event, data);
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON chunk:', trimmedLine, parseError);
          // Don't yield error for parse failures, just log and continue
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        console.log('Processing final buffer:', data);

        if (data.event === 'token' && data.token !== undefined) {
          yield {
            type: 'token',
            content: data.token,
            chat_id: data.chat_id,
            conversation_id: data.conversation_id,
          };
        } else if (data.event === 'complete') {
          yield {
            type: 'complete',
            chat_id: data.chat_id,
            conversation_id: data.conversation_id,
            usage: data.usage,
            daily_usage: data.daily_usage,
          };
        }
      } catch (parseError) {
        console.warn('Failed to parse final buffer:', buffer, parseError);
      }
    }

    // Only yield done if we haven't already
    if (hasReceivedData) {
      yield { type: 'done' };
    } else {
      // If no data was received at all, this might indicate a quota limit or other issue
      throw new Error(
        'No data received from streaming response - this may indicate a quota limit or API issue',
      );
    }
  } catch (error) {
    console.error('Streaming error:', error);
    yield {
      type: 'error',
      message: error instanceof Error ? error.message : 'Streaming failed',
    };
  } finally {
    reader.releaseLock();
  }
}
