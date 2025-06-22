"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Send, History, Key, Bot, Loader2, X, Plus, Settings, ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatMessage } from "./chat-message"
import { ChatHistory } from "./chat-history"
import { ApiKeyManager } from "./api-key-manager"
import { ModelSelector } from "./model-selector"
import { useChatSidebar } from "@/hooks/use-chat-sidebar"

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  repositoryId: string
  repositoryName: string
}

export function ChatSidebar({ isOpen, onClose, repositoryId, repositoryName }: ChatSidebarProps) {
  const {
    messages,
    isLoading,
    currentModel,
    availableModels,
    chatHistory,
    sendMessage,
    loadConversation,
    clearCurrentChat,
    setModel,
    refreshModels,
  } = useChatSidebar(repositoryId)

  const [input, setInput] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [showApiKeys, setShowApiKeys] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [messages])

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const message = input.trim()
    setInput("")
    await sendMessage(message)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const hasActiveChat = messages.length > 0

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[420px] bg-background/95 backdrop-blur-xl border-l border-border/50 shadow-2xl z-50 transition-all duration-300 ease-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header - Prominent and Clean */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
          <div className="relative flex items-center justify-between p-6 border-b border-border/30">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                {isLoading && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
              <div className="space-y-1">
                <h2 className="font-semibold text-base text-foreground">Repository Chat</h2>
                <p className="text-sm text-muted-foreground truncate max-w-[200px]">{repositoryName}</p>
                {hasActiveChat && (
                  <Badge variant="secondary" className="text-xs">
                    {messages.length} messages
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-muted/50">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Actions - Collapsible for Focus */}
        <div className="border-b border-border/30">
          <Collapsible open={showSettings} onOpenChange={setShowSettings}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto rounded-none hover:bg-muted/30">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm font-medium">Chat Settings</span>
                </div>
                {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 space-y-4">
              {/* Model Selector */}
              <div className="space-y-3">
                <ModelSelector
                  currentModel={currentModel}
                  availableModels={availableModels}
                  onModelChange={setModel}
                  onRefresh={refreshModels}
                />
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} className="justify-start">
                  <History className="h-4 w-4 mr-2" />
                  History
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowApiKeys(true)} className="justify-start">
                  <Key className="h-4 w-4 mr-2" />
                  API Keys
                </Button>
              </div>

              {/* Chat Management */}
              {hasActiveChat && (
                <>
                  <Separator />
                  <Button variant="outline" size="sm" onClick={clearCurrentChat} className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Start New Chat
                  </Button>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Messages Area - Primary Focus */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 py-2" style={{ height: "calc(100vh - 280px)" }}>
            <div className="space-y-6 pb-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-6">
                  <div className="relative">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  <div className="space-y-3 max-w-[280px]">
                    <h3 className="font-semibold text-lg text-foreground">Ready to help!</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Ask me anything about this repository - code structure, functionality, best practices, or specific
                      implementations.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Badge variant="secondary" className="text-xs">
                      Code Analysis
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Architecture
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Documentation
                    </Badge>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <ChatMessage key={`${index}-${message.timestamp.getTime()}`} message={message} />
                  ))}

                  {isLoading && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/30">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">AI is thinking...</p>
                        <p className="text-xs text-muted-foreground">Analyzing your question</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Area - Always Visible and Prominent */}
        <div className="border-t border-border/30 bg-background/80 backdrop-blur-sm">
          <div className="p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about the repository..."
                  disabled={isLoading}
                  className="pr-12 h-11 rounded-xl border-border/50 focus:border-primary/50 focus:ring-primary/20"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {input.length > 0 && `${input.length}`}
                </div>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-11 w-11 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Dialogs */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[80vh] m-4">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Chat History</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <ChatHistory
                  history={chatHistory}
                  onLoadConversation={loadConversation}
                  onClose={() => setShowHistory(false)}
                />
              </div>
            </div>
          </div>
        )}

        {showApiKeys && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[80vh] m-4">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Manage API Keys</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowApiKeys(false)} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <ApiKeyManager onClose={() => setShowApiKeys(false)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
