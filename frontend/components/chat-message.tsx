"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bot, User, Copy, Check, Clock, Code, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useTheme } from "next-themes"

interface Message {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  context_used?: string | null
  metadata?: Record<string, any> | null
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const { theme } = useTheme()
  const isUser = message.role === "user"
  const isSystem = message.role === "system"

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-muted/50 text-muted-foreground text-xs px-3 py-1 rounded-full border border-border/30">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("group flex gap-4 max-w-full", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center border-2",
            isUser
              ? "bg-primary text-primary-foreground border-primary/20"
              : "bg-background text-muted-foreground border-border/50",
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
      </div>

      {/* Message Content */}
      <div className={cn("flex-1 min-w-0 space-y-2", isUser && "flex flex-col items-end")}>
        {/* Message Bubble */}
        <div
          className={cn(
            "relative max-w-[85%] rounded-2xl px-4 py-3 shadow-sm border",
            isUser
              ? "bg-primary text-primary-foreground border-primary/20 rounded-tr-md"
              : "bg-background text-foreground border-border/50 rounded-tl-md",
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "")
                    return !inline && match ? (
                      <div className="relative group/code">
                        <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-t-lg border-b border-border/30">
                          <div className="flex items-center gap-2">
                            <Code className="h-3 w-3" />
                            <span className="text-xs font-medium">{match[1]}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(String(children))}
                            className="h-6 px-2 opacity-0 group-hover/code:opacity-100 transition-opacity"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <SyntaxHighlighter
                          style={theme === "dark" ? oneDark : oneLight}
                          language={match[1]}
                          PreTag="div"
                          className="!mt-0 !rounded-t-none"
                          {...props}
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code
                        className="bg-muted/50 text-foreground px-1.5 py-0.5 rounded text-xs font-mono border border-border/30"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                  p: ({ children }) => <p className="text-sm leading-relaxed mb-3 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="text-sm space-y-1 ml-4 mb-3">{children}</ul>,
                  ol: ({ children }) => <ol className="text-sm space-y-1 ml-4 mb-3">{children}</ol>,
                  h1: ({ children }) => <h1 className="text-base font-semibold mb-2 mt-4 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-sm font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-medium mb-2 mt-3 first:mt-0">{children}</h3>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Message Footer */}
        <div
          className={cn(
            "flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity",
            isUser && "justify-end",
          )}
        >
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTime(message.timestamp)}</span>
          </div>

          {!isUser && (
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-xs hover:bg-muted/50">
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          )}

          {message.context_used && (
            <Badge variant="secondary" className="text-xs h-5">
              <FileText className="h-2 w-2 mr-1" />
              Context
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
