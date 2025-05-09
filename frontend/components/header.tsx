"use client";

import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="text-center mb-8">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent mb-2">
          Repo2Txt
        </h1>
        <ThemeToggle />
      </div>
      <p className="text-muted-foreground text-lg">
        Convert GitHub repositories or local files to plain text
      </p>
    </header>
  );
}
