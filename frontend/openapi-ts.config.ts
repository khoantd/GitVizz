import { defineConfig } from '@hey-api/openapi-ts'; 
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

export default defineConfig({
  input:
    `${process.env.API_BASE_URL}/openapi.json`,
  output: {
    format: 'prettier',
    lint: 'eslint',
    path: `${path.resolve(__dirname, '../frontend/api-client')}`,
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