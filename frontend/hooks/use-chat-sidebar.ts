'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  getConversationHistory,
  getAvailableModels,
  getUserChatSessions,
  type AvailableModelsResponse,
  type ChatSessionListItem,
} from '@/utils/api';
import {
  createStreamingChatRequest,
  parseStreamingResponse,
  type StreamingChatRequest,
} from '@/lib/streaming-chat';
import { showToast } from '@/components/toaster';

interface ContextSettings {
  scope: 'focused' | 'moderate' | 'comprehensive';
  includeFullContext: boolean;
  maxTokens: number;
  includeDependencies: boolean;
  traversalDepth: number;
  relevanceThreshold: number;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context_used?: string | null;
  metadata?: Record<string, any> | null;
  context_metadata?: Record<string, any> | null;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  currentChatId?: string;
  currentConversationId?: string;
}

interface ModelApiState {
  provider: string;
  model: string;
  temperature: number;
}

type ModelState = Partial<ModelApiState>;

export function useChatSidebar(
  repositoryId: string,
  userKeyPreferences: Record<string, boolean>,
  options?: { autoLoad?: boolean },
) {
  const { data: session } = useSession();
  const { autoLoad = true } = options ?? {};
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
  });
  const [modelState, setModelState] = useState<ModelState>({});
  const [availableModels, setAvailableModels] = useState<AvailableModelsResponse>({
    providers: {},
    current_limits: {},
    user_has_keys: [],
  });
  const [chatHistory, setChatHistory] = useState<ChatSessionListItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [useUserKeys, setUseUserKeys] = useState<Record<string, boolean>>(userKeyPreferences);
  const [contextSettings, setContextSettings] = useState<ContextSettings>({
    scope: 'moderate',
    includeFullContext: false,
    maxTokens: 4000,
    includeDependencies: true,
    traversalDepth: 2,
    relevanceThreshold: 0.3,
  });

  // Refs to prevent duplicate loads in React Strict Mode/dev and to avoid concurrent calls
  const isFetchingHistoryRef = useRef(false);
  const lastHistoryKeyRef = useRef<string | null>(null);
  const lastModelsTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setUseUserKeys(userKeyPreferences);
  }, [userKeyPreferences]);

  // Load available models and chat history on mount or when auth/repo changes (with guards)
  useEffect(() => {
    if (!autoLoad) return;
    if (!session?.jwt_token) return;
    if (!repositoryId) return;

    // Models: only load once per token
    if (lastModelsTokenRef.current !== session.jwt_token) {
      lastModelsTokenRef.current = session.jwt_token;
      loadAvailableModels();
    }

    // History: only load once per token+repository pair
    const historyKey = `${session.jwt_token}:${repositoryId}`;
    if (lastHistoryKeyRef.current !== historyKey) {
      lastHistoryKeyRef.current = historyKey;
      void loadChatHistory();
    }
  }, [autoLoad, session?.jwt_token, repositoryId]);

  const loadAvailableModels = async () => {
    if (!session?.jwt_token) return;

    try {
      const models = await getAvailableModels(session.jwt_token);
      setAvailableModels(models);

      // Set default model if current one is not available
      const providerKey = modelState.provider;
      const modelKey = modelState.model;
      const currentProviderModels = providerKey
        ? models.providers[providerKey as keyof typeof models.providers]
        : undefined;
      if (!providerKey || !modelKey || !currentProviderModels?.includes(modelKey as string)) {
        const firstProvider = Object.keys(models.providers)[0];
        const firstModel = firstProvider ? models.providers[firstProvider]?.[0] : undefined;
        if (firstProvider && firstModel) {
          setModelState((prev) => ({
            ...prev,
            provider: firstProvider,
            model: firstModel,
          }));
        }
      }
    } catch (error) {
      showToast.error('Failed to load available models');
    }
  };

  const loadChatHistory = async () => {
    if (!session?.jwt_token) return;
    if (!repositoryId) return;
    if (isFetchingHistoryRef.current) return;

    isFetchingHistoryRef.current = true;
    setIsLoadingHistory(true);
    try {
      const chatSessions = await getUserChatSessions(session.jwt_token, repositoryId);
      if (chatSessions.success) {
        setChatHistory(chatSessions.sessions);
      } else {
        setChatHistory([]);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      showToast.error('Failed to load chat history');
      setChatHistory([]);
    } finally {
      setIsLoadingHistory(false);
      isFetchingHistoryRef.current = false;
    }
  };

  const sendMessage = async (content: string) => {
    if (!session?.jwt_token || chatState.isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }));

    try {
      const streamingRequest: StreamingChatRequest = {
        token: session.jwt_token,
        message: content,
        repository_id: repositoryId,
        use_user: modelState.provider ? (useUserKeys[modelState.provider] ?? false) : false,
        chat_id: chatState.currentChatId,
        conversation_id: chatState.currentConversationId,
        provider: modelState.provider,
        model: modelState.model,
        temperature: modelState.temperature,
        include_full_context: contextSettings.includeFullContext,
        context_search_query: content, // Send user message as context search query for smart search
        scope_preference: contextSettings.scope,
        max_tokens: contextSettings.maxTokens,
      };

      const response = await createStreamingChatRequest(streamingRequest);

      let assistantMessage = '';
      let chatId = chatState.currentChatId;
      let conversationId = chatState.currentConversationId;
      let hasStartedResponse = false;
      let metadataReceived = false;
      let hasReceivedTokens = false;

      // Add placeholder assistant message immediately
      setChatState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: 'assistant',
            content: '',
            timestamp: new Date(),
          },
        ],
      }));

      try {
        // Process streaming response
        for await (const chunk of parseStreamingResponse(response)) {
          console.log('Processing chunk:', chunk); // Debug log

          if (chunk.type === 'metadata') {
            // Extract chat and conversation IDs from metadata
            if (chunk.chat_id && chunk.conversation_id && !metadataReceived) {
              chatId = chunk.chat_id;
              conversationId = chunk.conversation_id;
              metadataReceived = true;

              // Update state with new IDs immediately
              setChatState((prev) => ({
                ...prev,
                currentChatId: chatId,
                currentConversationId: conversationId,
              }));
            }
          } else if (chunk.type === 'token') {
            hasReceivedTokens = true;
            hasStartedResponse = true;

            // Handle token content (can be empty string)
            if (chunk.content !== undefined) {
              assistantMessage += chunk.content;

              // Update the last assistant message with streaming content
              setChatState((prev) => {
                const newMessages = [...prev.messages];
                const lastMessage = newMessages[newMessages.length - 1];

                if (lastMessage?.role === 'assistant') {
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    content: assistantMessage,
                  };
                }

                return {
                  ...prev,
                  messages: newMessages,
                  currentChatId: chatId || prev.currentChatId,
                  currentConversationId: conversationId || prev.currentConversationId,
                };
              });
            }
          } else if (chunk.type === 'complete') {
            console.log('Stream completed successfully');

            // Update the final assistant message with context metadata if available
            if (chunk.context_metadata) {
              setChatState((prev) => {
                const newMessages = [...prev.messages];
                const lastMessage = newMessages[newMessages.length - 1];

                if (lastMessage?.role === 'assistant') {
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    context_metadata: chunk.context_metadata,
                  };
                }

                return {
                  ...prev,
                  messages: newMessages,
                };
              });
            }

            break;
          } else if (chunk.type === 'error') {
            const errorMessage = chunk.message || 'Streaming error occurred';
            console.error('Streaming error:', errorMessage);

            // Check for specific error types
            if (
              errorMessage.toLowerCase().includes('quota') ||
              errorMessage.toLowerCase().includes('limit') ||
              errorMessage.toLowerCase().includes('rate')
            ) {
              throw new Error(
                'API quota limit reached. Please try again later or use your own API key.',
              );
            } else if (errorMessage.toLowerCase().includes('authentication')) {
              throw new Error('Authentication failed. Please Provide your API key.');
            } else {
              throw new Error(errorMessage);
            }
          } else if (chunk.type === 'done') {
            console.log('Stream done');
            break;
          }
        }
      } catch (streamError) {
        console.error('Stream processing error:', streamError);
        throw streamError; // Re-throw to be caught by outer try-catch
      }

      // Check if we actually received any response
      if (!hasReceivedTokens && !hasStartedResponse) {
        throw new Error(
          'No response received from AI. This may be due to API quota limits or temporary service issues. Please try again later.',
        );
      }

      // Final state update
      setChatState((prev) => ({
        ...prev,
        currentChatId: chatId || prev.currentChatId,
        currentConversationId: conversationId || prev.currentConversationId,
        isLoading: false,
      }));

      console.log('Message sent successfully, refreshing chat history');
      // Refresh chat history after successful message
      await loadChatHistory();
    } catch (error) {
      console.error('Chat error:', error);

      let errorMessage = 'Failed to send message';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      showToast.error(errorMessage);

      // Remove both user and assistant messages if there was an error
      setChatState((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2), // Remove last 2 messages (user + assistant placeholder)
        isLoading: false,
      }));
    }
  };

  const loadConversation = async (conversationId: string) => {
    if (!session?.jwt_token) return;

    setChatState((prev) => ({ ...prev, isLoading: true }));

    try {
      const conversation = await getConversationHistory(session.jwt_token, conversationId);

      const messages: Message[] = conversation.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp), // Ensure proper Date object
        context_used: msg.context_used,
        metadata: msg.metadata,
      }));

      setChatState({
        messages,
        isLoading: false,
        currentChatId: conversation.chat_id,
        currentConversationId: conversation.conversation_id,
      });

      showToast.success('Conversation loaded');
    } catch (error) {
      console.error('Failed to load conversation:', error);
      showToast.error('Failed to load conversation');
      setChatState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const loadConversationBySessionItem = async (sessionItem: ChatSessionListItem) => {
    await loadConversation(sessionItem.conversation_id);
  };

  const clearCurrentChat = () => {
    // This creates a completely new chat session
    setChatState({
      messages: [],
      isLoading: false,
      currentChatId: undefined,
      currentConversationId: undefined,
    });
    showToast.success('Started new chat');
  };

  const startNewConversation = () => {
    // Keep the same chat_id but clear conversation_id to start a new conversation thread
    setChatState((prev) => ({
      messages: [],
      isLoading: false,
      currentChatId: prev.currentChatId, // Keep the existing chat session
      // Clear conversationId - will be generated on first message of new conversation
      currentConversationId: undefined,
    }));
    showToast.success('Started new conversation');
  };

  const startNewChatSession = () => {
    // This creates a completely new chat session
    setChatState({
      messages: [],
      isLoading: false,
      // Clear both IDs - new session will be created by backend
      currentChatId: undefined,
      currentConversationId: undefined,
    });
    showToast.success('Started new chat session');
  };

  const setModel = (provider: string, model: string) => {
    setModelState((prev) => ({
      ...prev,
      provider,
      model,
    }));
  };

  const refreshModels = async () => {
    await loadAvailableModels();
  };

  const refreshChatHistory = async () => {
    await loadChatHistory();
  };

  return {
    messages: chatState.messages,
    isLoading: chatState.isLoading,
    isLoadingHistory,
    currentModel: modelState,
    availableModels,
    chatHistory,
    sendMessage,
    loadConversation,
    loadConversationBySessionItem, // New method specifically for session items
    clearCurrentChat, // Creates completely new chat session
    startNewConversation, // Starts new conversation in same chat session
    startNewChatSession, // Same as clearCurrentChat for backward compatibility
    setModel,
    refreshModels,
    refreshChatHistory, // New method to manually refresh chat history
    // Expose current session info for debugging
    currentChatId: chatState.currentChatId,
    currentConversationId: chatState.currentConversationId,
    useUserKeys,
    setUseUserKeys,
    // Context settings
    contextSettings,
    setContextSettings,
  };
}
