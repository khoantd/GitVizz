"use client";

import React, { useState } from "react";
import { Header } from "@/components/header";
import { ReactFlowProvider } from "@xyflow/react";
import ReactFlowCodeViewer from "@/components/ReactFlowCodeViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SigmaGraph from "@/components/sigma-graph";

// Sample code graph data
const sampleGraphData = {
  nodes: [
    {
      id: "node-1",
      label: "App Component",
      type: "class",
      module: "app/page.tsx",
      code: `export default function Home() {
  return (
    <div className="min-h-screen p-6">
      <Header />
      <main className="space-y-8">
        <RepoTabs />
      </main>
    </div>
  );
}`,
    },
    {
      id: "node-2",
      label: "Header Component",
      type: "function",
      module: "components/header.tsx",
      code: `export function Header() {
  return (
    <header className="flex items-center justify-between pb-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Repo Explorer</h1>
      </div>
      <ThemeToggle />
    </header>
  );
}`,
    },
    {
      id: "node-3",
      label: "ThemeToggle",
      type: "function",
      module: "components/theme-toggle.tsx",
      code: `export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <SunIcon className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}`,
    },
    {
      id: "node-4",
      label: "RepoTabs",
      type: "function",
      module: "components/repo-tabs.tsx",
      code: `export function RepoTabs() {
  const [activeTab, setActiveTab] = useState<string>("github");
  
  return (
    <Tabs defaultValue="github" onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="github">GitHub Repository</TabsTrigger>
        <TabsTrigger value="local">Local ZIP File</TabsTrigger>
      </TabsList>
      <TabsContent value="github" className="py-6">
        <GithubForm
          onOutput={handleOutput}
          onError={setError}
          onLoading={() => setLoading(true)}
        />
      </TabsContent>
      <TabsContent value="local" className="py-6">
        <LocalZipForm
          onOutput={handleOutput}
          onError={setError}
          onLoading={() => setLoading(true)}
        />
      </TabsContent>
    </Tabs>
  );
}`,
    },
    {
      id: "node-5",
      label: "GithubForm",
      type: "function",
      module: "components/forms/github-form.tsx",
      code: `export function GithubForm({ onOutput, onError, onLoading }: GithubFormProps) {
  const [repoUrl, setRepoUrl] = useState("");
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onLoading();
    
    try {
      const formattedText = await fetchGithubRepo({ 
        repo_url: repoUrl 
      });
      onOutput(formattedText, 'github', { repo_url: repoUrl });
    } catch (error) {
      onError(error instanceof Error ? error.message : "An error occurred");
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields here */}
    </form>
  );
}`,
    },
    {
      id: "node-6",
      label: "LocalZipForm",
      type: "function",
      module: "components/forms/local-zip-form.tsx",
      code: `export function LocalZipForm({ onOutput, onError, onLoading }: LocalZipFormProps) {
  const [file, setFile] = useState<File | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    onLoading();
    
    try {
      const { text } = await uploadLocalZip(file);
      onOutput(text, 'zip', file);
    } catch (error) {
      onError(error instanceof Error ? error.message : "An error occurred");
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields here */}
    </form>
  );
}`,
    },
  ],
  edges: [
    {
      source: "node-1",
      target: "node-2",
      type: "imports",
    },
    {
      source: "node-1",
      target: "node-4",
      type: "imports",
    },
    {
      source: "node-2",
      target: "node-3",
      type: "imports",
    },
    {
      source: "node-4",
      target: "node-5",
      type: "imports",
    },
    {
      source: "node-4",
      target: "node-6",
      type: "imports",
    },
  ],
};

export default function FlowPage() {
  const [activeTab, setActiveTab] = useState("reactflow");
  const graphData = sampleGraphData;

  return (
    <div className="min-h-screen p-6 md:p-8 lg:p-12 max-w-7xl mx-auto">
      <Header />

      <div className="mt-8">
        <h1 className="text-3xl font-bold">Code Graph Visualization</h1>
        <p className="text-muted-foreground mt-2">
          Explore your code structure with interactive visualizations.
        </p>
      </div>

      <Tabs className="mt-8" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reactflow">ReactFlow Visualization</TabsTrigger>
          <TabsTrigger value="sigma">Sigma Visualization</TabsTrigger>
        </TabsList>
        <TabsContent value="reactflow" className="mt-4">
          <div className="border border-border rounded-lg overflow-hidden h-[600px]">
            <ReactFlowProvider>
              <ReactFlowCodeViewer graphData={graphData} />
            </ReactFlowProvider>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              Click on any node to view the code in the Codeium editor. You can
              pan, zoom, and rearrange nodes.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="sigma" className="mt-4">
          <div className="border border-border rounded-lg overflow-hidden h-[600px]">
            <SigmaGraph data={graphData} />
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              The Sigma visualization provides a traditional graph view with
              different interaction patterns.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="text-2xl font-bold mb-4">About the Visualizations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border rounded-lg p-6">
            <h3 className="text-xl font-bold">ReactFlow</h3>
            <p className="mt-2 text-muted-foreground">
              ReactFlow provides a highly interactive graph visualization with
              the ability to zoom in and directly view code snippets using the
              Codeium editor. It&apos;s perfect for exploring code relationships
              and understanding implementation details.
            </p>
          </div>
          <div className="border border-border rounded-lg p-6">
            <h3 className="text-xl font-bold">Sigma</h3>
            <p className="mt-2 text-muted-foreground">
              Sigma offers a performance-focused graph visualization that can
              handle larger graphs. It provides different layout algorithms and
              visual styling options to help you understand your code structure
              at a higher level.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
