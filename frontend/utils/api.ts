// API utilities for interacting with the backend using Hey-API generated SDK

import {
  generateTextEndpointApiRepoGenerateTextPost,
  generateGraphEndpointApiRepoGenerateGraphPost,
  generateStructureEndpointApiRepoGenerateStructurePost,
  loginUserApiBackendAuthLoginPost
} from '../api-client/sdk.gen';
import type {
  GraphResponse,
  StructureResponse,
  BodyGenerateTextEndpointApiRepoGenerateTextPost,
  BodyGenerateGraphEndpointApiRepoGenerateGraphPost,
  BodyGenerateStructureEndpointApiRepoGenerateStructurePost,
  LoginUserApiBackendAuthLoginPostData,
  LoginResponse
} from '../api-client/types.gen';

// Types for convenience
export interface RepoRequest {
  repo_url: string;
  branch?: string;
  access_token?: string;
  jwt_token?: string;
}

/**
 * Generate LLM-friendly text from a GitHub repository
 */
export async function fetchGithubRepo(repoRequest: RepoRequest): Promise<string> {
  try {
    const body: BodyGenerateTextEndpointApiRepoGenerateTextPost = {
      repo_url: repoRequest.repo_url,
      branch: repoRequest.branch || 'main',
      access_token: repoRequest.access_token || '',
      jwt_token: repoRequest.jwt_token || ''
    };

    const response = await generateTextEndpointApiRepoGenerateTextPost({
      body
    });

    if (response.error) {
      const errorMessage = typeof response.error.detail === 'string'
        ? response.error.detail
        : Array.isArray(response.error.detail)
          ? response.error.detail.map(err => err.msg).join(', ')
          : 'Failed to fetch repository';
      throw new Error(errorMessage);
    }

    return response.data?.text_content || '';
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch repository');
  }
}

/**
 * Generate graph from GitHub repository
 */
export async function generateGraphFromGithub(repoRequest: RepoRequest, jwt_token: string): Promise<GraphResponse> {
  try {
    const body: BodyGenerateGraphEndpointApiRepoGenerateGraphPost = {
      repo_url: repoRequest.repo_url,
      branch: repoRequest.branch || 'main',
      access_token: repoRequest.access_token || '',
      jwt_token: repoRequest.jwt_token || ''
    };

    const response = await generateGraphEndpointApiRepoGenerateGraphPost({
      body
    });

    if (response.error) {
      const errorMessage = typeof response.error.detail === 'string'
        ? response.error.detail
        : Array.isArray(response.error.detail)
          ? response.error.detail.map(err => err.msg).join(', ')
          : 'Failed to generate graph from GitHub repository';
      throw new Error(errorMessage);
    }

    if (!response.data) {
      throw new Error('No data received from server');
    }

    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate graph from GitHub repository');
  }
}

/**
 * Generate structure from GitHub repository
 */
export async function generateStructureFromGithub(repoRequest: RepoRequest): Promise<StructureResponse> {
  try {
    const body: BodyGenerateStructureEndpointApiRepoGenerateStructurePost = {
      repo_url: repoRequest.repo_url,
      branch: repoRequest.branch || 'main',
      access_token: repoRequest.access_token || '',
      jwt_token: repoRequest.jwt_token || ''
    };

    const response = await generateStructureEndpointApiRepoGenerateStructurePost({
      body
    });

    if (response.error) {
      const errorMessage = typeof response.error.detail === 'string'
        ? response.error.detail
        : Array.isArray(response.error.detail)
          ? response.error.detail.map(err => err.msg).join(', ')
          : 'Failed to generate structure from GitHub repository';
      throw new Error(errorMessage);
    }

    if (!response.data) {
      throw new Error('No data received from server');
    }

    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate structure from GitHub repository');
  }
}

/**
 * Upload and process local ZIP file to generate text
 */
export async function uploadLocalZip(file: File, jwt_token: string): Promise<{ text: string }> {
  try {
    const body: BodyGenerateTextEndpointApiRepoGenerateTextPost = {
      zip_file: file,
      branch: 'main', // Default branch for local uploads
      access_token: '', // No access token needed for local files
      jwt_token: jwt_token || ''
    };

    const response = await generateTextEndpointApiRepoGenerateTextPost({
      body
    });

    if (response.error) {
      const errorMessage = typeof response.error.detail === 'string'
        ? response.error.detail
        : Array.isArray(response.error.detail)
          ? response.error.detail.map(err => err.msg).join(', ')
          : 'Failed to process zip file';
      throw new Error(errorMessage);
    }

    return { text: response.data?.text_content || '' };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to process zip file');
  }
}

/**
 * Generate graph from uploaded ZIP file
 */
export async function generateGraphFromZip(file: File, jwt_token: string): Promise<GraphResponse> {
  try {
    const body: BodyGenerateGraphEndpointApiRepoGenerateGraphPost = {
      zip_file: file,
      branch: 'main', // Default branch for local uploads
      access_token: '', // No access token needed for local files
      jwt_token: jwt_token || ''
    };

    const response = await generateGraphEndpointApiRepoGenerateGraphPost({
      body
    });

    if (response.error) {
      const errorMessage = typeof response.error.detail === 'string'
        ? response.error.detail
        : Array.isArray(response.error.detail)
          ? response.error.detail.map(err => err.msg).join(', ')
          : 'Failed to generate graph from ZIP file';
      throw new Error(errorMessage);
    }

    if (!response.data) {
      throw new Error('No data received from server');
    }

    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate graph from ZIP file');
  }
}

/**
 * Generate structure from uploaded ZIP file
 */
export async function generateStructureFromZip(file: File, jwt_token: string): Promise<StructureResponse> {
  try {
    const body: BodyGenerateStructureEndpointApiRepoGenerateStructurePost = {
      zip_file: file,
      branch: 'main', // Default branch for local uploads
      access_token: '', // No access token needed for local files
      jwt_token: jwt_token || ''
    };

    const response = await generateStructureEndpointApiRepoGenerateStructurePost({
      body
    });

    if (response.error) {
      const errorMessage = typeof response.error.detail === 'string'
        ? response.error.detail
        : Array.isArray(response.error.detail)
          ? response.error.detail.map(err => err.msg).join(', ')
          : 'Failed to generate structure from ZIP file';
      throw new Error(errorMessage);
    }

    if (!response.data) {
      throw new Error('No data received from server');
    }

    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate structure from ZIP file');
  }
}

/**
 * Get Jwt token for authenticated user
 * @param access_token - github access token
 * @returns JWT token for authenticated user
 */

export async function getJwtToken(access_token: string): Promise<LoginResponse> {
  try {
    const response = await loginUserApiBackendAuthLoginPost({
      body: { access_token }
    });

    if (response.error) {
      const errorMessage = typeof response.error.detail === 'string'
        ? response.error.detail
        : Array.isArray(response.error.detail)
          ? response.error.detail.map(err => err.msg).join(', ')
          : 'Failed to authenticate user';
      throw new Error(errorMessage);
    }

    return response.data as LoginResponse;

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get JWT token');
  }
}

// Helper function to get filename suggestion from text response
export async function getFilenameSuggestion(repoRequest: RepoRequest): Promise<string> {
  try {
    const body: BodyGenerateTextEndpointApiRepoGenerateTextPost = {
      repo_url: repoRequest.repo_url,
      branch: repoRequest.branch || 'main',
      access_token: repoRequest.access_token || '',
      jwt_token: repoRequest.jwt_token || ''
    };

    const response = await generateTextEndpointApiRepoGenerateTextPost({
      body
    });

    if (response.error) {
      const errorMessage = typeof response.error.detail === 'string'
        ? response.error.detail
        : Array.isArray(response.error.detail)
          ? response.error.detail.map(err => err.msg).join(', ')
          : 'Failed to get filename suggestion';
      throw new Error(errorMessage);
    }

    return response.data?.filename_suggestion || 'repository.txt';
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get filename suggestion');
  }
}