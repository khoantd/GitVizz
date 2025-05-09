"use client";

import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Download, BarChart, Code } from "lucide-react";
import { LocalZipForm } from "@/components/forms/local-zip-form";
import { GraphVisualization } from "@/components/graph-visualization";
import { GithubForm } from "./forms/github-form";
import { CodeViewerSheet } from "./CodeViewerSheet";

export function RepoTabs() {
  const [activeTab, setActiveTab] = useState("github");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [sourceData, setSourceData] = useState<any>(null);
  const [sourceType, setSourceType] = useState<"github" | "zip" | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  const handleOutput = (text: string, type?: "github" | "zip", data?: any) => {
    setOutput(text);
    setLoading(false);
    setError(null);
    setCopySuccess(false);
    if (type && data) {
      setSourceType(type);
      setSourceData(data);
    }
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
  };

  const handleLoading = () => {
    setLoading(true);
    setError(null);
    setOutput(null);
  };

  return (
    <div className="w-full">
      {error && (
        <div className="bg-destructive/20 text-destructive p-4 rounded-md mb-4 font-medium">
          {error}
        </div>
      )}

      <Tabs
        defaultValue="github"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="github">GitHub URL</TabsTrigger>
          <TabsTrigger value="local-zip">ZIP Upload</TabsTrigger>
        </TabsList>
        <TabsContent value="github">
          <GithubForm
            onOutput={handleOutput}
            onError={handleError}
            onLoading={handleLoading}
          />
        </TabsContent>
        <TabsContent value="local-zip">
          <LocalZipForm
            onOutput={(text, file) => handleOutput(text, "zip", file)}
            onError={handleError}
            onLoading={handleLoading}
          />
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="flex justify-center my-8">
          <div className="w-10 h-10 border-4 border-primary/20 border-l-primary rounded-full animate-spin"></div>
        </div>
      )}

      {output && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Output</h2>
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  if (output) {
                    const blob = new Blob([output], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "repository_content.txt";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                }}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                onClick={() => {
                  if (output) {
                    navigator.clipboard.writeText(output);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }
                }}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Copy className="h-4 w-4" />
                {copySuccess ? "Copied!" : "Copy"}
              </Button>
              <Button
                onClick={() => setShowGraph(!showGraph)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <BarChart className="h-4 w-4" />
                {showGraph ? "Hide Graph" : "Show Graph"}
              </Button>
              <Button
                onClick={() => setShowCode(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Code className="h-4 w-4" />
                View Code
              </Button>
            </div>
          </div>
          <div className="bg-muted p-4 rounded-md overflow-auto max-h-[500px]">
            <pre ref={outputRef} className="whitespace-pre-wrap break-all">
              {output}
            </pre>
          </div>
        </div>
      )}

      {showGraph && output && (
        <GraphVisualization
          onError={handleError}
          formattedText={output}
          sourceType={sourceType || undefined}
          sourceData={sourceData}
        />
      )}

      {/* Code Viewer Sheet */}
      <CodeViewerSheet
        isOpen={showCode}
        onClose={() => setShowCode(false)}
        repoContent={output}
      />
    </div>
  );
}
