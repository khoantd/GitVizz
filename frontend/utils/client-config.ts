// Client configuration for different API endpoints
import {
  type Config,
  type ClientOptions as DefaultClientOptions,
  createClient,
  createConfig,
} from '@hey-api/client-fetch';

import type { ClientOptions } from '../api-client/types.gen';

/**
 * The `createClientConfig()` function will be called on client initialization
 * and the returned object will become the client's initial configuration.
 */
export type CreateClientConfig<T extends DefaultClientOptions = ClientOptions> = (
  override?: Config<DefaultClientOptions & T>,
) => Config<Required<DefaultClientOptions> & T>;

// Get environment variables with proper fallbacks
const getApiBaseUrl = () => {
  // For server-side requests in Docker, use internal container networking
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    // Server-side request in Docker - use internal container name
    return 'http://backend:8003';
  }
  // Client-side requests - always use localhost (accessible from browser)
  return 'http://localhost:8003';
};

const getAuthBaseUrl = () => {
  // Use the same backend URL for auth (since they point to the same server)
  return getApiBaseUrl();
};

// Default client for main API operations
export const client = createClient(
  createConfig<ClientOptions>({
    baseUrl: getApiBaseUrl(),
  }),
);

// Function to create a client with custom base URL if needed
export function createApiClient(baseUrl?: string) {
  return createClient(
    createConfig<ClientOptions>({
      baseUrl: baseUrl || getApiBaseUrl(),
    }),
  );
}

// Auth client - only if different from main API
export const getAuthClient = () => {
  const authBaseUrl = getAuthBaseUrl();
  const mainBaseUrl = getApiBaseUrl();
  
  // If auth server URL is different, create a separate client
  if (authBaseUrl && authBaseUrl !== mainBaseUrl) {
    return createApiClient(authBaseUrl);
  }
  
  // Otherwise, use the default client
  return client;
};

// Export a configured client that can be used as the default
export const apiClient = client;
