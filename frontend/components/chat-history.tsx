"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Search, MessageCircle, Calendar, ExternalLink } from "lucide-react"

interface ConversationHistoryResponse {
  chat_id: string
  conversation_id: string
  title?: string | null
  messages: Array<{
    role: "user" | "assistant" | "system"
    content: string
    timestamp: Date
  }>
  created_at: Date
  updated_at: Date
  total_tokens_used?: number
  model_provider: string
  model_name: string
}

interface ChatHistoryProps {
  history: ConversationHistoryResponse[]
  onLoadConversation: (conversationId: string) => void
  onClose: () => void
}

export function ChatHistory({ history, onLoadConversation, onClose }: ChatHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredHistory = history.filter((conversation) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      conversation.title?.toLowerCase().includes(searchLower) ||
      conversation.messages.some((msg) => msg.content.toLowerCase().includes(searchLower))
    )
  })

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getConversationPreview = (conversation: ConversationHistoryResponse) => {
    const firstUserMessage = conversation.messages.find((msg) => msg.role === "user")
    return firstUserMessage?.content.slice(0, 100) + "..." || "No messages"
  }

  const handleLoadConversation = (conversationId: string) => {
    onLoadConversation(conversationId)
    onClose()
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* History List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-sm">No conversations found</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery ? "Try adjusting your search terms" : "Start chatting to see your history here"}
                </p>
              </div>
            </div>
          ) : (
            filteredHistory.map((conversation) => (
              <div
                key={conversation.conversation_id}
                className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => handleLoadConversation(conversation.conversation_id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{conversation.title || "Untitled Conversation"}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {conversation.model_provider}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {getConversationPreview(conversation)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(conversation.updated_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        <span>{conversation.messages.length} messages</span>
                      </div>
                      {conversation.total_tokens_used && <span>{conversation.total_tokens_used} tokens</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLoadConversation(conversation.conversation_id)
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
