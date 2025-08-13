'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, User, Copy, Check, Clock, Code, FileText, Cpu, Zap, ArrowRight, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context_used?: string | null;
  metadata?: Record<string, unknown> | null;
  function_calls?: FunctionCall[];
  reasoning?: string | null; // Reasoning traces for o1/o3 models
  is_reasoning_model?: boolean; // Flag to indicate if this is a reasoning model response
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const { theme } = useTheme();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const hasReasoning = !isUser && message.reasoning && message.reasoning.trim().length > 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-4 w-max-full">
        <div className="bg-muted/50 text-muted-foreground text-xs px-3 py-1 rounded-full border border-border/30">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group flex gap-3 w-full mb-6', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center border shadow-sm',
            isUser
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-300'
              : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
      </div>

      {/* Message Content */}
      <div
        className={cn('flex-1 min-w-0 space-y-3 max-w-full', isUser && 'flex flex-col items-end')}
      >
        {/* Message Bubble */}
        <div
          className={cn(
            'relative w-full rounded-2xl px-4 py-3 shadow-sm border overflow-hidden',
            isUser
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-300 rounded-tr-lg max-w-[85%]'
              : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700 rounded-tl-lg',
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none w-full">
              <ReactMarkdown
                components={{
                  code(props: any) {
                    const { inline, className, children } = props;
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="relative group/code my-3 w-full">
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
                        <div className="overflow-x-auto w-full">
                          <SyntaxHighlighter
                            style={theme === 'dark' ? oneDark : oneLight}
                            language={match[1]}
                            PreTag="div"
                            className="!mt-0 !rounded-t-none !text-xs !w-full"
                            customStyle={{
                              margin: 0,
                              padding: '12px',
                              fontSize: '11px',
                              lineHeight: '1.4',
                              width: '100%',
                              minWidth: '0',
                              overflow: 'auto',
                            }}
                            codeTagProps={{
                              style: {
                                fontSize: '11px',
                                fontFamily:
                                  'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                whiteSpace: 'pre',
                                wordBreak: 'normal',
                                overflowWrap: 'normal',
                              },
                            }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    ) : (
                      <code
                        className="bg-muted/50 text-foreground px-1.5 py-0.5 rounded text-xs font-mono border border-border/30 break-all"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  p: ({ children }) => (
                    <p className="text-sm leading-relaxed mb-3 last:mb-0 break-words w-full">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="text-sm space-y-1 ml-4 mb-3 break-words w-full">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="text-sm space-y-1 ml-4 mb-3 break-words w-full">{children}</ol>
                  ),
                  li: ({ children }) => <li className="break-words">{children}</li>,
                  h1: ({ children }) => (
                    <h1 className="text-base font-semibold mb-2 mt-4 first:mt-0 break-words w-full">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-sm font-semibold mb-2 mt-3 first:mt-0 break-words w-full">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-medium mb-2 mt-3 first:mt-0 break-words w-full">
                      {children}
                    </h3>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/20 pl-4 my-3 text-muted-foreground italic break-words w-full">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3 w-full">
                      <table className="min-w-full text-xs border border-border/30 rounded-lg">
                        {children}
                      </table>
                    </div>
                  ),
                  pre: ({ children }) => (
                    <div className="overflow-x-auto w-full">
                      <pre className="text-xs p-3 bg-muted/30 rounded-lg border border-border/30 overflow-auto w-full">
                        {children}
                      </pre>
                    </div>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Thinking/Reasoning Traces */}
        {hasReasoning && (
          <div className="space-y-2">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden shadow-sm">
              <Button
                variant="ghost"
                onClick={() => setShowReasoning(!showReasoning)}
                className="w-full flex items-center justify-between p-3 h-auto hover:bg-gradient-to-r hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      AI Thinking Process
                    </span>
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      {message.is_reasoning_model ? 'Advanced reasoning model' : 'Step-by-step analysis'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] h-4 px-2 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                    {showReasoning ? 'Hide' : 'Show'} Thoughts
                  </Badge>
                  {showReasoning ? (
                    <ChevronUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  )}
                </div>
              </Button>
              
              {showReasoning && (
                <div className="border-t border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-25 to-blue-25 dark:from-purple-950/10 dark:to-blue-950/10">
                  <div className="p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="text-sm leading-relaxed mb-3 last:mb-0 text-purple-800 dark:text-purple-200">
                              {children}
                            </p>
                          ),
                          code: ({ children }) => (
                            <code className="bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100 px-1.5 py-0.5 rounded text-xs font-mono border border-purple-200 dark:border-purple-700">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100 p-3 rounded-lg text-xs overflow-x-auto border border-purple-200 dark:border-purple-700">
                              {children}
                            </pre>
                          ),
                          ul: ({ children }) => (
                            <ul className="text-sm space-y-1 ml-4 mb-3 text-purple-800 dark:text-purple-200">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="text-sm space-y-1 ml-4 mb-3 text-purple-800 dark:text-purple-200">{children}</ol>
                          ),
                          li: ({ children }) => <li className="text-purple-800 dark:text-purple-200">{children}</li>,
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold mb-2 mt-3 first:mt-0 text-purple-900 dark:text-purple-100">
                              {children}
                            </h3>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-purple-300 dark:border-purple-600 pl-3 my-2 text-purple-700 dark:text-purple-300 italic">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {message.reasoning}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Function Calls */}
        {!isUser && message.function_calls && message.function_calls.length > 0 && (
          <div className="space-y-2">
            {message.function_calls.map((call, index) => (
              <div
                key={index}
                className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Function Call: {call.name}
                  </span>
                </div>

                {Object.keys(call.arguments).length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <ArrowRight className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                      <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                        Arguments:
                      </span>
                    </div>
                    <div className="bg-orange-100 dark:bg-orange-900/30 rounded p-2 text-xs font-mono">
                      <pre className="whitespace-pre-wrap text-orange-800 dark:text-orange-200">
                        {JSON.stringify(call.arguments, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Result */}
                {call.result != null && (
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-medium text-green-700 dark:text-green-300">
                        Result:
                      </span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2 text-xs">
                      <pre className="whitespace-pre-wrap text-green-800 dark:text-green-200">
                        {typeof call.result === 'string'
                          ? call.result
                          : JSON.stringify(call.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message Footer */}
        <div
          className={cn(
            'flex items-center gap-3 px-1 opacity-0 group-hover:opacity-100 transition-all duration-200',
            isUser && 'justify-end',
          )}
        >
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3" />
            <span>{formatTime(message.timestamp)}</span>
          </div>

          {!isUser && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-3 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1.5 text-green-600" />
                  <span className="text-green-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1.5" />
                  Copy
                </>
              )}
            </Button>
          )}

          {message.context_used && (
            <Badge variant="secondary" className="text-xs h-6 px-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800">
              <FileText className="h-3 w-3 mr-1" />
              Context
            </Badge>
          )}

          {message.is_reasoning_model && (
            <Badge variant="secondary" className="text-xs h-6 px-2 bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 border-purple-200 dark:from-purple-950/50 dark:to-blue-950/50 dark:text-purple-300 dark:border-purple-800">
              <Brain className="h-3 w-3 mr-1" />
              Reasoning
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
