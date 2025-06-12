// API utilities for interacting with the backend using Hey-API generated SDK

import {
  generateTextEndpointApiGenerateTextPost,
  generateGraphEndpointApiGenerateGraphPost,
  generateStructureEndpointApiGenerateStructurePost
} from '../api-client/sdk.gen';
import type {
  GraphResponse,
  StructureResponse,
  BodyGenerateTextEndpointApiGenerateTextPost,
  BodyGenerateGraphEndpointApiGenerateGraphPost,
  BodyGenerateStructureEndpointApiGenerateStructurePost
} from '../api-client/types.gen';

// Types for convenience
export interface RepoRequest {
  repo_url: string;
  branch?: string;
  access_token?: string;
}

/**
 * Generate LLM-friendly text from a GitHub repository
 */
export async function fetchGithubRepo(repoRequest: RepoRequest): Promise<string> {
  try {
    const body: BodyGenerateTextEndpointApiGenerateTextPost = {
      repo_url: repoRequest.repo_url,
      branch: repoRequest.branch || 'main'
    };

    const response = await generateTextEndpointApiGenerateTextPost({
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
export async function generateGraphFromGithub(repoRequest: RepoRequest): Promise<GraphResponse> {
  try {
    const body: BodyGenerateGraphEndpointApiGenerateGraphPost = {
      repo_url: repoRequest.repo_url,
      branch: repoRequest.branch || 'main'
    };

    const response = await generateGraphEndpointApiGenerateGraphPost({
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
    const body: BodyGenerateStructureEndpointApiGenerateStructurePost = {
      repo_url: repoRequest.repo_url,
      branch: repoRequest.branch || 'main'
    };

    const response = await generateStructureEndpointApiGenerateStructurePost({
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
export async function uploadLocalZip(file: File): Promise<{ text: string }> {
  try {
    const body: BodyGenerateTextEndpointApiGenerateTextPost = {
      zip_file: file
    };

    const response = await generateTextEndpointApiGenerateTextPost({
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
export async function generateGraphFromZip(file: File): Promise<GraphResponse> {
  try {
    const body: BodyGenerateGraphEndpointApiGenerateGraphPost = {
      zip_file: file
    };

    const response = await generateGraphEndpointApiGenerateGraphPost({
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
export async function generateStructureFromZip(file: File): Promise<StructureResponse> {
  try {
    const body: BodyGenerateStructureEndpointApiGenerateStructurePost = {
      zip_file: file
    };

    const response = await generateStructureEndpointApiGenerateStructurePost({
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

// Helper function to get filename suggestion from text response
export async function getFilenameSuggestion(repoRequest: RepoRequest): Promise<string> {
  try {
    const body: BodyGenerateTextEndpointApiGenerateTextPost = {
      repo_url: repoRequest.repo_url,
      branch: repoRequest.branch || 'main'
    };

    const response = await generateTextEndpointApiGenerateTextPost({
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