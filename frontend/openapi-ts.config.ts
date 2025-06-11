import { defineConfig } from '@hey-api/openapi-ts'; 
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.local') });

// Fallback to localhost if API_BASE_URL is not set
const apiBaseUrl = process.env.API_BASE_URL

export default defineConfig({
  input: `${apiBaseUrl}/openapi.json`,
  output: {
    format: 'prettier',
    lint: 'eslint',
    path: './api-client',
  },
  plugins: [
    '@hey-api/client-fetch',
    '@hey-api/schemas',
    {
      dates: true,
      name: '@hey-api/transformers',
    },
    {
      enums: 'javascript',
      name: '@hey-api/typescript',
    },
    {
      name: '@hey-api/sdk',
      transformer: true,
    },
  ],
});