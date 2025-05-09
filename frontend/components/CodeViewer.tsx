"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import {
  Folder,
  File,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  CopyCheck,
  Search,
  FilePlus,
  Expand,
  MinusCircle,
  Settings,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  content?: string;
  children?: FileNode[];
}

interface CodeViewerProps {
  repoContent: string;
  className?: string;
}

export function CodeViewer({ repoContent, className }: CodeViewerProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"explorer" | "search">("explorer");
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);

  // Parse repository structure from formatted text
  useEffect(() => {
    if (repoContent) {
      try {
        const tree = parseRepositoryStructure(repoContent);
        setFileTree(tree);
      } catch (error) {
        console.error("Error parsing repo structure:", error);
      }
    }
  }, [repoContent]);

  // Function to handle editor mount
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const parseRepositoryStructure = (text: string): FileNode[] => {
    const tree: FileNode[] = [];
    const rootMap: Record<string, FileNode> = {};

    // Extract files and their content
    const fileContentSections = text.split("---\nFile:").slice(1);

    // Process each file
    fileContentSections.forEach((section) => {
      const firstNewlineIndex = section.indexOf("\n");
      const filePath = section.substring(0, firstNewlineIndex).trim();
      const content = section.substring(section.indexOf("\n---\n") + 5).trim();

      // Create file hierarchy
      const pathParts = filePath.split("/");
      let currentPath = "";
      let parentPath = "";

      // Create directory nodes
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!rootMap[currentPath]) {
          const dirNode: FileNode = {
            name: part,
            path: currentPath,
            type: "directory",
            children: [],
          };
          rootMap[currentPath] = dirNode;

          if (parentPath) {
            rootMap[parentPath].children = rootMap[parentPath].children || [];
            rootMap[parentPath].children!.push(dirNode);
          } else {
            tree.push(dirNode);
          }
        }
      }

      // Create file node
      const fileName = pathParts[pathParts.length - 1];
      const fileNode: FileNode = {
        name: fileName,
        path: filePath,
        type: "file",
        content: content,
      };

      if (currentPath) {
        rootMap[currentPath].children = rootMap[currentPath].children || [];
        rootMap[currentPath].children!.push(fileNode);
      } else {
        tree.push(fileNode);
      }
    });

    return tree;
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const expandAllFolders = () => {
    const allPaths = new Set<string>();

    // Recursive function to collect all directory paths
    const collectDirPaths = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (node.type === "directory") {
          allPaths.add(node.path);
          if (node.children) {
            collectDirPaths(node.children);
          }
        }
      });
    };

    collectDirPaths(fileTree);
    setExpandedFolders(allPaths);
  };

  const collapseAllFolders = () => {
    setExpandedFolders(new Set());
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
  };

  const copyFileContent = (file: FileNode) => {
    if (file.content) {
      navigator.clipboard.writeText(file.content);
      setCopyStatus((prev) => ({ ...prev, [file.path]: true }));
      setTimeout(() => {
        setCopyStatus((prev) => ({ ...prev, [file.path]: false }));
      }, 2000);
    }
  };

  const copyAllContent = () => {
    const allContent = getAllContent(fileTree);
    navigator.clipboard.writeText(allContent);
    setCopyStatus((prev) => ({ ...prev, all: true }));
    setTimeout(() => {
      setCopyStatus((prev) => ({ ...prev, all: false }));
    }, 2000);
  };

  const getAllContent = (nodes: FileNode[]): string => {
    let content = "";
    nodes.forEach((node) => {
      if (node.type === "file" && node.content) {
        content += `// File: ${node.path}\n${node.content}\n\n`;
      } else if (node.type === "directory" && node.children) {
        content += getAllContent(node.children);
      }
    });
    return content;
  };

  // Determine language based on file extension
  const getLanguage = (filePath: string): string => {
    const fileExtension = filePath.split(".").pop()?.toLowerCase() || "";
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
      sh: "shell",
      bash: "shell",
      java: "java",
      c: "c",
      cpp: "cpp",
      cs: "csharp",
      go: "go",
      rb: "ruby",
      php: "php",
      rust: "rust",
      rs: "rust",
      swift: "swift",
      kt: "kotlin",
      scala: "scala",
    };

    return languageMap[fileExtension] || "plaintext";
  };

  // Filter files by search term
  const filterFilesBySearch = (nodes: FileNode[]): FileNode[] => {
    if (!searchTerm) return [];

    const results: FileNode[] = [];
    const searchLower = searchTerm.toLowerCase();

    const searchNodes = (nodeList: FileNode[]) => {
      nodeList.forEach((node) => {
        if (node.name.toLowerCase().includes(searchLower)) {
          results.push(node);
        }
        if (
          node.type === "file" &&
          node.content &&
          node.content.toLowerCase().includes(searchLower)
        ) {
          if (!results.includes(node)) {
            results.push(node);
          }
        }
        if (node.type === "directory" && node.children) {
          searchNodes(node.children);
        }
      });
    };

    searchNodes(nodes);
    return results;
  };

  const renderTree = (nodes: FileNode[], level = 0): JSX.Element[] => {
    return nodes
      .sort((a, b) => {
        // Sort directories first, then files
        if (a.type === "directory" && b.type === "file") return -1;
        if (a.type === "file" && b.type === "directory") return 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => {
        const isExpanded = expandedFolders.has(node.path);

        if (node.type === "directory") {
          return (
            <div key={node.path}>
              <div
                className={cn(
                  "flex items-center py-1 px-2 cursor-pointer hover:bg-accent rounded-sm group",
                  level > 0 && "ml-2"
                )}
                onClick={() => toggleFolder(node.path)}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 mr-1 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-1 flex-shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 mr-1 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 mr-1 text-blue-500 flex-shrink-0" />
                )}
                <span className="text-sm truncate flex-grow">{node.name}</span>
              </div>
              {isExpanded && node.children && (
                <div className="ml-2 border-l border-border pl-2">
                  {renderTree(node.children, level + 1)}
                </div>
              )}
            </div>
          );
        } else {
          return (
            <div key={node.path} className="group">
              <div
                className={cn(
                  "flex items-center py-1 px-2 cursor-pointer hover:bg-accent rounded-sm",
                  level > 0 && "ml-2",
                  selectedFile?.path === node.path &&
                    "bg-accent text-accent-foreground"
                )}
                onClick={() => handleFileSelect(node)}
              >
                <File className="w-4 h-4 mr-1 flex-shrink-0" />
                <span className="text-sm truncate flex-grow">{node.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyFileContent(node);
                  }}
                  aria-label="Copy file content"
                >
                  {copyStatus[node.path] ? (
                    <CopyCheck className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          );
        }
      });
  };

  const renderSearchResults = () => {
    const results = filterFilesBySearch(fileTree);
    if (results.length === 0) {
      return (
        <div className="p-2 text-sm text-muted-foreground">
          No results found
        </div>
      );
    }

    return results.map((file) => (
      <div
        key={file.path}
        className="p-2 cursor-pointer hover:bg-accent rounded-sm flex items-center"
        onClick={() => handleFileSelect(file)}
      >
        {file.type === "file" ? (
          <File className="w-4 h-4 mr-2" />
        ) : (
          <Folder className="w-4 h-4 mr-2" />
        )}
        <span className="text-sm truncate">{file.path}</span>
      </div>
    ));
  };

  return (
    <div
      className={cn("flex h-[90vh] border rounded-md bg-background", className)}
    >
      {/* File explorer sidebar */}
      <div className="w-1/4 overflow-hidden flex flex-col border-r">
        <div className="border-b p-2 flex-shrink-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "explorer" | "search")}
          >
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="explorer">Explorer</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
            </TabsList>
            <TabsContent value="explorer" className="flex flex-col h-full">
              <div className="p-2 border-b flex items-center justify-between flex-shrink-0">
                <div className="flex items-center">
                  <Code className="w-4 h-4 mr-2" />
                  <span className="font-medium text-sm">Files</span>
                </div>
                <div className="flex space-x-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={expandAllFolders}
                        >
                          <Expand className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Expand All</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={collapseAllFolders}
                        >
                          <MinusCircle className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Collapse All</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={copyAllContent}
                        >
                          {copyStatus.all ? (
                            <CopyCheck className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy All Content</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div className="overflow-auto flex-grow">
                {fileTree.length > 0 ? (
                  <div className="p-1">{renderTree(fileTree)}</div>
                ) : (
                  <div className="text-sm text-muted-foreground p-2">
                    No files to display
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="search" className="flex flex-col h-full">
              <div className="p-2 border-b flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    className="w-full pl-8 pr-4 py-2 text-sm rounded-md bg-muted"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-auto flex-grow">
                {searchTerm ? (
                  renderSearchResults()
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    Type to search in files
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Code editor area */}
      <div className="w-3/4 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            <div className="border-b p-2 flex items-center justify-between">
              <div className="flex items-center">
                <File className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium overflow-hidden text-ellipsis">
                  {selectedFile.path}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => copyFileContent(selectedFile)}
              >
                {copyStatus[selectedFile.path] ? (
                  <>
                    <CopyCheck className="w-3 h-3 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="flex-grow">
              <Editor
                height="100%"
                language={getLanguage(selectedFile.path)}
                value={selectedFile.content}
                theme={theme === "dark" ? "vs-dark" : "light"}
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  lineNumbers: "on",
                  renderLineHighlight: "all",
                  scrollbar: {
                    useShadows: true,
                    verticalHasArrows: true,
                    horizontalHasArrows: true,
                    vertical: "visible",
                    horizontal: "visible",
                  },
                }}
                onMount={handleEditorDidMount}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a file to view its contents
          </div>
        )}
      </div>
    </div>
  );
}
