'use client';

import { useState, useEffect, useCallback } from 'react';
import { redirect, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Github,
  AlertCircle,
  ExternalLink,
  GitBranch,
  Lock,
  Zap,
  ArrowRight,
  Loader2,
  Code,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { showToast } from '@/components/toaster';
import { useResultData } from '@/context/ResultDataContext';
import { fetchGithubRepo } from '@/utils/api';
import { useApiWithAuth } from '@/hooks/useApiWithAuth';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  branch: string;
}

export default function RepositoriesPage() {
  const { data: session, status } = useSession();
  const [isAppInstalled, setIsAppInstalled] = useState<boolean | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [installationId, setInstallationId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [processingRepos, setProcessingRepos] = useState<number[]>([]);
  const router = useRouter();
  const { setOutput, setSourceType, setSourceData, setCurrentRepoId } = useResultData();

  const fetchGithubRepoWithAuth = useApiWithAuth(fetchGithubRepo);

  // Stable callback functions to prevent infinite loops
  const handleError = useCallback((message: string) => {
    showToast.error(message);
  }, []);

  const handleSuccess = useCallback((message: string) => {
    showToast.success(message);
  }, []);

  // Handle GitHub App installation callback and check installation status
  useEffect(() => {
    let isMounted = true;

    const handleInstallationCallback = async () => {
      if (status === 'loading') return;
      if (status === 'unauthenticated') {
        if (isMounted) setIsLoading(false);
        return;
      }

      // Check if this is a callback from GitHub App installation
      const urlParams = new URLSearchParams(window.location.search);
      const installationIdFromUrl = urlParams.get('installation_id');
      const setupAction = urlParams.get('setup_action');

      if (installationIdFromUrl && setupAction === 'install') {
        // Handle successful installation
        const installationId = parseInt(installationIdFromUrl);
        if (isMounted) {
          setInstallationId(installationId);
          setIsAppInstalled(true);
        }

        // Clean up URL parameters
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // Fetch repositories for the new installation
        try {
          const reposRes = await fetch(
            `/api/github/app_repos?installationId=${installationIdFromUrl}`,
          );
          if (!reposRes.ok) {
            throw new Error(`Failed to fetch repositories: ${reposRes.status}`);
          }
          const reposData = await reposRes.json();

          const transformedRepos = (reposData.repositories || []).map((repo: Repository) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description || 'No description available',
            private: repo.private,
            html_url: repo.html_url,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            branch: repo.branch,
          }));

          if (isMounted) {
            setRepositories(transformedRepos);
            handleSuccess('Successfully installed GitHub app and loaded repositories');
          }
        } catch (error) {
          console.error('Error fetching repositories after installation:', error);
          if (isMounted) {
            handleError('Failed to load repositories after installation. Please try again.');
          }
        }

        if (isMounted) setIsLoading(false);
        return;
      }

      // Normal flow - check existing installations
      try {
        if (isMounted) setIsLoading(true);

        const installationsRes = await fetch('/api/github/installations', {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        });

        if (!installationsRes.ok) {
          throw new Error(`Failed to fetch installations: ${installationsRes.status}`);
        }

        const installationsData = await installationsRes.json();

        if (installationsData.installations?.length) {
          const firstInstallationId = installationsData.installations[0].id;

          if (isMounted) {
            setIsAppInstalled(true);
            setInstallationId(firstInstallationId);
          }

          const reposRes = await fetch(
            `/api/github/app_repos?installationId=${firstInstallationId}`,
          );
          if (!reposRes.ok) {
            throw new Error(`Failed to fetch repositories: ${reposRes.status}`);
          }
          const reposData = await reposRes.json();

          const transformedRepos = (reposData.repositories || []).map((repo: Repository) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description || 'No description available',
            private: repo.private,
            html_url: repo.html_url,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
          }));

          if (isMounted) {
            setRepositories(transformedRepos);
            handleSuccess('Successfully loaded your GitHub repositories');
          }
        } else {
          if (isMounted) {
            setIsAppInstalled(false);
            setRepositories([]);
          }
        }
      } catch (error) {
        console.error('Error fetching GitHub data:', error);
        if (isMounted) {
          setIsAppInstalled(false);
          setRepositories([]);
          handleError('Failed to fetch GitHub data. Please try again or check your connection.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    handleInstallationCallback();

    return () => {
      isMounted = false;
    };
  }, [session?.accessToken, status, handleError, handleSuccess]); // Only depend on stable values

  const handleInstallApp = () => {
    try {
      // Redirect to GitHub App installation with custom redirect URL
      const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'YOUR_APP_NAME';
      const redirectUrl = `${window.location.origin}/`;
      const appInstallUrl = `https://github.com/apps/${appName}/installations/new?state=${encodeURIComponent(redirectUrl)}`;

      window.location.href = appInstallUrl;
    } catch (error) {
      console.error('Error installing app:', error);
      handleError('Failed to initiate GitHub app installation. Please try again.');
    }
  };

  const handleUninstallApp = () => {
    try {
      // Redirect to GitHub App settings
      if (installationId) {
        const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'YOUR_APP_NAME';
        const manageUrl = `https://github.com/apps/${appName}/installations/${installationId}`;
        window.open(manageUrl, '_blank');
      } else {
        window.open('https://github.com/settings/installations', '_blank');
      }
    } catch (error) {
      console.error('Error opening GitHub settings:', error);
      handleError('Failed to open GitHub settings. Please try again.');
    }
  };

  const handleVizify = async ({ id: repoId, html_url, branch }: Repository) => {
    try {
      setProcessingRepos((prev) => [...prev, repoId]);
      console.log(html_url);
      const requestData = {
        repo_url: html_url,
        access_token: session?.accessToken || undefined,
        branch: branch || 'main',
        jwt_token: session?.jwt_token || undefined,
      };

      const { text_content: formattedText, repo_id } = await fetchGithubRepoWithAuth(requestData);
      setOutput(formattedText);
      setSourceType('github');
      setSourceData(requestData);
      setCurrentRepoId(repo_id);
      setProcessingRepos((prev) => prev.filter((id) => id !== repoId));
      router.push('/results');
    } catch (error) {
      console.error('Error processing repository:', error);
      handleError('Failed to process repository. Please try again.');
      setProcessingRepos((prev) => prev.filter((id) => id !== repoId));
    }
  };

  const handleImportRepo = () => {
    try {
      // Redirect to add more repositories
      if (installationId) {
        const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'YOUR_APP_NAME';
        const addReposUrl = `https://github.com/apps/${appName}/installations/${installationId}`;
        window.open(addReposUrl, '_blank');
      } else {
        handleError('No installation ID found. Please install the GitHub app first.');
      }
    } catch (error) {
      console.error('Error opening repository import:', error);
      handleError('Failed to open repository import page. Please try again.');
    }
  };

  const filteredRepositories = repositories.filter((repo) => {
    const matchesSearch =
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'public') return matchesSearch && !repo.private;
    if (activeTab === 'private') return matchesSearch && repo.private;
    return matchesSearch;
  });

  // Show loading state while checking authentication
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed top-0 left-0 right-0 h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <Header />
        <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show sign-in message if not authenticated
  if (status === 'unauthenticated') {
    return redirect('/');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Visual Anchor - Top Gradient */}
      <div className="fixed top-0 left-0 right-0 h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Header */}
      <Header />

      {/* Main content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Repositories</h1>
            <p className="text-muted-foreground">Connect and analyze your GitHub repositories</p>
          </div>

          {/* Search and Action Buttons */}
          {isAppInstalled && (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <Input
                  placeholder="Search repositories..."
                  className="w-full h-10 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-3 self-end sm:self-auto">
                <Button
                  className="h-10 px-4 text-sm rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200"
                  onClick={() => redirect('/')}
                >
                  Import Repo
                </Button>
                <Button
                  variant="outline"
                  className="h-10 px-4 text-sm rounded-xl hover:bg-muted/50 transition-all duration-200"
                  onClick={handleUninstallApp}
                >
                  Manage Access
                </Button>
              </div>
            </div>
          )}

          {isAppInstalled ? (
            /* GitHub App Installed State */
            <>
              {/* Repository Tabs */}
              <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
                <div className="flex justify-center">
                  <TabsList className="bg-background/80 backdrop-blur-xl border border-border/60 rounded-2xl p-1 sm:p-2 shadow-lg min-h-[50px] sm:min-h-[60px] w-full sm:w-auto">
                    <TabsTrigger
                      value="all"
                      className="rounded-xl px-3 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2 sm:gap-3 min-w-[120px] sm:min-w-[160px] justify-center"
                    >
                      <Code className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span>All ({repositories.length})</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="public"
                      className="rounded-xl px-3 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2 sm:gap-3 min-w-[120px] sm:min-w-[160px] justify-center"
                    >
                      <GitBranch className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span>Public ({repositories.filter((r) => !r.private).length})</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="private"
                      className="rounded-xl px-3 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2 sm:gap-3 min-w-[120px] sm:min-w-[160px] justify-center"
                    >
                      <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span>Private ({repositories.filter((r) => r.private).length})</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {['all', 'public', 'private'].map((tabValue) => (
                  <TabsContent
                    key={tabValue}
                    value={tabValue}
                    className="mt-6 animate-in fade-in-50 duration-300"
                  >
                    {filteredRepositories.length > 0 ? (
                      <div className="divide-y divide-border/30 border border-border/50 rounded-xl overflow-hidden bg-background/60 backdrop-blur-xl">
                        {filteredRepositories.map((repo) => (
                          <div
                            key={repo.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center gap-3 mb-3 sm:mb-0">
                              <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                                {repo.private ? (
                                  <Lock className="h-4 w-4 text-primary" />
                                ) : (
                                  <Code className="h-4 w-4 text-primary" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-lg font-semibold tracking-tight truncate">
                                    {repo.name}
                                  </h3>
                                  {repo.private ? (
                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-xl">
                                      Private
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-xl">
                                      Public
                                    </Badge>
                                  )}
                                  {repo.language && (
                                    <Badge variant="outline" className="rounded-xl text-xs">
                                      {repo.language}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {repo.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-3 text-sm rounded-xl hover:bg-muted/50 transition-all duration-200"
                                onClick={() => window.open(repo.html_url, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                className="h-9 px-4 text-sm rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200"
                                onClick={() => handleVizify(repo)}
                                disabled={processingRepos.includes(repo.id)}
                              >
                                {processingRepos.includes(repo.id) ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-4 w-4 mr-2" />
                                    Vizify
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Empty State */
                      <div className="bg-background/60 backdrop-blur-xl border border-border/50 border-dashed rounded-2xl sm:rounded-3xl">
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="rounded-full bg-muted p-3 mb-4">
                            <AlertCircle className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-medium mb-2">
                            {tabValue === 'all'
                              ? 'No repositories found'
                              : tabValue === 'public'
                                ? 'No public repositories found'
                                : 'No private repositories found'}
                          </h3>
                          <p className="text-muted-foreground max-w-md mb-6">
                            {searchQuery
                              ? `No repositories match "${searchQuery}". Try adjusting your search terms.`
                              : tabValue === 'all'
                                ? "You don't have access to any repositories yet. Install the app on more repositories to get started."
                                : `You don't have any ${tabValue} repositories that match your search criteria.`}
                          </p>
                          <Button
                            variant="outline"
                            className="flex items-center gap-2 rounded-xl"
                            onClick={handleImportRepo}
                          >
                            Add More Repositories
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          ) : (
            /* GitHub App Not Installed State */
            <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
              {/* Section Header */}
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10">
                    <Github className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold tracking-tight">
                      Connect to GitHub
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Install the gitvizz GitHub App to get started
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-8">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-primary/10 p-4 mb-6">
                    <Github className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Connect to GitHub</h2>
                  <p className="text-muted-foreground max-w-md mb-8">
                    To view your repositories, please install the gitvizz GitHub App and grant access
                    to the appropriate repositories.
                  </p>
                  <Button
                    size="lg"
                    className="w-full h-10 sm:h-12 text-sm sm:text-base rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02]"
                    onClick={handleInstallApp}
                  >
                    <Github className="h-5 w-5 mr-2" />
                    Set up GitHub App
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <p className="text-xs text-muted-foreground mt-6 max-w-sm">
                    gitvizz requires read-only access to your repositories to provide visualization
                    and analysis features.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Visual Anchor - Bottom Gradient */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
    </div>
  );
}
