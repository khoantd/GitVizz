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
  // For client-side requests (browser), use the public URL
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';
  }
  
  // For server-side requests, always use the public URL
  // This ensures NextAuth callbacks work correctly
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';
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
