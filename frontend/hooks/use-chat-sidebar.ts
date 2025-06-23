"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
  getConversationHistory,
  getAvailableModels,
  getUserChatSessions,
  type ConversationHistoryResponse,
  type AvailableModelsResponse,
  type ChatSessionListResponse,
  type ChatSessionListItem,
} from "@/utils/api"
import { createStreamingChatRequest, parseStreamingResponse, type StreamingChatRequest } from "@/lib/streaming-chat"
import { showToast } from "@/components/toaster"

interface Message {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  context_used?: string | null
  metadata?: Record<string, any> | null
}

interface ChatState {
  messages: Message[]
  isLoading: boolean
  currentChatId?: string
  currentConversationId?: string
}

interface ModelState {
  provider: string
  model: string
  temperature: number
}

export function useChatSidebar(repositoryId: string) {
  const { data: session } = useSession()
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
  })
  const [modelState, setModelState] = useState<ModelState>({
    provider: "openai",
    model: "gpt-3.5-turbo",
    temperature: 0.7,
  })
  const [availableModels, setAvailableModels] = useState<AvailableModelsResponse>({
    providers: {},
    current_limits: {},
    user_has_keys: [],
  })
  const [chatHistory, setChatHistory] = useState<ChatSessionListItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Load available models and chat history on mount
  useEffect(() => {
    if (session?.jwt_token) {
      loadAvailableModels()
      loadChatHistory()
    }
  }, [session?.jwt_token])

  const loadAvailableModels = async () => {
    if (!session?.jwt_token) return

    try {
      const models = await getAvailableModels(session.jwt_token)
      setAvailableModels(models)

      // Set default model if current one is not available
      const currentProviderModels = models.providers[modelState.provider]
      if (!currentProviderModels?.includes(modelState.model)) {
        const firstProvider = Object.keys(models.providers)[0]
        const firstModel = models.providers[firstProvider]?.[0]
        if (firstProvider && firstModel) {
          setModelState((prev) => ({
            ...prev,
            provider: firstProvider,
            model: firstModel,
          }))
        }
      }
    } catch (error) {
      showToast.error("Failed to load available models")
    }
  }

  const loadChatHistory = async () => {
    if (!session?.jwt_token) return

    setIsLoadingHistory(true)
    try {
      const chatSessions = await getUserChatSessions(session.jwt_token,repositoryId)
      if (chatSessions.success) {
        setChatHistory(chatSessions.sessions)
      } else {
        setChatHistory([])
      }
    } catch (error) {
      console.error("Failed to load chat history:", error)
      showToast.error("Failed to load chat history")
      setChatHistory([])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const sendMessage = async (content: string) => {
    if (!session?.jwt_token || chatState.isLoading) return

    const userMessage: Message = {
      role: "user",
      content,
      timestamp: new Date(),
    }

    setChatState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }))

    try {
      const streamingRequest: StreamingChatRequest = {
        token: session.jwt_token,
        message: content,
        repository_id: repositoryId,
        chat_id: chatState.currentChatId,
        conversation_id: chatState.currentConversationId,
        provider: modelState.provider,
        model: modelState.model,
        temperature: modelState.temperature,
        include_full_context: false,
      }

      const response = await createStreamingChatRequest(streamingRequest)

      let assistantMessage = ""
      let chatId = chatState.currentChatId
      let conversationId = chatState.currentConversationId
      let hasStartedResponse = false
      let metadataReceived = false

      // Add placeholder assistant message immediately
      setChatState((prev) => ({
        ...prev,
        messages: [...prev.messages, {
          role: "assistant",
          content: "",
          timestamp: new Date(),
        }],
      }))

      // Process streaming response
      for await (const chunk of parseStreamingResponse(response)) {
        if (chunk.type === "metadata") {
          // Extract chat and conversation IDs from first token's metadata
          if (chunk.chat_id && chunk.conversation_id && !metadataReceived) {
            chatId = chunk.chat_id
            conversationId = chunk.conversation_id
            metadataReceived = true
            
            // Update state with new IDs immediately
            setChatState((prev) => ({
              ...prev,
              currentChatId: chatId,
              currentConversationId: conversationId,
            }))
          }
        } else if (chunk.type === "token" && chunk.content) {
          assistantMessage += chunk.content
          hasStartedResponse = true

          // Update the last assistant message with streaming content
          setChatState((prev) => {
            const newMessages = [...prev.messages]
            const lastMessage = newMessages[newMessages.length - 1]
            
            if (lastMessage?.role === "assistant") {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: assistantMessage,
              }
            }

            return {
              ...prev,
              messages: newMessages,
              currentChatId: chatId,
              currentConversationId: conversationId,
            }
          })
        } else if (chunk.type === "error") {
          throw new Error(chunk.message || "Streaming error occurred")
        } else if (chunk.type === "done") {
          break
        }
      }

      // Final state update
      setChatState((prev) => ({
        ...prev,
        currentChatId: chatId,
        currentConversationId: conversationId,
        isLoading: false,
      }))

      if (!hasStartedResponse) {
        throw new Error("No response received from AI")
      }
      
      // Refresh chat history after successful message
      await loadChatHistory()
      
    } catch (error) {
      console.error("Chat error:", error)
      showToast.error(`Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`)

      // Remove both user and assistant messages if there was an error
      setChatState((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2), // Remove last 2 messages (user + assistant placeholder)
        isLoading: false,
      }))
    }
  }

  const loadConversation = async (conversationId: string) => {
    if (!session?.jwt_token) return

    setChatState(prev => ({ ...prev, isLoading: true }))

    try {
      const conversation = await getConversationHistory(session.jwt_token, conversationId)

      const messages: Message[] = conversation.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp), // Ensure proper Date object
        context_used: msg.context_used,
        metadata: msg.metadata,
      }))

      setChatState({
        messages,
        isLoading: false,
        currentChatId: conversation.chat_id,
        currentConversationId: conversation.conversation_id,
      })

      showToast.success("Conversation loaded")
    } catch (error) {
      console.error("Failed to load conversation:", error)
      showToast.error("Failed to load conversation")
      setChatState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const loadConversationBySessionItem = async (sessionItem: ChatSessionListItem) => {
    await loadConversation(sessionItem.conversation_id)
  }

  const clearCurrentChat = () => {
    // This creates a completely new chat session
    setChatState({
      messages: [],
      isLoading: false,
      currentChatId: undefined,
      currentConversationId: undefined,
    })
    showToast.success("Started new chat")
  }

  const startNewConversation = () => {
    // Keep the same chat_id but clear conversation_id to start a new conversation thread
    setChatState(prev => ({
      messages: [],
      isLoading: false,
      currentChatId: prev.currentChatId, // Keep the existing chat session
      // Clear conversationId - will be generated on first message of new conversation
      currentConversationId: undefined,
    }))
    showToast.success("Started new conversation")
  }

  const startNewChatSession = () => {
    // This creates a completely new chat session
    setChatState({
      messages: [],
      isLoading: false,
      // Clear both IDs - new session will be created by backend
      currentChatId: undefined,
      currentConversationId: undefined,
    })
    showToast.success("Started new chat session")
  }

  const setModel = (provider: string, model: string) => {
    setModelState((prev) => ({
      ...prev,
      provider,
      model,
    }))
  }

  const refreshModels = async () => {
    await loadAvailableModels()
  }

  const refreshChatHistory = async () => {
    await loadChatHistory()
  }

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
    clearCurrentChat,        // Creates completely new chat session
    startNewConversation,    // Starts new conversation in same chat session  
    startNewChatSession,     // Same as clearCurrentChat for backward compatibility
    setModel,
    refreshModels,
    refreshChatHistory,      // New method to manually refresh chat history
    // Expose current session info for debugging
    currentChatId: chatState.currentChatId,
    currentConversationId: chatState.currentConversationId,
  }
}