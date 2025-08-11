'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, User, Copy, Check, Clock, Code, FileText, Cpu, Zap, ArrowRight } from 'lucide-react';
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
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

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
    <div className={cn('group flex gap-3 w-full', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center border-2',
            isUser
              ? 'bg-primary text-primary-foreground border-primary/20'
              : 'bg-background text-muted-foreground border-border/50',
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
      </div>

      {/* Message Content */}
      <div
        className={cn('flex-1 min-w-0 space-y-2 max-w-full', isUser && 'flex flex-col items-end')}
      >
        {/* Message Bubble */}
        <div
          className={cn(
            'relative w-full rounded-2xl px-3 py-3 shadow-sm border overflow-hidden',
            isUser
              ? 'bg-primary text-primary-foreground border-primary/20 rounded-tr-md max-w-[85%]'
              : 'bg-background text-foreground border-border/50 rounded-tl-md',
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
            'flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity',
            isUser && 'justify-end',
          )}
        >
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTime(message.timestamp)}</span>
          </div>

          {!isUser && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 px-2 text-xs hover:bg-muted/50"
            >
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
  );
}
