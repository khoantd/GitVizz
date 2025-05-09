"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { RepoTabs } from "@/components/repo-tabs";

export default function Home() {
  const [error] = useState<string | null>(null);

  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-12 max-w-7xl mx-auto">
      <Header />

      {error && (
        <div className="bg-destructive/20 text-destructive p-4 rounded-md mb-6 font-medium">
          {error}
        </div>
      )}

      <main className="space-y-8">
        <RepoTabs />
      </main>

      <footer className="mt-16 pt-8 border-t border-border text-center text-sm text-muted-foreground">
        <p>
          © {new Date().getFullYear()} Repo2Txt - Convert GitHub repositories or
          local files to plain text
        </p>
        <div className="flex gap-4 justify-center mt-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://nextjs.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Next.js
          </a>
        </div>
      </footer>
    </div>
  );
}
