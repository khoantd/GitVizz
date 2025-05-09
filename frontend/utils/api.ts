// API utilities for interacting with the backend

// Base URL for the API - direct connection to backend
const API_BASE_URL = 'http://localhost:8003/api';

// Types
export interface RepoRequest {
  repo_url: string;
  access_token?: string;
}

// API functions for GitHub tab

/**
 * Fetch GitHub repository as ZIP
 * POST /api/github/fetch-zip
 */
export async function fetchGithubRepo(repoRequest: RepoRequest): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/github/fetch-zip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(repoRequest),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch repository');
  }

  return response.text();
}

/**
 * Generate graph from GitHub repository
 * POST /api/github/generate-graph
 */
export async function generateGraphFromGithub(repoRequest: RepoRequest): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/github/generate-graph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(repoRequest),
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate graph from GitHub repository');
    } catch {
      throw new Error('Failed to generate graph from GitHub repository');
    }
  }

  return response.json();
}

// API functions for Local ZIP tab

/**
 * Upload local ZIP file
 * POST /api/local/upload-zip
 */
export async function uploadLocalZip(file: File): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('zip_file', file);

  const response = await fetch(`${API_BASE_URL}/local/upload-zip`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to process zip file');
  }

  const text = await response.text();
  return { text };
}

/**
 * Generate graph from uploaded ZIP file
 * POST /api/local/generate-graph
 */
export async function generateGraphFromZip(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('zip_file', file);

  const response = await fetch(`${API_BASE_URL}/local/generate-graph`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    try {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate graph from ZIP file');
    } catch {
      throw new Error('Failed to generate graph from ZIP file');
    }
  }

  return response.json();
}
