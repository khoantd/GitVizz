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
 *
 * You may want to initialize your client this way instead of calling
 * `setConfig()`. This is useful for example if you're using Next.js
 * to ensure your client always has the correct values.
 */
export type CreateClientConfig<T extends DefaultClientOptions = ClientOptions> = (
  override?: Config<DefaultClientOptions & T>,
) => Config<Required<DefaultClientOptions> & T>;

// Default client for main API operations
export const client = createClient(
  createConfig<ClientOptions>({
    baseUrl: process.env.API_BASE_URL || 'http://localhost:8003',
  }),
);

// Function to create a client with custom base URL if needed
export function createApiClient(baseUrl?: string) {
  return createClient(
    createConfig<ClientOptions>({
      baseUrl: baseUrl || process.env.API_BASE_URL || 'http://localhost:8003',
    }),
  );
}

// Auth client - only if different from main API
export const getAuthClient = () => {
  const authBaseUrl = process.env.API_SERVER_BASE_URL;
  const mainBaseUrl = process.env.API_BASE_URL || 'http://localhost:8003';
  
  // If auth server URL is different, create a separate client
  if (authBaseUrl && authBaseUrl !== mainBaseUrl) {
    return createApiClient(authBaseUrl);
  }
  
  // Otherwise, use the default client
  return client;
};
