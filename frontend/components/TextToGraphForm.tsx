"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormattedTextGraphRequest, generateGraphFromText } from "@/utils/api";
import SigmaGraph from "./sigma-graph";

interface TextToGraphFormProps {
  onError: (error: string) => void;
  formattedText?: string;
}

export function TextToGraphForm({ onError, formattedText: initialText }: TextToGraphFormProps) {
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<any>(null);
  const [text, setText] = useState(initialText || "");
  const [parserOptions, setParserOptions] = useState({
    useAst: false,
    useTreeSitter: false,
    useCodetext: false,
    useLlm: true,
  });

  const handleGenerateGraph = async () => {
    if (!text.trim()) {
      onError("Please provide formatted text to generate a graph");
      return;
    }

    setLoading(true);
    try {
      const request: FormattedTextGraphRequest = {
        text,
        use_ast: parserOptions.useAst,
        use_tree_sitter: parserOptions.useTreeSitter,
        use_codetext: parserOptions.useCodetext,
        use_llm: parserOptions.useLlm,
      };
      
      const result = await generateGraphFromText(request);
      setGraphData(result);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to generate graph from text");
    } finally {
      setLoading(false);
    }
  };

  const toggleParser = (parser: keyof typeof parserOptions) => {
    setParserOptions(prev => ({
      ...prev,
      [parser]: !prev[parser]
    }));
  };

  return (
    <div className="mt-8 border border-border rounded-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Generate Graph from Text</h2>
        <div className="space-x-2">
          <Button 
            onClick={handleGenerateGraph}
            disabled={loading || !text.trim()}
            variant="default"
          >
            {loading ? "Generating..." : "Generate Graph"}
          </Button>
        </div>
      </div>
      
      {!initialText && (
        <div className="mb-4">
          <textarea
            className="w-full h-32 p-2 border border-border rounded-md"
            placeholder="Paste your formatted code text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      )}
      
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="text-sm font-medium mr-2">Parser options:</div>
        <label className="flex items-center space-x-1">
          <input 
            type="checkbox" 
            checked={parserOptions.useAst} 
            onChange={() => toggleParser('useAst')}
            className="rounded border-gray-300"
          />
          <span>AST</span>
        </label>
        <label className="flex items-center space-x-1">
          <input 
            type="checkbox" 
            checked={parserOptions.useTreeSitter} 
            onChange={() => toggleParser('useTreeSitter')}
            className="rounded border-gray-300"
          />
          <span>Tree-sitter</span>
        </label>
        <label className="flex items-center space-x-1">
          <input 
            type="checkbox" 
            checked={parserOptions.useCodetext} 
            onChange={() => toggleParser('useCodetext')}
            className="rounded border-gray-300"
          />
          <span>Codetext</span>
        </label>
        <label className="flex items-center space-x-1">
          <input 
            type="checkbox" 
            checked={parserOptions.useLlm} 
            onChange={() => toggleParser('useLlm')}
            className="rounded border-gray-300"
          />
          <span>LLM</span>
        </label>
      </div>
      
      {loading && (
        <div className="flex justify-center my-8">
          <div className="w-10 h-10 border-4 border-primary/20 border-l-primary rounded-full animate-spin"></div>
        </div>
      )}
      
      {!loading && graphData && (
        <div className="mt-4 h-[600px] border border-border rounded-md overflow-hidden">
          <SigmaGraph 
            formattedText={text}
            useAst={parserOptions.useAst}
            useTreeSitter={parserOptions.useTreeSitter}
            useCodetext={parserOptions.useCodetext}
            useLlm={parserOptions.useLlm}
          />
        </div>
      )}
    </div>
  );
}
