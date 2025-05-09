"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { generateGraphFromGithub, generateGraphFromZip } from "@/utils/api";
import SigmaGraph from "./sigma-graph";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Download } from "lucide-react";

interface GraphVisualizationProps {
  onError: (error: string) => void;
  formattedText?: string;
  externalGraphData?: any;
  sourceType?: 'github' | 'zip';
  sourceData?: any; // GitHub URL or ZIP file
}

export function GraphVisualization({ onError, formattedText, externalGraphData, sourceType, sourceData }: GraphVisualizationProps) {
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<any>(externalGraphData || null);
  const [error, setError] = useState<string | null>(null);
  
  // Update graphData when externalGraphData changes
  useEffect(() => {
    if (externalGraphData) {
      setGraphData(externalGraphData);
    }
  }, [externalGraphData]);

  // Generate graph based on source type (GitHub URL or ZIP file)
  useEffect(() => {
    if (sourceType && sourceData) {
      generateGraphFromSource();
    } else if (formattedText) {
      // Extract GitHub URL from formatted text if available
      const githubUrlMatch = formattedText.match(/https:\/\/github\.com\/[\w-]+\/[\w-]+/);
      if (githubUrlMatch) {
        const repoUrl = githubUrlMatch[0];
        generateGraphFromGithubUrl(repoUrl);
      } else {
        setError("Unable to determine source type for visualization");
        onError("Unable to determine source type for visualization");
      }
    }
  }, [sourceType, sourceData, formattedText]);

  const generateGraphFromGithubUrl = async (repoUrl: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await generateGraphFromGithub({ repo_url: repoUrl });
      setGraphData(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate graph from GitHub URL";
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const generateGraphFromSource = async () => {
    if (!sourceType || !sourceData) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let result;
      
      if (sourceType === 'github') {
        // For GitHub repositories
        result = await generateGraphFromGithub(sourceData);
      } else if (sourceType === 'zip') {
        // For ZIP file uploads
        result = await generateGraphFromZip(sourceData);
      }
      
      if (result) {
        setGraphData(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to generate graph from ${sourceType}`;
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 border border-border rounded-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Code Structure Graph</h2>
        {graphData && (
          <Button
            onClick={() => {
              // Create a download link for the graph data
              const dataStr = JSON.stringify(graphData, null, 2);
              const dataBlob = new Blob([dataStr], {type: 'application/json'});
              const url = URL.createObjectURL(dataBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'graph_data.json';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Download Graph Data
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {loading && (
        <div className="flex justify-center my-8">
          <div className="w-10 h-10 border-4 border-primary/20 border-l-primary rounded-full animate-spin"></div>
        </div>
      )}
      
      {!loading && graphData && (
        <div className="mt-4 h-[600px]">
          <SigmaGraph data={graphData} />
        </div>
      )}
      
      {!loading && !graphData && !error && (
        <div className="flex justify-center items-center h-[200px] bg-muted/20 rounded-md">
          <p className="text-muted-foreground">Processing repository to generate graph visualization</p>
        </div>
      )}
    </div>  
  );
}
