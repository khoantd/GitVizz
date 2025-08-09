// API utilities for interacting with the backend using Hey-API generated SDK

import { auth_client } from '@/api-client/client.gen';
import {
  generateTextEndpointApiRepoGenerateTextPost,
  generateGraphEndpointApiRepoGenerateGraphPost,
  generateStructureEndpointApiRepoGenerateStructurePost,
  loginUserApiBackendAuthLoginPost,
  processChatMessageApiBackendChatChatPost,
  streamChatResponseApiBackendChatChatStreamPost,
  getConversationHistoryApiBackendChatConversationsConversationIdPost,
  getChatSessionApiBackendChatSessionsChatIdPost,
  saveUserApiKeyApiBackendChatKeysSavePost,
  getAvailableModelsApiBackendChatModelsPost,
  updateChatSettingsApiBackendChatSettingsPost,
  searchContextApiBackendChatContextSearchPost,
  listUserChatSessionsApiBackendChatSessionsPost,
  generateWikiApiDocumentationGenerateWikiPost,
  getWikiStatusApiDocumentationWikiStatusPost,
  listRepositoryDocsApiDocumentationRepositoryDocsPost,
  isWikiGeneratedApiDocumentationIsWikiGeneratedPost,
} from '../api-client/sdk.gen';

import type {
  GraphResponse,
  StructureResponse,
  LoginResponse,
  ChatResponse,
  ChatSessionResponse,
  ConversationHistoryResponse,
  ApiKeyResponse,
  AvailableModelsResponse,
  ChatSettingsResponse,
  ContextSearchResponse,
  TextResponse,
  ChatSessionListResponse,
  ChatSessionListItem,
  IsWikiGeneratedApiDocumentationIsWikiGeneratedPostResponse,
} from '../api-client/types.gen';

// Types for convenience
export interface RepoRequest {
  repo_url?: string;
  branch?: string;
  access_token?: string;
  jwt_token?: string;
  zip_file?: File;
}

export type {
  ConversationHistoryResponse,
  AvailableModelsResponse,
  ChatSessionListResponse,
  ChatSessionResponse,
  ChatSessionListItem,
};

export interface ChatRequest {
  token: string;
  message: string;
  repository_id: string;
  use_user?: boolean;
  chat_id?: string;
  conversation_id?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  include_full_context?: boolean;
  context_search_query?: string;
}

export interface ApiKeyRequest {
  token: string;
  provider: string;
  api_key: string;
  key_name?: string;
}

// Enum for operation types
export enum OperationType {
  TEXT = 'text',
  GRAPH = 'graph',
  STRUCTURE = 'structure',
}

// Type mapping for responses
type ResponseMap = {
  [OperationType.TEXT]: TextResponse;
  [OperationType.GRAPH]: GraphResponse;
  [OperationType.STRUCTURE]: StructureResponse;
};

// Type mapping for API functions
type ApiFunctionMap = {
  [OperationType.TEXT]: typeof generateTextEndpointApiRepoGenerateTextPost;
  [OperationType.GRAPH]: typeof generateGraphEndpointApiRepoGenerateGraphPost;
  [OperationType.STRUCTURE]: typeof generateStructureEndpointApiRepoGenerateStructurePost;
};

// API function mapping
const API_FUNCTIONS: ApiFunctionMap = {
  [OperationType.TEXT]: generateTextEndpointApiRepoGenerateTextPost,
  [OperationType.GRAPH]: generateGraphEndpointApiRepoGenerateGraphPost,
  [OperationType.STRUCTURE]: generateStructureEndpointApiRepoGenerateStructurePost,
};

// Error messages mapping
const ERROR_MESSAGES = {
  [OperationType.TEXT]: {
    repo: 'Failed to fetch repository',
    zip: 'Failed to process zip file',
  },
  [OperationType.GRAPH]: {
    repo: 'Failed to generate graph from GitHub repository',
    zip: 'Failed to generate graph from ZIP file',
  },
  [OperationType.STRUCTURE]: {
    repo: 'Failed to generate structure from GitHub repository',
    zip: 'Failed to generate structure from ZIP file',
  },
};

/**
 * Generic function to handle all API operations (text, graph, structure)
 * for both GitHub repos and ZIP files
 */
async function executeOperation<T extends OperationType>(
  operationType: T,
  request: RepoRequest,
): Promise<ResponseMap[T]> {
  try {
    // Prepare the request data
    const requestData = {
      repo_url: request.repo_url || null,
      branch: request.branch || 'main',
      access_token: request.access_token || null,
      jwt_token: request.jwt_token || null,
      zip_file: request.zip_file || null,
    };

    // Get the appropriate API function
    const apiFunction = API_FUNCTIONS[operationType];

    // Execute the API call with proper options structure
    const response = await apiFunction({
      body: requestData,
    });

    // Handle errors
    if (response.error) {
      const errorMessage = extractErrorMessage(response.error, operationType, request.zip_file);
      throw new Error(errorMessage);
    }

    // Validate response data
    if (!response.data) {
      throw new Error('No data received from server');
    }

    return response.data as ResponseMap[T];
  } catch (error) {
    handleApiError(error, operationType, request.zip_file);
    throw error; // This won't execute but TypeScript needs it
  }
}

/**
 * Extract error message from API response
 */
function extractErrorMessage(error: any, operationType: OperationType, isZipFile?: File): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.detail) {
    if (typeof error.detail === 'string') {
      return error.detail;
    }
    if (Array.isArray(error.detail)) {
      return error.detail.map((err: any) => err.msg || err.message || String(err)).join(', ');
    }
  }

  return ERROR_MESSAGES[operationType][isZipFile ? 'zip' : 'repo'];
}

/**
 * Handle API errors with proper error types
 */
function handleApiError(error: any, operationType: OperationType, isZipFile?: File): never {
  if (isTokenExpiredError(error)) {
    throw new TokenExpiredError();
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(ERROR_MESSAGES[operationType][isZipFile ? 'zip' : 'repo']);
}

// =============================================================================
// REPOSITORY OPERATIONS
// =============================================================================

/**
 * Generate LLM-friendly text from a GitHub repository
 */
export async function fetchGithubRepo(repoRequest: RepoRequest): Promise<TextResponse> {
  const response = await executeOperation(OperationType.TEXT, repoRequest);
  return {
    text_content: response.text_content || '',
    repo_id: response.repo_id || '',
    filename_suggestion: response.filename_suggestion,
  };
}

/**
 * Generate graph from GitHub repository
 */
export async function generateGraphFromGithub(repoRequest: RepoRequest): Promise<GraphResponse> {
  return executeOperation(OperationType.GRAPH, repoRequest);
}

/**
 * Generate structure from GitHub repository
 */
export async function generateStructureFromGithub(
  repoRequest: RepoRequest,
): Promise<StructureResponse> {
  return executeOperation(OperationType.STRUCTURE, repoRequest);
}

/**
 * Upload and process local ZIP file to generate text
 */
export async function uploadLocalZip(file: File, jwt_token: string): Promise<TextResponse> {
  const response = await executeOperation(OperationType.TEXT, {
    zip_file: file,
    jwt_token,
    branch: 'main',
  });
  return {
    text_content: response.text_content || '',
    repo_id: response.repo_id || '',
    filename_suggestion: response.filename_suggestion,
  };
}

/**
 * Generate graph from uploaded ZIP file
 */
export async function generateGraphFromZip(file: File, jwt_token: string): Promise<GraphResponse> {
  return executeOperation(OperationType.GRAPH, {
    zip_file: file,
    jwt_token,
    branch: 'main',
  });
}

/**
 * Generate structure from uploaded ZIP file
 */
export async function generateStructureFromZip(
  file: File,
  jwt_token: string,
): Promise<StructureResponse> {
  return executeOperation(OperationType.STRUCTURE, {
    zip_file: file,
    jwt_token,
    branch: 'main',
  });
}

/**
 * Get filename suggestion from repository
 */
export async function getFilenameSuggestion(repoRequest: RepoRequest): Promise<string> {
  const response = await executeOperation(OperationType.TEXT, repoRequest);
  return response.filename_suggestion || 'repository.txt';
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Get JWT token for authenticated user
 */
export async function getJwtToken(access_token: string): Promise<LoginResponse> {
  try {
    const response = await loginUserApiBackendAuthLoginPost({
      client: auth_client,
      body: { access_token },
    });

    if (response.error) {
      const errorMessage = extractErrorMessage(response.error, OperationType.TEXT);
      throw new Error(errorMessage);
    }

    if (!response.data) {
      throw new Error('No authentication data received');
    }

    return response.data;
  } catch (error) {
    if (isTokenExpiredError(error)) {
      throw new TokenExpiredError();
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get JWT token');
  }
}

// =============================================================================
// CHAT OPERATIONS
// =============================================================================

/**
 * Send a chat message and get response
 */
export async function sendChatMessage(chatRequest: ChatRequest): Promise<ChatResponse> {
  try {
    const response = await processChatMessageApiBackendChatChatPost({
      body: {
        token: chatRequest.token,
        message: chatRequest.message,
        repository_id: chatRequest.repository_id,
        use_user: chatRequest.use_user || false,
        chat_id: chatRequest.chat_id || null,
        conversation_id: chatRequest.conversation_id || null,
        provider: chatRequest.provider || 'openai',
        model: chatRequest.model || 'gpt-3.5-turbo',
        temperature: chatRequest.temperature || 0.7,
        max_tokens: chatRequest.max_tokens || null,
        include_full_context: chatRequest.include_full_context || false,
        context_search_query: chatRequest.context_search_query || null,
      },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No chat response received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

/**
 * Stream chat response
 */
export async function streamChatResponse(chatRequest: ChatRequest): Promise<Response> {
  try {
    const response = await streamChatResponseApiBackendChatChatStreamPost({
      body: {
        token: chatRequest.token,
        message: chatRequest.message,
        repository_id: chatRequest.repository_id,
        use_user: chatRequest.use_user || false,
        chat_id: chatRequest.chat_id || null,
        conversation_id: chatRequest.conversation_id || null,
        provider: chatRequest.provider || 'openai',
        model: chatRequest.model || 'gpt-3.5-turbo',
        temperature: chatRequest.temperature || 0.7,
        max_tokens: chatRequest.max_tokens || null,
        include_full_context: chatRequest.include_full_context || false,
        context_search_query: chatRequest.context_search_query || null,
      },
    });

    // For streaming, we return the raw response
    return response as any;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

/**
 * Get list of user's chat sessions
 */
export async function getUserChatSessions(
  jwt_token: string,
  repo_id: string,
): Promise<ChatSessionListResponse> {
  try {
    const response = await listUserChatSessionsApiBackendChatSessionsPost({
      body: { jwt_token, repo_id },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No chat sessions data received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  token: string,
  conversationId: string,
): Promise<ConversationHistoryResponse> {
  try {
    const response = await getConversationHistoryApiBackendChatConversationsConversationIdPost({
      path: { conversation_id: conversationId },
      body: { token },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No conversation history received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

/**
 * Get chat session details
 */
export async function getChatSession(token: string, chatId: string): Promise<ChatSessionResponse> {
  try {
    const response = await getChatSessionApiBackendChatSessionsChatIdPost({
      path: { chat_id: chatId },
      body: { token },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No chat session data received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

// =============================================================================
// API KEY MANAGEMENT
// =============================================================================

/**
 * Verify user API key without saving
 */
export async function verifyApiKey(verifyRequest: {
  token: string;
  provider: string;
  api_key: string;
}): Promise<{
  success: boolean;
  provider: string;
  is_valid: boolean;
  message: string;
  available_models?: string[];
}> {
  try {
    const formData = new FormData();
    formData.append('token', verifyRequest.token);
    formData.append('provider', verifyRequest.provider);
    formData.append('api_key', verifyRequest.api_key);

    // Use the proper backend URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8003';
    const response = await fetch(`${backendUrl}/api/backend-chat/keys/verify`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API verification failed: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

/**
 * Save user API key (now with automatic verification by default)
 */
export async function saveApiKey(apiKeyRequest: ApiKeyRequest): Promise<ApiKeyResponse> {
  try {
    // Use manual form data to include verify_key parameter that might not be in generated types yet
    const formData = new FormData();
    formData.append('token', apiKeyRequest.token);
    formData.append('provider', apiKeyRequest.provider);
    formData.append('api_key', apiKeyRequest.api_key);
    if (apiKeyRequest.key_name) {
      formData.append('key_name', apiKeyRequest.key_name);
    }
    formData.append('verify_key', 'true'); // Always verify by default

    // Use the proper backend URL
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8003';
    const response = await fetch(`${backendUrl}/api/backend-chat/keys/save`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to save API key: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {
        // Use the text as is if it's not JSON
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

/**
 * Get available models
 */
export async function getAvailableModels(token: string): Promise<AvailableModelsResponse> {
  try {
    const response = await getAvailableModelsApiBackendChatModelsPost({
      body: { token },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No models data received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

// =============================================================================
// CHAT SETTINGS
// =============================================================================

/**
 * Update chat settings
 */
export async function updateChatSettings(
  token: string,
  chatId: string,
  settings: {
    title?: string;
    default_provider?: string;
    default_model?: string;
    default_temperature?: number;
  },
): Promise<ChatSettingsResponse> {
  try {
    const response = await updateChatSettingsApiBackendChatSettingsPost({
      body: {
        token,
        chat_id: chatId,
        title: settings.title || null,
        default_provider: settings.default_provider || null,
        default_model: settings.default_model || null,
        default_temperature: settings.default_temperature || null,
      },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No settings response received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

// =============================================================================
// CONTEXT SEARCH
// =============================================================================

/**
 * Search repository context
 */
export async function searchContext(
  token: string,
  repositoryId: string,
  query: string,
  maxResults: number = 5,
): Promise<ContextSearchResponse> {
  try {
    const response = await searchContextApiBackendChatContextSearchPost({
      body: {
        token,
        repository_id: repositoryId,
        query,
        max_results: Math.min(Math.max(maxResults, 1), 20), // Ensure between 1-20
      },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No search results received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

// =============================================================================
// UTILITY FUNCTIONS AND ERROR HANDLING
// =============================================================================

export class TokenExpiredError extends Error {
  constructor(message = 'Token expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

function isTokenExpiredError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : error?.message || error?.toString();
  return (
    msg?.toLowerCase().includes('token has expired') ||
    msg?.toLowerCase().includes('jwt expired') ||
    msg?.toLowerCase().includes('expired token') ||
    msg?.toLowerCase().includes('unauthorized')
  );
}

// =============================================================================
// WIKI DOCUMENTATION OPERATIONS
// =============================================================================
/**
 * Generate wiki documentation for a repository
 * Starts the process of generating wiki documentation. The task runs in the background.
 */
export async function generateWikiDocumentation(
  jwt_token: string,
  repository_url: string,
  language: string = 'en',
  comprehensive: boolean = true,
  selectedModel: string | string[],
): Promise<any> {
  try {
    // Convert array to string if needed
    const providerName = Array.isArray(selectedModel) ? selectedModel[0] : selectedModel;

    const response = await generateWikiApiDocumentationGenerateWikiPost({
      body: {
        jwt_token,
        repository_url,
        language,
        comprehensive,
        provider_name: providerName,
      },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No wiki generation response received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

/**
 * Get wiki generation status
 * Retrieves the current status of a wiki generation task using the provided task ID.
 */
export async function getWikiGenerationStatus(jwt_token: string, repo_id: string): Promise<any> {
  try {
    const response = await getWikiStatusApiDocumentationWikiStatusPost({
      body: {
        jwt_token,
        repo_id,
      },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No wiki status response received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

/**
 * List repository documentation files
 * Lists all documentation files for a specific repository with parsed content.
 */
export async function getRepositoryDocumentation(jwt_token: string, repo_id: string): Promise<any> {
  try {
    const response = await listRepositoryDocsApiDocumentationRepositoryDocsPost({
      body: {
        jwt_token,
        repo_id,
      },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No repository documentation response received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

/**
 * Is wiki documentation generated?
 * Checks if wiki documentation has been generated for a specific repository.
 */
export async function isWikiGenerated(
  jwt_token: string,
  repo_id: string,
): Promise<IsWikiGeneratedApiDocumentationIsWikiGeneratedPostResponse> {
  console.log(jwt_token);
  try {
    const response = await isWikiGeneratedApiDocumentationIsWikiGeneratedPost({
      body: {
        jwt_token,
        repo_id,
      },
    });

    if (response.error) {
      throw new Error(extractErrorMessage(response.error, OperationType.TEXT));
    }

    if (!response.data) {
      throw new Error('No wiki generation status response received');
    }

    return response.data;
  } catch (error) {
    handleApiError(error, OperationType.TEXT);
  }
}

// =============================================================================
// UNIVERSAL PROCESSING FUNCTION
// =============================================================================

/**
 * Universal function that can handle any operation type and source (repo/zip)
 * Usage examples:
 *   - processRepository('text', { repo_url: 'https://github.com/user/repo', jwt_token: 'xxx' })
 *   - processRepository('graph', { zip_file: file, jwt_token: 'xxx' })
 */
export async function processRepository<T extends OperationType>(
  operationType: T,
  request: RepoRequest,
): Promise<ResponseMap[T]> {
  return executeOperation(operationType, request);
}
