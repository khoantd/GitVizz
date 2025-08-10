# API Client Configuration

This directory contains the auto-generated API client code and configuration.

## Files

- `client.gen.ts` - Auto-generated client configuration (gets overwritten on regeneration)
- `sdk.gen.ts` - Auto-generated SDK functions
- `types.gen.ts` - Auto-generated TypeScript types
- `schemas.gen.ts` - Auto-generated schemas

## Environment Variables

The API client uses the following environment variable:

- `NEXT_PUBLIC_BACKEND_URL` - Base URL for the backend API (accessible both client and server-side, default: `http://localhost:8003`)

## Client Configuration

### Generated Client
The `client.gen.ts` file is auto-generated and should not be manually edited. Use the post-processing script to ensure proper environment variable usage.

### Custom Client Configuration
Use `../utils/client-config.ts` for custom client configurations that won't get overwritten:

```typescript
import { getAuthClient, apiClient } from '@/utils/client-config';

// Use the default client
const response = await someApiFunction({
  client: apiClient,
  // ... other options
});

// Use auth client (automatically selects appropriate base URL)
const authResponse = await loginUserApiBackendAuthLoginPost({
  client: getAuthClient(),
  body: { access_token },
});
```

## Regenerating API Client

Run the following command to regenerate the API client:

```bash
pnpm run generate:api
```

This will:
1. Generate the API client from the OpenAPI spec
2. Run the post-processing script to fix environment variable usage
3. Apply proper formatting and linting

## Post-Processing Script

The `scripts/fix-api-client.js` script automatically runs after API generation to:
- Replace hardcoded base URLs with environment variables
- Ensure proper configuration for different environments

## Environment Setup

1. Copy environment variables:
   ```bash
   pnpm run setup:env
   ```

2. Configure your `.env.local` file with the backend API URL:
   ```env
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8003
   ```

## Troubleshooting

### Import Errors
If you see import errors like "auth_client is not exported", it means the API client needs to be regenerated or the custom client configuration needs to be used.

### Environment Variables Not Working
Make sure you're using the correct environment variable names for your environment (client-side vs server-side).

### Client Configuration Issues
Use the custom client configuration in `utils/client-config.ts` instead of directly importing from the generated files.
