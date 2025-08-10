'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StructureTab } from '@/components/structure-tab';
import ReagraphVisualization from '@/components/ReagraphVisualization';
import { FloatingChatButton } from '@/components/floating-chat-button';
import { ChatSidebar } from '@/components/chat-sidebar';
import DocumentationTab from '@/components/documentation';
import {
  Network,
  Code2,
  FileText,
  ArrowLeft,
  CheckCircle,
  Github,
  Info,
  X,
  Minimize2,
  Menu,
  Lock,
  BookOpen,
  Key,
  Play,
  Zap,
} from 'lucide-react';
import { CodeViewer } from '@/components/CodeViewer';
import { cn } from '@/lib/utils';
import { useResultData } from '@/context/ResultDataContext';
import { showToast } from '@/components/toaster';
import { useSession } from 'next-auth/react';
import { useChatSidebar } from '@/hooks/use-chat-sidebar';
import ThemeToggle from '@/components/theme-toggle';

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const owner = (params?.owner as string) || '';
  const repo = (params?.repo as string) || '';
  const repoUrl = owner && repo ? `https://github.com/${owner}/${repo}` : '';

  const {
    output,
    error,
    outputMessage,
    sourceType,
    sourceData,
    loading,
    currentRepoId,
    userKeyPreferences,
    setSourceType,
    setSourceData,
    setCurrentRepoId,
  } = useResultData();
  const { data: session } = useSession();
  const { currentModel } = useChatSidebar(currentRepoId || '', userKeyPreferences);

  // Hydrate context from URL params on first load/refresh
  useEffect(() => {
    if (owner && repo) {
      if (sourceType !== 'github' || !sourceData) {
        setSourceType('github');
        setSourceData({ repo_url: repoUrl });
      }
      const id = searchParams.get('id');
      if (id && id !== currentRepoId) {
        setCurrentRepoId(id);
      }
    }
  }, [
    owner,
    repo,
    repoUrl,
    sourceType,
    sourceData,
    setSourceType,
    setSourceData,
    searchParams,
    setCurrentRepoId,
    currentRepoId,
  ]);

  // Set default active tab based on authentication
  const defaultTab = session?.accessToken ? 'graph' : 'structure';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showInfo, setShowInfo] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  // popup state for full-screen code explorer
  const [isExpanded, setIsExpanded] = useState(false);
  // popup state for full-screen graph explorer
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);
  const popupGraphRef = useRef<HTMLDivElement>(null);

  // Handle restricted tab clicks
  const handleTabChange = (value: string) => {
    if (
      (value === 'graph' ||
        value === 'explorer' ||
        value === 'documentation' ||
        value === 'video' ||
        value === 'mcp') &&
      !session?.accessToken
    ) {
      // Redirect to sign in page for restricted tabs
      router.push('/signin');
      return;
    }

    // Show coming soon message for video tab
    if (value === 'video') {
      showToast.info('🎬 Code walk through Video generation, Coming Soon !!');
      return;
    }

    // Show coming soon message for MCP tab
    if (value === 'mcp') {
      showToast.info('⚡ MCP features, Coming Soon !!');
      return;
    }

    setActiveTab(value);
  };

  // Handle click outside to close expanded view
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    // Add escape key handler
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isExpanded]);

  // Show toast messages for error/outputMessage
  useEffect(() => {
    if (error) showToast.error(error);
  }, [error]);

  useEffect(() => {
    if (outputMessage) showToast.success(outputMessage);
  }, [outputMessage]);

  // Redirect if no output and no params (fallback)
  useEffect(() => {
    if (!output && !loading && !(owner && repo)) {
      router.replace('/');
    }
  }, [output, loading, router, owner, repo]);

  type GitHubSource = {
    repo_url: string;
  };

  type ZipSource = {
    name: string;
  };

  // Helper to get repository name from URL params or sourceData
  const getRepoName = () => {
    if (owner && repo) {
      return `${owner}/${repo}`;
    }

    if (
      sourceType === 'github' &&
      sourceData &&
      typeof sourceData === 'object' &&
      'repo_url' in sourceData &&
      typeof (sourceData as GitHubSource).repo_url === 'string'
    ) {
      try {
        const url = new URL((sourceData as GitHubSource).repo_url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          return `${pathParts[0]}/${pathParts[1]}`;
        }
      } catch {
        // Do nothing
      }
      return (sourceData as GitHubSource).repo_url;
    }

    if (
      sourceType === 'zip' &&
      sourceData &&
      typeof sourceData === 'object' &&
      'name' in sourceData &&
      typeof (sourceData as ZipSource).name === 'string'
    ) {
      return (sourceData as ZipSource).name;
    }

    return 'Repository';
  };

  if (loading || (!output && !(owner && repo))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 sm:gap-6 p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-background/80 backdrop-blur-2xl border border-border/50 shadow-xl max-w-sm w-full">
          <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <div className="text-center space-y-2">
            <h3 className="font-medium text-foreground text-sm sm:text-base">Loading Results</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Please wait while we prepare your analysis...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Gradient */}
      <div className="absolute top-0 left-0 right-0 h-32 sm:h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/30 pb-2">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/')}
              className="h-9 w-9 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Github className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate max-w-[120px]">{getRepoName()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-50/90 text-green-700 border-green-200/60 dark:bg-green-950/90 dark:text-green-300 dark:border-green-800/60 rounded-xl px-3 py-1 text-xs flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              <span className="hidden xs:inline">Complete</span>
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="h-9 w-9 rounded-xl"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="border-t border-border/30 p-4 space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfo(!showInfo)}
              className="w-full justify-start rounded-xl"
            >
              <Info className="h-4 w-4 mr-2" />
              Repository Details
            </Button>
          </div>
        )}
      </div>

      {/* Desktop Header Elements */}
      <div className="hidden lg:block">
        {/* Back Button */}
        <div className="fixed top-6 left-6 z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 rounded-2xl bg-background/90 backdrop-blur-xl border-border/60 shadow-md hover:bg-background hover:shadow-lg transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Repo Badge */}
        <div className="fixed top-6 left-20 z-50 flex items-center">
          <div className="flex items-center gap-2 bg-background/90 backdrop-blur-xl rounded-2xl px-4 py-2 border border-border/60 shadow-md">
            <Github className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{getRepoName()}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-muted/50"
              onClick={() => setShowInfo(!showInfo)}
            >
              <Info className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Top Right Controls: Theme + API Keys */}
        <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2">
          <ThemeToggle className="bg-muted/40 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-border/30" />
          {session?.accessToken && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/api-keys')}
              className="rounded-xl bg-background/90 backdrop-blur-xl border-border/60 shadow-md hover:bg-background hover:shadow-lg transition-all duration-300 gap-2"
            >
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">API Keys</span>
            </Button>
          )}
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="fixed top-4 left-4 right-4 lg:top-20 lg:left-6 lg:right-auto z-50 lg:max-w-md">
          <div className="bg-background/95 backdrop-blur-xl rounded-2xl border border-border/60 shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Repository Details</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-muted/50"
                onClick={() => setShowInfo(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Source:</span>
                <span>{sourceType === 'github' ? 'GitHub Repository' : 'ZIP Archive'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[95vw] mx-auto px-2 sm:px-4 py-2 sm:py-4 lg:py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-8">
          {/* Mobile Tab Navigation */}
          <div className="lg:hidden">
            <TabsList className="grid w-full grid-cols-6 bg-background backdrop-blur-xl border border-border/60 rounded-2xl p-1 shadow-lg h-12">
              <TabsTrigger
                value="graph"
                className={cn(
                  'rounded-xl text-xs font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2',
                  !session?.accessToken && 'opacity-60',
                )}
              >
                {!session?.accessToken && <Lock className="h-3 w-3" />}
                <Network className="h-4 w-4" />
                <span className="hidden xs:inline">Graph</span>
              </TabsTrigger>
              <TabsTrigger
                value="explorer"
                className={cn(
                  'rounded-xl text-xs font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2',
                  !session?.accessToken && 'opacity-60',
                )}
              >
                {!session?.accessToken && <Lock className="h-3 w-3" />}
                <Code2 className="h-4 w-4" />
                <span className="hidden xs:inline">Explorer</span>
              </TabsTrigger>
              <TabsTrigger
                value="documentation"
                className={cn(
                  'rounded-xl text-xs font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2',
                  !session?.accessToken && 'opacity-60',
                )}
              >
                {!session?.accessToken && <Lock className="h-3 w-3" />}
                <BookOpen className="h-4 w-4" />
                <span className="hidden xs:inline">Docs</span>
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className={cn(
                  'rounded-xl text-xs font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2 opacity-60',
                  !session?.accessToken && 'opacity-40',
                )}
              >
                {!session?.accessToken && <Lock className="h-3 w-3" />}
                <Play className="h-4 w-4" />
                <span className="hidden xs:inline">Video</span>
              </TabsTrigger>
              <TabsTrigger
                value="mcp"
                className={cn(
                  'rounded-xl text-xs font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2 opacity-60',
                  !session?.accessToken && 'opacity-40',
                )}
              >
                {!session?.accessToken && <Lock className="h-3 w-3" />}
                <Zap className="h-4 w-4" />
                <span className="hidden xs:inline">MCP</span>
              </TabsTrigger>
              <TabsTrigger
                value="structure"
                className="rounded-xl text-xs font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden xs:inline">Structure</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Desktop Tab Navigation */}
          <div className="hidden lg:flex justify-center items-center gap-4 relative">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-muted/30 -z-10"></div>
            <TabsList className="bg-background backdrop-blur-xl border border-border/60 rounded-2xl p-2 shadow-lg min-h-[60px] relative z-10">
              <TabsTrigger
                value="graph"
                className={cn(
                  'rounded-xl px-8 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-3 min-w-[140px] justify-center',
                  !session?.accessToken && 'opacity-60',
                )}
              >
                {!session?.accessToken && <Lock className="h-4 w-4" />}
                <Network className="h-5 w-5" />
                <span>Graph</span>
              </TabsTrigger>
              <TabsTrigger
                value="explorer"
                className={cn(
                  'rounded-xl px-8 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-3 min-w-[140px] justify-center',
                  !session?.accessToken && 'opacity-60',
                )}
              >
                {!session?.accessToken && <Lock className="h-4 w-4" />}
                <Code2 className="h-5 w-5" />
                <span>Explorer</span>
              </TabsTrigger>
              <TabsTrigger
                value="documentation"
                className={cn(
                  'rounded-xl px-8 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-3 min-w-[140px] justify-center',
                  !session?.accessToken && 'opacity-60',
                )}
              >
                {!session?.accessToken && <Lock className="h-4 w-4" />}
                <BookOpen className="h-5 w-5" />
                <span>Documentation</span>
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className={cn(
                  'rounded-xl px-8 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-3 min-w-[140px] justify-center opacity-60 relative',
                  !session?.accessToken && 'opacity-40',
                )}
              >
                {!session?.accessToken && <Lock className="h-4 w-4" />}
                <Play className="h-5 w-5" />
                <span>Video</span>
                <Badge className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  Soon
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="mcp"
                className={cn(
                  'rounded-xl px-8 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-3 min-w-[140px] justify-center opacity-60 relative',
                  !session?.accessToken && 'opacity-40',
                )}
              >
                {!session?.accessToken && <Lock className="h-4 w-4" />}
                <Zap className="h-5 w-5" />
                <span>MCP</span>
                <Badge className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  Soon
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="structure"
                className="rounded-xl px-8 py-3 text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-3 min-w-[140px] justify-center"
              >
                <FileText className="h-5 w-5" />
                <span>Context</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="relative">
            {/* Enhanced Structure Tab */}
            <TabsContent value="structure" className="mt-0 animate-in fade-in-50 duration-300">
              <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
                {/* <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                        Context Builder
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Select files to build context for the LLM
                      </p>
                    </div>
                  </div>
                </div> */}
                <div className="p-4 sm:p-8">
                  <StructureTab />
                </div>
              </div>
            </TabsContent>

            {/* Graph Tab - Only show content if authenticated */}
            <TabsContent value="graph" className="mt-0 animate-in fade-in-50 duration-300">
              {session?.accessToken ? (
                <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
                  {/* <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10">
                            <Network className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                                Dependency Graph
                              </h2>
                              <Badge variant="outline" className="text-xs">
                                Beta
                              </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                              Interactive visualization of code relationships. Large graphs may slow
                              down your browser.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          onClick={() => setIsGraphExpanded(true)}
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none rounded-xl border-border/50"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          <span className="hidden xs:inline">Expand</span>
                        </Button>
                      </div>
                    </div>
                  </div> */}
                  <div className="p-1 sm:p-2 min-h-[70vh] lg:min-h-[80vh] h-[600px] sm:h-[700px] lg:h-[800px]">
                    {sourceType && sourceData ? (
                      <div className="h-full w-full min-h-[70vh] lg:min-h-[80vh] rounded-xl sm:rounded-2xl bg-muted/20 border border-border/30 overflow-hidden">
                        <ReagraphVisualization
                          setParentActiveTab={setActiveTab}
                          onError={(msg) => showToast.error(msg)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center space-y-4 p-8">
                          <div className="w-12 h-12 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
                            <Network className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="font-medium text-foreground">No Graph Data Available</h3>
                            <p className="text-sm text-muted-foreground max-w-sm">
                              Graph visualization requires processed source data to display
                              relationships
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </TabsContent>

            {/* Code Explorer Tab - Only show content if authenticated */}
            <TabsContent value="explorer" className="mt-0 animate-in fade-in-50 duration-300">
              {session?.accessToken ? (
                <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
                  {/* <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10">
                          <Code2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                            Code Explorer
                          </h2>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Browse repository structure with syntax highlighting and file navigation
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsExpanded(true)}
                        className="w-full sm:w-auto rounded-xl border-border/50 hover:bg-muted/50 transition-colors duration-200"
                      >
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Expand View
                      </Button>
                    </div>
                  </div> */}

                  <div className="p-2 sm:p-4 h-[500px] sm:h-[600px] lg:h-[800px]">
                    <div className="h-full w-full rounded-xl sm:rounded-2xl bg-muted/20 border border-border/30 overflow-auto">
                      <div className="h-full w-full">
                        <CodeViewer />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            {/* Documentation Tab - Only show content if authenticated */}
            <TabsContent value="documentation" className="mt-0 animate-in fade-in-50 duration-300">
              {session?.accessToken ? (
                <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
                  {/* <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                    <div className="flex items-center gap-3">
                      <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10">
                        <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                          Documentation
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          AI-generated documentation with interactive navigation
                        </p>
                      </div>
                    </div>
                  </div> */}
                  <div className="h-[500px] sm:h-[600px] lg:h-[800px] overflow-auto rounded-xl">
                    {currentRepoId && sourceData && sourceType ? (
                      <div className="h-full w-full overflow-auto">
                        <DocumentationTab
                          currentRepoId={currentRepoId}
                          sourceData={
                            typeof sourceData === 'object' &&
                            sourceData !== null &&
                            'repo_url' in sourceData
                              ? { repo_url: (sourceData as { repo_url?: string }).repo_url }
                              : {}
                          }
                          sourceType={sourceType}
                          selectedModel={(currentModel as { provider?: string }).provider}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center space-y-4 p-8">
                          <div className="w-12 h-12 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="font-medium text-foreground">No Repository Data</h3>
                            <p className="text-sm text-muted-foreground max-w-sm">
                              Documentation requires repository information to generate content
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </TabsContent>

            {/* Video Tab - Coming Soon */}
            <TabsContent value="video" className="mt-0 animate-in fade-in-50 duration-300">
              {session?.accessToken ? (
                <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-orange-500/5 via-transparent to-transparent">
                    <div className="flex items-center gap-3">
                      <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-orange-500/10">
                        <Play className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                            Video Analysis
                          </h2>
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 rounded-xl px-2 py-1 text-xs font-medium">
                            Coming Soon
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          AI-powered video explanations and walkthroughs of your codebase
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="h-[500px] sm:h-[600px] lg:h-[700px] flex items-center justify-center">
                    <div className="text-center space-y-6 p-8 max-w-md">
                      <div className="relative">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                          <Play className="h-10 w-10 sm:h-12 sm:w-12 text-orange-500" />
                        </div>
                        <div className="absolute -top-2 -right-2">
                          <Badge className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                            Soon
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                          Video Analysis Coming Soon
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          We&apos;re working on an exciting new feature that will generate video
                          explanations of your codebase, including code walkthroughs, architecture
                          overviews, and interactive tutorials.
                        </p>
                      </div>
                      <div className="bg-orange-50/80 dark:bg-orange-950/30 rounded-xl p-4 border border-orange-200/60 dark:border-orange-800/60">
                        <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                          What to expect:
                        </h4>
                        <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 text-left">
                          <li>• AI-narrated code explanations</li>
                          <li>• Visual architecture diagrams</li>
                          <li>• Step-by-step feature walkthroughs</li>
                          <li>• Interactive code tutorials</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            {/* MCP Tab - Coming Soon */}
            <TabsContent value="mcp" className="mt-0 animate-in fade-in-50 duration-300">
              {session?.accessToken ? (
                <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-orange-500/5 via-transparent to-transparent">
                    <div className="flex items-center gap-3">
                      <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-orange-500/10">
                        <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                            MCP Analysis
                          </h2>
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 rounded-xl px-2 py-1 text-xs font-medium">
                            Coming Soon
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          AI-powered analysis of your codebase for potential code quality,
                          complexity, and performance issues.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="h-[500px] sm:h-[600px] lg:h-[700px] flex items-center justify-center">
                    <div className="text-center space-y-6 p-8 max-w-md">
                      <div className="relative">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                          <Zap className="h-10 w-10 sm:h-12 sm:w-12 text-orange-500" />
                        </div>
                        <div className="absolute -top-2 -right-2">
                          <Badge className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                            Soon
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                          MCP Analysis Coming Soon
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          We&apos;re working on an exciting new feature that will analyze your
                          codebase for potential code quality, complexity, and performance issues,
                          providing actionable insights to improve your codebase.
                        </p>
                      </div>
                      <div className="bg-orange-50/80 dark:bg-orange-950/30 rounded-xl p-4 border border-orange-200/60 dark:border-orange-800/60">
                        <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                          What to expect:
                        </h4>
                        <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 text-left">
                          <li>• Code quality assessment</li>
                          <li>• Complexity analysis</li>
                          <li>• Performance optimization suggestions</li>
                          <li>• Potential bugs and issues</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </TabsContent>
          </div>
        </Tabs>
      </main>

      {currentRepoId && (
        <>
          <FloatingChatButton onClick={toggleChat} isOpen={isChatOpen} unreadCount={0} />
          <ChatSidebar
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            repositoryId={currentRepoId}
            repositoryName={getRepoName()}
            userKeyPreferences={userKeyPreferences}
          />
        </>
      )}

      {/* Expanded Views - Only render if authenticated */}
      {session?.accessToken && (
        <>
          {/* Expanded View Popup */}
          {isExpanded && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-2 sm:p-8">
              <div
                ref={popupRef}
                className="w-full h-full sm:w-[90vw] sm:h-[85vh] bg-background rounded-2xl sm:rounded-3xl border border-border/50 shadow-2xl flex flex-col animate-in fade-in-50 zoom-in-95 duration-300"
              >
                {/* Popup Header */}
                {/* <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10">
                        <Code2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                            Code Explorer
                          </h2>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {getRepoName()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExpanded(false)}
                      className="rounded-xl border-border/50 hover:bg-muted/50 transition-colors duration-200"
                    >
                      <Minimize2 className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Minimize</span>
                    </Button>
                  </div>
                </div> */}
                {/* Popup Content */}
                <div className="flex-1 p-3 sm:p-6 overflow-hidden">
                  <div className="h-full rounded-xl sm:rounded-2xl bg-muted/20 border border-border/30 overflow-auto">
                    <div className="h-full w-full">
                      <CodeViewer />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expanded Graph View Popup */}
          {isGraphExpanded && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-2 sm:p-8">
              <div
                ref={popupGraphRef}
                className="w-full h-full sm:w-[90vw] sm:h-[85vh] bg-background rounded-2xl sm:rounded-3xl border border-border/50 shadow-2xl flex flex-col animate-in fade-in-50 zoom-in-95 duration-300"
              >
                {/* Popup Header */}
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10">
                        <Network className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                            Dependency Graph
                          </h2>
                          <Badge variant="outline" className="text-xs">
                            Beta
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          Interactive visualization of code relationships. Large graphs may slow
                          down your browser.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsGraphExpanded(false)}
                        className="rounded-xl border-border/50 hover:bg-muted/50 transition-colors duration-200"
                      >
                        <Minimize2 className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Minimize</span>
                      </Button>
                    </div>
                  </div>
                </div>
                {/* Popup Content */}
                <div className="flex-1 p-3 sm:p-6 overflow-hidden">
                  <div className="h-full rounded-xl sm:rounded-2xl bg-muted/20 border border-border/30 overflow-auto">
                    <div className="h-full w-full">
                      <ReagraphVisualization
                        setParentActiveTab={setActiveTab}
                        onError={(msg) => showToast.error(msg)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
