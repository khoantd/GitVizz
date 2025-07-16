"use client"

import type React from "react"

import { useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Lock,
  Loader2,
  BookOpen,
  Code2,
  ChevronRight,
  Folder,
  FolderOpen,
  Link,
  Clock,
  Eye,
  X,
  Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import {
  isWikiGenerated,
  generateWikiDocumentation,
  getWikiGenerationStatus,
  getRepositoryDocumentation,
} from "@/utils/api"

// Markdown and Syntax Highlighting imports
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeSlug from "rehype-slug"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

// Types
interface FileNode {
  type: "file" | "folder"
  name: string
  path: string
  file_count?: number
  children?: FileNode[]
}

interface Documentation {
  success: boolean
  data?: {
    content: Record<string, any>
    folder_structure: FileNode[]
    analysis?: any
    repository?: { name?: string }
  }
  message?: string
}

interface DocumentationTabProps {
  currentRepoId: string
  sourceData: {
    repo_url?: string
  }
  sourceType: string
}

// Mermaid Diagram Component
interface MermaidDiagramProps {
  code: string
}

const MermaidDiagram = ({ code }: MermaidDiagramProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [hasRendered, setHasRendered] = useState(false)
  const [, setError] = useState(false)

  useEffect(() => {
    setHasRendered(false)
    setError(false)
  }, [code])

  useEffect(() => {
    if (ref.current && code && !hasRendered) {
      import("mermaid").then((mermaid) => {
        mermaid.default.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            primaryColor: "#3b82f6",
            primaryTextColor: "#1e293b",
            primaryBorderColor: "#e2e8f0",
            lineColor: "#64748b",
            secondaryColor: "#f1f5f9",
            tertiaryColor: "#f8fafc",
            background: "#ffffff",
            mainBkg: "#ffffff",
            secondBkg: "#f8fafc",
            tertiaryBkg: "#f1f5f9",
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: "14px",
          },
          securityLevel: "loose",
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
          sequence: { useMaxWidth: true, wrap: true },
          gantt: { useMaxWidth: true },
        })

        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`
        if (ref.current) {
          ref.current.innerHTML = `<div id="${id}" class="mermaid-container">${code}</div>`
        }

        try {
          if (ref.current) {
            const el = ref.current.querySelector(`#${id}`)
            if (el instanceof HTMLElement) {
              mermaid.default.run({ nodes: [el] })
            }
          }
          setHasRendered(true)
        } catch (e) {
          setError(true)
          if (ref.current) {
            ref.current.innerHTML = `
              <div class="p-4 text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <span class="font-medium">Diagram Error</span>
                </div>
                <p class="text-sm">Unable to render this Mermaid diagram. Please check the syntax.</p>
              </div>
            `
          }
          console.error("Mermaid rendering error:", e)
        }
      })
    }
  }, [code, hasRendered])

  return (
    <div className="my-6 w-full overflow-x-auto">
      <div
        ref={ref}
        className="flex justify-center items-center min-h-[200px] p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
        style={{ minWidth: "fit-content" }}
      />
    </div>
  )
}

// Markdown Renderer Component
interface MarkdownRendererProps {
  content: string
  onNavItemClick: (filePath: string) => void
}

const MarkdownRenderer = ({ content, onNavItemClick }: MarkdownRendererProps) => {
  const components = {
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      const href = props.href || ""
      if (href.startsWith("http")) {
        return (
          <a
            {...props}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1"
          >
            {props.children}
            <Link className="w-3 h-3" />
          </a>
        )
      }
      if (href.endsWith(".md")) {
        const filePath = href.replace("./", "").replace(".md", "")
        return (
          <a
            {...props}
            href="#"
            onClick={(e) => {
              e.preventDefault()
              onNavItemClick(filePath)
            }}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-medium"
          />
        )
      }
      return (
        <a
          {...props}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
        />
      )
    },
    code({
      inline,
      className,
      children,
      ...props
    }: { inline?: boolean; className?: string; children: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || "")
      const lang = match ? match[1] : ""

      if (lang === "mermaid") {
        return <MermaidDiagram code={String(children).trim()} />
      }

      return !inline && lang ? (
        <div className="my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={lang}
            PreTag="div"
            className="!m-0 !bg-slate-900"
            customStyle={{ fontSize: "14px", lineHeight: "1.5", padding: "1rem" }}
            {...props}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code
          className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-1 rounded-md text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      )
    },
    h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h1
        className="text-3xl font-bold mt-8 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
        {...props}
      />
    ),
    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h2
        className="text-2xl font-semibold mt-6 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
        {...props}
      />
    ),
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h3 className="text-xl font-semibold mt-6 mb-3 text-slate-900 dark:text-slate-100" {...props} />
    ),
    ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
      <ul className="list-disc pl-6 my-4 space-y-2 text-slate-700 dark:text-slate-300" {...props} />
    ),
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p className="leading-7 my-4 text-slate-700 dark:text-slate-300" {...props} />
    ),
    blockquote: (props: React.HTMLAttributes<HTMLElement>) => (
      <blockquote
        className="pl-4 italic border-l-4 border-blue-500 my-4 bg-blue-50 dark:bg-blue-950/20 py-2 text-slate-700 dark:text-slate-300"
        {...props}
      />
    ),
    table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700" {...props} />
      </div>
    ),
    th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th
        className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-left font-semibold text-slate-900 dark:text-slate-100"
        {...props}
      />
    ),
    td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
      <td
        className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-slate-700 dark:text-slate-300"
        {...props}
      />
    ),
    img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
      <img className="max-w-full h-auto rounded-lg shadow-md my-4" alt={props.alt || ""} {...props} />
    ),
    hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
      <hr className="my-6 border-slate-200 dark:border-slate-700" {...props} />
    ),
  }

  return (
    <ReactMarkdown components={components as any} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSlug]}>
      {content}
    </ReactMarkdown>
  )
}

// File Tree Component
interface FileTreeProps {
  nodes: FileNode[]
  onFileClick: (node: FileNode) => void
  activePath: string | null
  expandedFolders: Set<string>
  toggleFolder: (folderPath: string) => void
  level?: number
}

const FileTree = ({ nodes, onFileClick, activePath, expandedFolders, toggleFolder, level = 0 }: FileTreeProps) => {
  if (!nodes || nodes.length === 0) {
    return null
  }

  return (
    <div className="space-y-1">
      {nodes.map((node: FileNode) => {
        if (node.type === "folder") {
          const isExpanded = expandedFolders.has(node.path)
          return (
            <div key={node.path}>
              <button
                onClick={() => toggleFolder(node.path)}
                className="w-full text-left p-2 rounded-lg flex items-center gap-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                style={{ paddingLeft: `${0.5 + level * 1}rem` }}
              >
                <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", isExpanded && "rotate-90")} />
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0" />
                )}
                <span className="font-medium truncate flex-1">{node.name}</span>
                <span className="text-xs text-muted-foreground">{node.file_count}</span>
              </button>
              {isExpanded && (
                <FileTree
                  nodes={node.children || []}
                  onFileClick={onFileClick}
                  activePath={activePath}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                  level={level + 1}
                />
              )}
            </div>
          )
        } else {
          // file
          return (
            <button
              key={node.path}
              onClick={() => onFileClick(node)}
              className={cn(
                "w-full text-left p-2 rounded-lg flex items-center gap-2 text-sm transition-colors",
                activePath === node.path
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              style={{ paddingLeft: `${0.5 + level * 1.5}rem` }}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{node.name}</span>
            </button>
          )
        }
      })}
    </div>
  )
}

// Main Documentation Tab Component
export default function Documentation({ currentRepoId, sourceData, sourceType }: DocumentationTabProps) {
  const { data: session } = useSession()
  const [isDocGenerated, setIsDocGenerated] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStatus, setCurrentStatus] = useState<string>("")

  // Documentation display states
  const [documentation, setDocumentation] = useState<Documentation | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeContent, setActiveContent] = useState<any>(null)
  const [activePath, setActivePath] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Helper functions
  const findFileInTree = (nodes: FileNode[], predicate: (node: FileNode) => boolean): FileNode | null => {
    for (const node of nodes) {
      if (node.type === "file" && predicate(node)) {
        return node
      }
      if (node.type === "folder" && node.children) {
        const found = findFileInTree(node.children, predicate)
        if (found) return found
      }
    }
    return null
  }

  const getAncestorPaths = (path: string): Set<string> => {
    const parts = path.split("/")
    const ancestors = new Set<string>()
    for (let i = 1; i < parts.length; i++) {
      ancestors.add(parts.slice(0, i).join("/"))
    }
    return ancestors
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ""
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Check documentation status
  const checkDocumentationStatus = useCallback(async () => {
    try {
      if (!session?.jwt_token || !currentRepoId) return

      const wikiResponse = await isWikiGenerated(session.jwt_token, currentRepoId)
      setIsDocGenerated(wikiResponse.is_generated)
      setCurrentStatus(wikiResponse.status)

      if (wikiResponse.error) {
        setError("Try again later or contact support")
      } else {
        setError(null)
      }

      if (wikiResponse.status === "running" || wikiResponse.status === "pending") {
        setIsGenerating(true)
      }
    } catch (err) {
      console.error("Error checking documentation status:", err)
      setError("Failed to check documentation status")
    }
  }, [session?.jwt_token, currentRepoId])

  // Fetch documentation content
  const fetchDocumentation = useCallback(async () => {
    if (!session?.jwt_token || !currentRepoId || !isDocGenerated) return

    try {
      setLoading(true)
      const docs = await getRepositoryDocumentation(session.jwt_token, currentRepoId)

      if (!docs || !docs.success || !docs.data) {
        throw new Error(docs?.message || "Invalid documentation format received.")
      }

      setDocumentation(docs)

      if (docs.data?.content && docs.data?.folder_structure) {
        const initialFile =
          findFileInTree(docs.data.folder_structure, (file) => file.path.toLowerCase() === "readme") ||
          findFileInTree(docs.data.folder_structure, (file) => file.name.toLowerCase() === "readme") ||
          findFileInTree(docs.data.folder_structure, (file) => file.path.toLowerCase() === "index") ||
          findFileInTree(docs.data.folder_structure, (file) => file.name.toLowerCase() === "index") ||
          findFileInTree(docs.data.folder_structure, (file) => file.type === "file")

        if (initialFile) {
          handleNavItemClick(initialFile, docs)
          setExpandedFolders(getAncestorPaths(initialFile.path))
        }
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to fetch documentation")
    } finally {
      setLoading(false)
    }
  }, [session?.jwt_token, currentRepoId, isDocGenerated])

  // Handle navigation item click
  const handleNavItemClick = (item: FileNode | string, docs: Documentation | null = documentation) => {
    if (!docs || !docs.data || !docs.data.content) return

    let fileItem: FileNode | null = null
    if (typeof item === "string") {
      fileItem = findFileInTree(docs.data.folder_structure, (node) => node.path === item)
      if (!fileItem) {
        console.warn(`Could not find file for path: ${item}`)
        return
      }
    } else {
      fileItem = item
    }

    if (fileItem && docs.data.content?.[fileItem.path]) {
      setActiveContent(docs.data.content[fileItem.path])
      setActivePath(fileItem.path)
      setSidebarOpen(false)
    }
  }

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath)
      } else {
        newSet.add(folderPath)
      }
      return newSet
    })
  }

  // Generate documentation
  const handleGenerateDocumentation = async () => {
    if (!session?.jwt_token || !currentRepoId || !sourceData) return

    try {
      setIsGenerating(true)
      setError(null)
      setCurrentStatus("pending")

      let repositoryUrl = ""
      if (sourceType === "github" && sourceData.repo_url) {
        repositoryUrl = sourceData.repo_url
      } else {
        throw new Error("Repository URL not available")
      }

      await generateWikiDocumentation(session?.jwt_token, repositoryUrl, "en", true)
    } catch (err) {
      console.error("Error generating documentation:", err)
      setIsGenerating(false)
      setError(err instanceof Error ? err.message : "Failed to generate documentation")
    }
  }

  // Effects
  useEffect(() => {
    if (session?.jwt_token && currentRepoId) {
      checkDocumentationStatus()
    }
  }, [session?.jwt_token, currentRepoId, checkDocumentationStatus])

  useEffect(() => {
    if (isDocGenerated && !documentation) {
      fetchDocumentation()
    }
  }, [isDocGenerated, documentation, fetchDocumentation])

  // Status polling
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isGenerating && session?.jwt_token && currentRepoId) {
      interval = setInterval(async () => {
        try {
          setIsCheckingStatus(true)
          const statusResponse = await getWikiGenerationStatus(session?.jwt_token, currentRepoId)
          setCurrentStatus(statusResponse.status)

          if (statusResponse.status === "completed") {
            setIsGenerating(false)
            setIsDocGenerated(true)
            setError(null)
          } else if (statusResponse.status === "failed") {
            setIsGenerating(false)
            setError(statusResponse.error || "Documentation generation failed")
          }
        } catch (err) {
          console.error("Error checking status:", err)
        } finally {
          setIsCheckingStatus(false)
        }
      }, 3000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isGenerating, session?.jwt_token, currentRepoId])

  // Render logic
  if (!session?.jwt_token) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4 p-8 rounded-2xl bg-background/80 backdrop-blur-2xl border border-border/50 shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Authentication Required</h3>
            <p className="text-sm text-muted-foreground">Sign in to access documentation features</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-background/80 backdrop-blur-2xl border border-border/50 shadow-xl">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <h3 className="font-medium text-foreground">Loading Documentation</h3>
            <p className="text-sm text-muted-foreground">Fetching repository documentation...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isDocGenerated) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-6 p-8 rounded-2xl bg-background/80 backdrop-blur-2xl border border-border/50 shadow-xl max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            {isGenerating ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <BookOpen className="h-8 w-8 text-primary" />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              {isGenerating ? "Generating Documentation" : "Generate Documentation"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isGenerating
                ? "Please wait while we create comprehensive documentation for your repository..."
                : "Create AI-powered documentation with interactive navigation and detailed analysis."}
            </p>
          </div>

          {isGenerating && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Status: <span className="capitalize font-medium">{currentStatus}</span>
              </div>
              {isCheckingStatus && <div className="text-xs text-muted-foreground">Checking status...</div>}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Button onClick={handleGenerateDocumentation} disabled={isGenerating} className="rounded-xl px-6 py-2">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isCheckingStatus ? "Checking..." : "Generating..."}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Documentation
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  if (!documentation || !documentation.data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4 p-8 rounded-2xl bg-background/80 backdrop-blur-2xl border border-border/50 shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
            <X className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">No Documentation Found</h3>
            <p className="text-sm text-muted-foreground">No documentation data available for this repository.</p>
          </div>
        </div>
      </div>
    )
  }

  // Main documentation display
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-80 bg-background/95 backdrop-blur-xl border-r border-border/30 transform transition-transform duration-300",
          "lg:relative lg:translate-x-0 lg:bg-transparent lg:backdrop-blur-none lg:w-80 xl:w-96",
          "overflow-hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/30 lg:hidden">
          <h2 className="text-lg font-semibold">Navigation</h2>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="h-8 w-8 rounded-xl">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 lg:p-6 h-full overflow-y-auto">
          {documentation?.data?.analysis && Object.keys(documentation.data.analysis).length > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-border/20">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Analysis
              </h3>
              <div className="space-y-2 text-sm">
                {documentation.data.analysis.domain_type && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-lg px-2 py-1 text-xs">
                      {documentation.data.analysis.domain_type}
                    </Badge>
                  </div>
                )}
                {documentation.data.analysis.complexity_score && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Complexity:</span>
                    <span>{documentation.data.analysis.complexity_score}</span>
                  </div>
                )}
                {documentation.data.analysis.languages && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Languages:</span>
                    <span className="text-right break-words">{documentation.data.analysis.languages}</span>
                  </div>
                )}
                {documentation.data.analysis.total_pages && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pages:</span>
                    <span>{documentation.data.analysis.total_pages}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {documentation?.data?.folder_structure && (
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2 px-2">
                <BookOpen className="h-4 w-4" />
                Files
              </h3>
              <FileTree
                nodes={documentation.data.folder_structure}
                onFileClick={handleNavItemClick}
                activePath={activePath}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:ml-0">
        <div className="lg:hidden sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border/30 p-4">
          <Button variant="outline" size="icon" onClick={() => setSidebarOpen(true)} className="h-9 w-9 rounded-xl">
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 lg:p-6 max-w-none lg:max-w-4xl xl:max-w-5xl mx-auto">
          {activeContent ? (
            <div className="space-y-6">
              <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl p-4 lg:p-6">
                <div className="flex flex-col gap-4">
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2 break-words">
                      {activeContent.metadata?.filename || "Documentation"}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      {activeContent.metadata?.size && (
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4 shrink-0" />
                          <span>{formatFileSize(activeContent.metadata.size)}</span>
                        </div>
                      )}
                      {activeContent.read_time && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 shrink-0" />
                          <span>{activeContent.read_time} min read</span>
                        </div>
                      )}
                      {activeContent.word_count && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4 shrink-0" />
                          <span>{activeContent.word_count} words</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {activeContent.metadata?.modified && (
                    <div className="text-sm text-muted-foreground">
                      Last modified: {formatDate(activeContent.metadata.modified)}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden">
                <article className="p-4 lg:p-6 xl:p-8 overflow-x-auto">
                  <MarkdownRenderer
                    content={activeContent.content || activeContent.preview || ""}
                    onNavItemClick={handleNavItemClick}
                  />
                </article>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">No Content Selected</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a document from the sidebar to view its content
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
