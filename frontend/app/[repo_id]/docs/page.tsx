"use client"

import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getRepositoryDocumentation } from '@/utils/api'
import { useEffect, useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  FileText, 
  Clock, 
  Eye, 
  Github, 
  Menu, 
  X,
  ChevronRight,
  BookOpen,
  Code2,
  Loader2,
  Link
} from "lucide-react"
import { cn } from "@/lib/utils"

// Markdown and Syntax Highlighting imports
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

// --- Improved Mermaid Diagram Component ---
const MermaidDiagram = ({ code }) => {
  const ref = useRef(null)
  const [hasRendered, setHasRendered] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setHasRendered(false)
    setError(false)
  }, [code])

  useEffect(() => {
    if (ref.current && code && !hasRendered) {
      import('mermaid').then(mermaid => {
        mermaid.default.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            primaryColor: '#3b82f6',
            primaryTextColor: '#1e293b',
            primaryBorderColor: '#e2e8f0',
            lineColor: '#64748b',
            secondaryColor: '#f1f5f9',
            tertiaryColor: '#f8fafc',
            background: '#ffffff',
            mainBkg: '#ffffff',
            secondBkg: '#f8fafc',
            tertiaryBkg: '#f1f5f9',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px'
          },
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
          },
          sequence: {
            useMaxWidth: true,
            wrap: true
          },
          gantt: {
            useMaxWidth: true
          }
        })
        
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`
        ref.current.innerHTML = `<div id="${id}" class="mermaid-container">${code}</div>`
        
        try {
          mermaid.default.run({ nodes: [ref.current.querySelector(`#${id}`)] })
          setHasRendered(true)
        } catch (e) {
          setError(true)
          ref.current.innerHTML = `
            <div class="p-4 text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <span class="font-medium">Diagram Error</span>
              </div>
              <p class="text-sm">Unable to render this Mermaid diagram. Please check the syntax.</p>
            </div>
          `
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
        style={{ minWidth: 'fit-content' }}
      />
    </div>
  )
}

// --- Main Markdown Renderer Component ---
const MarkdownRenderer = ({ content, sidebarNav, onNavItemClick }) => {
  const components = {
    a: ({ node, ...props }) => {
      const href = props.href || ''
      if (href.startsWith('http')) {
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
      if (href.endsWith('.md')) {
        const navItem = sidebarNav.find(item => item.filename === href)
        if (navItem) {
          return (
            <a 
              {...props} 
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onNavItemClick(navItem)
              }}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline font-medium"
            />
          )
        }
      }
      return <a {...props} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline" />
    },
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : ''

      if (lang === 'mermaid') {
        return <MermaidDiagram code={String(children).trim()} />
      }

      return !inline && lang ? (
        <div className="my-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={lang}
            PreTag="div"
            className="!m-0 !bg-slate-900"
            customStyle={{
              fontSize: '14px',
              lineHeight: '1.5',
              padding: '1rem'
            }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-1 rounded-md text-sm font-mono" {...props}>
          {children}
        </code>
      )
    },
    h1: ({ node, ...props }) => (
      <h1 className="text-3xl font-bold mt-8 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" {...props} />
    ),
    h2: ({ node, ...props }) => (
      <h2 className="text-2xl font-semibold mt-6 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" {...props} />
    ),
    h3: ({ node, ...props }) => (
      <h3 className="text-xl font-semibold mt-6 mb-3 text-slate-900 dark:text-slate-100" {...props} />
    ),
    h4: ({ node, ...props }) => (
      <h4 className="text-lg font-semibold mt-5 mb-2 text-slate-900 dark:text-slate-100" {...props} />
    ),
    h5: ({ node, ...props }) => (
      <h5 className="text-base font-semibold mt-4 mb-2 text-slate-900 dark:text-slate-100" {...props} />
    ),
    h6: ({ node, ...props }) => (
      <h6 className="text-sm font-semibold mt-4 mb-2 text-slate-900 dark:text-slate-100" {...props} />
    ),
    ul: ({ node, ...props }) => (
      <ul className="list-disc pl-6 my-4 space-y-2 text-slate-700 dark:text-slate-300" {...props} />
    ),
    ol: ({ node, ...props }) => (
      <ol className="list-decimal pl-6 my-4 space-y-2 text-slate-700 dark:text-slate-300" {...props} />
    ),
    li: ({ node, ...props }) => (
      <li className="leading-relaxed" {...props} />
    ),
    p: ({ node, ...props }) => (
      <p className="leading-7 my-4 text-slate-700 dark:text-slate-300" {...props} />
    ),
    blockquote: ({ node, ...props }) => (
      <blockquote className="pl-4 italic border-l-4 border-blue-500 my-4 bg-blue-50 dark:bg-blue-950/20 py-2 text-slate-700 dark:text-slate-300" {...props} />
    ),
    table: ({ node, ...props }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700" {...props} />
      </div>
    ),
    th: ({ node, ...props }) => (
      <th className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-left font-semibold text-slate-900 dark:text-slate-100" {...props} />
    ),
    td: ({ node, ...props }) => (
      <td className="border border-slate-200 dark:border-slate-700 px-4 py-2 text-slate-700 dark:text-slate-300" {...props} />
    ),
    img: ({ node, ...props }) => (
      <img className="max-w-full h-auto rounded-lg shadow-md my-4" {...props} />
    ),
    hr: ({ node, ...props }) => (
      <hr className="my-6 border-slate-200 dark:border-slate-700" {...props} />
    )
  }

  return (
    <ReactMarkdown
      components={components}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSlug]}
    >
      {content}
    </ReactMarkdown>
  )
}

// --- The Main Page Component ---
const DocumentationPage = () => {
  const { repo_id } = useParams()
  const { data: session } = useSession()

  const [documentation, setDocumentation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeContent, setActiveContent] = useState(null)
  const [activeFilename, setActiveFilename] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const fetchDocumentation = async () => {
      if (session?.jwt_token && repo_id) {
        try {
          setLoading(true)
          const docs = await getRepositoryDocumentation(session.jwt_token, repo_id)
          
          if (!docs || !docs.success || !docs.data) {
            throw new Error(docs?.message || 'Invalid documentation format received.');
          }

          setDocumentation(docs)
          
          if (docs.data?.content && docs.data?.navigation?.sidebar) {
            // Find README with better matching (case-insensitive, with or without extension)
            const readmeItem = docs.data.navigation.sidebar.find(item => {
              const filename = item.filename.toLowerCase()
              return filename === 'readme.md' || 
                     filename === 'readme.txt' || 
                     filename === 'readme' ||
                     filename.startsWith('readme.')
            })
            
            if (readmeItem) {
              handleNavItemClick(readmeItem, docs)
            } else {
              // Look for index files as fallback
              const indexItem = docs.data.navigation.sidebar.find(item => {
                const filename = item.filename.toLowerCase()
                return filename === 'index.md' || 
                       filename === 'index.txt' || 
                       filename === 'index' ||
                       filename.startsWith('index.')
              })
              
              if (indexItem) {
                handleNavItemClick(indexItem, docs)
              } else {
                // Fallback to the first item in the sidebar
                const firstItem = docs.data.navigation.sidebar[0]
                if (firstItem) handleNavItemClick(firstItem, docs)
              }
            }
          }
        } catch (err) {
          setError(err.message || 'Failed to fetch documentation')
        } finally {
          setLoading(false)
        }
      }
    }

    fetchDocumentation()
  }, [session?.jwt_token, repo_id])

  const handleNavItemClick = (item, docs = documentation) => {
    if (!docs || !docs.data || !docs.data.content) return;
    
    const contentKey = Object.keys(docs.data.content).find(
      key => docs.data.content[key].metadata.filename === item.filename
    )

    if (contentKey && docs.data.content?.[contentKey]) {
      setActiveContent(docs.data.content[contentKey])
      setActiveFilename(item.filename)
      setSidebarOpen(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 p-8 rounded-2xl bg-background/80 backdrop-blur-2xl border border-border/50 shadow-xl max-w-md">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
            <X className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Error Loading Documentation</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => window.location.reload()} className="rounded-xl">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!documentation || !documentation.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 p-8 rounded-2xl bg-background/80 backdrop-blur-2xl border border-border/50 shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">No Documentation Found</h3>
            <p className="text-sm text-muted-foreground">No documentation data available for this repository.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="absolute top-0 left-0 right-0 h-32 sm:h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center justify-between p-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => window.history.back()} 
              className="h-9 w-9 rounded-xl shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium truncate">Documentation</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {documentation?.data?.repository?.name && (
              <div className="hidden sm:flex items-center gap-2 bg-background/90 backdrop-blur-xl rounded-xl px-3 py-1.5 border border-border/60 max-w-[200px]">
                <Github className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium truncate">{documentation.data.repository.name}</span>
              </div>
            )}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="h-9 w-9 rounded-xl lg:hidden shrink-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={cn(
          "fixed inset-y-0 left-0 z-30 w-80 bg-background/95 backdrop-blur-xl border-r border-border/30 transform transition-transform duration-300",
          "lg:relative lg:translate-x-0 lg:bg-transparent lg:backdrop-blur-none lg:w-80 xl:w-96",
          "overflow-hidden", // Prevent content overflow
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {/* Header for mobile */}
          <div className="flex items-center justify-between p-4 border-b border-border/30 lg:hidden">
            <h2 className="text-lg font-semibold">Navigation</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSidebarOpen(false)} 
              className="h-8 w-8 rounded-xl"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Sidebar content */}
          <div className="p-4 lg:p-6 h-full overflow-y-auto">
            {/* Analysis section */}
            {documentation?.data?.analysis && (
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

            {/* Navigation section */}
            {documentation?.data?.navigation?.sidebar && (
              <div className="space-y-2">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentation
                </h3>
                {documentation.data.navigation.sidebar.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleNavItemClick(item)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 group hover:bg-muted/50",
                      activeFilename === item.filename 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="text-base shrink-0">{item.emoji || "📄"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.filename}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 lg:ml-0">
          <div className="p-4 lg:p-6 max-w-none lg:max-w-4xl xl:max-w-5xl mx-auto">
            {activeContent ? (
              <div className="space-y-6">
                {/* Content header */}
                <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl p-4 lg:p-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2 break-words">
                        {activeContent.metadata?.filename || 'Documentation'}
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

                {/* Content body */}
                <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden">
                  <article className="p-4 lg:p-6 xl:p-8 overflow-x-auto">
                    <MarkdownRenderer 
                      content={activeContent.content || activeContent.preview || ''}
                      sidebarNav={documentation?.data?.navigation?.sidebar || []}
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
                    <p className="text-sm text-muted-foreground">Select a document from the sidebar to view its content</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

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

export default DocumentationPage