"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchGithubRepo } from "@/utils/api";

interface GithubFormProps {
  onOutput: (
    text: string,
    type?: "github" | "zip",
    data?: Record<string, string>
  ) => void;
  onError: (error: string) => void;
  onLoading: () => void;
}

interface FileItem {
  path: string;
  type: string;
}

export function GithubForm({ onOutput, onError, onLoading }: GithubFormProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [showFileList, setShowFileList] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onLoading();

    try {
      // Create the request object with repo URL and access token
      const requestData = {
        repo_url: repoUrl,
        access_token: accessToken || "",
      };

      // Fetch the repository content directly
      const formattedText = await fetchGithubRepo(requestData);

      // Extract file list from the formatted text for display
      const extractedFiles = formattedText
        .split("=".repeat(80))
        .filter((section) => section.trim())
        .map((section) => {
          const lines = section.trim().split("\n");
          const pathLine = lines[0];
          const path = pathLine.replace("File: ", "");
          return { path, type: "file" };
        });

      setFileList(extractedFiles);
      setShowFileList(true);

      // Pass the formatted text and the request data for graph generation
      onOutput(formattedText, "github", requestData);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="repo-url" className="block font-medium">
          GitHub Repository URL:
        </label>
        <input
          type="text"
          id="repo-url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/username/repo"
          className="w-full p-3 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="access-token" className="font-medium flex items-center">
          GitHub Access Token (optional):
          <span
            className="ml-2 text-sm text-primary cursor-pointer"
            title="Providing a personal access token increases your GitHub API rate limit from 60 to 5000 requests per hour. Required for private repos or large public repos."
          >
            [?]
          </span>
        </label>
        <input
          type="text"
          id="access-token"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="Paste your GitHub token here (optional)"
          className="w-full p-3 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-sm text-muted-foreground">
          Your token will be stored locally and not shared with the server.
          <a
            href="https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline ml-1"
          >
            How to create a GitHub token
          </a>{" "}
          (no special scopes needed for public repos).
        </p>
      </div>

      <Button type="submit" className="w-full">
        Fetch Repository Structure
      </Button>

      {showFileList && fileList.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Files found: {fileList.length}</h3>
          <div className="max-h-[200px] overflow-y-auto border border-input rounded-md p-2">
            <ul className="space-y-1">
              {fileList.map((file, index) => (
                <li key={index} className="text-sm">
                  {file.path}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </form>
  );
}
