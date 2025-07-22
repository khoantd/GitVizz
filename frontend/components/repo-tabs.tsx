'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Loader2,
  Github,
  Upload,
  GitBranch,
  Lock,
  Info,
  Zap,
  ArrowRight,
  CheckCircle,
  X,
  Settings,
  AlertCircle,
  ExternalLink,
  Code,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { showToast } from '@/components/toaster';

import { cn } from '@/lib/utils';
import { fetchGithubRepo, uploadLocalZip } from '@/utils/api';
import { useResultData } from '@/context/ResultDataContext';
import { useApiWithAuth } from '@/hooks/useApiWithAuth';
import { SupportedLanguages, type Language } from '@/components/supported-languages';

// --- Constants & Types ---
const SUPPORTED_LANGUAGES: Language[] = [
  { name: 'Python', supported: true },
  { name: 'JavaScript', supported: true },
  { name: 'TypeScript', supported: true },
  { name: 'Ruby', supported: false },
  { name: 'Java', supported: false },
  { name: 'Go', supported: false },
  { name: 'Rust', supported: false },
];

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

export function RepoTabs() {
  // --- Hooks & Context ---
  const { data: session, status } = useSession();
  const router = useRouter();
  const {
    setOutput,
    loading,
    setLoading,
    setError,
    setSourceType,
    setSourceData,
    setOutputMessage,
    setCurrentRepoId,
  } = useResultData();
  const fetchGithubRepoWithAuth = useApiWithAuth(fetchGithubRepo);
  const uploadLocalZipWithAuth = useApiWithAuth(uploadLocalZip);

  // --- State for GitHub URL & ZIP Upload Tabs ---
  const [repoUrl, setRepoUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [branch, setBranch] = useState('main');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- State for "My Repositories" Tab ---
  const [activeMainTab, setActiveMainTab] = useState('github');
  const [isAppInstalled, setIsAppInstalled] = useState<boolean | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [installationId, setInstallationId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isReposLoading, setIsReposLoading] = useState(true);
  const [activeRepoFilter, setActiveRepoFilter] = useState('all');
  const [processingRepos, setProcessingRepos] = useState<number[]>([]);

  useEffect(() => {
    // If the user is logged in and the session contains an access token,
    // update the local state to pre-fill the input field.
    if (status === 'authenticated' && session?.accessToken) {
      setAccessToken(session.accessToken as string);
    }
  }, [session, status]);

  // --- Handlers for "My Repositories" Tab ---
  const handleError = useCallback((message: string) => {
    showToast.error(message);
  }, []);

  const handleSuccess = useCallback((message: string) => {
    showToast.success(message);
  }, []);

  useEffect(() => {
    // Only run this effect when the "My Repositories" tab is active
    // and the check hasn't been performed yet (isAppInstalled is null).
    if (activeMainTab !== 'my-repos' || isAppInstalled !== null) {
      return;
    }

    let isMounted = true;
    const handleInstallationCheck = async () => {
      if (status === 'loading' || status === 'unauthenticated') {
        if (isMounted) setIsReposLoading(false);
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('installation_id') && urlParams.has('setup_action')) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      try {
        if (isMounted) setIsReposLoading(true);
        const installationsRes = await fetch('/api/github/installations', {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        });
        if (!installationsRes.ok) throw new Error('Failed to fetch installations.');

        const installationsData = await installationsRes.json();
        if (installationsData.installations?.length) {
          const firstInstallationId = installationsData.installations[0].id;
          if (isMounted) {
            setInstallationId(firstInstallationId);
            setIsAppInstalled(true);
          }

          const reposRes = await fetch(
            `/api/github/app_repos?installationId=${firstInstallationId}`,
          );
          if (!reposRes.ok) throw new Error('Failed to fetch repositories.');

          const reposData = await reposRes.json();
          const transformedRepos = (reposData.repositories || []).map(
            (repo: { description?: string }) => ({
              ...repo,
              description: repo.description || 'No description available',
            }),
          );

          if (isMounted) {
            setRepositories(transformedRepos);
            handleSuccess('Successfully loaded your GitHub repositories');
          }
        } else {
          if (isMounted) setIsAppInstalled(false);
        }
      } catch (error) {
        console.error('Error fetching GitHub data:', error);
        if (isMounted) {
          setIsAppInstalled(false);
          handleError('Failed to fetch GitHub data. Please try again.');
        }
      } finally {
        if (isMounted) setIsReposLoading(false);
      }
    };

    handleInstallationCheck();
    return () => {
      isMounted = false;
    };
  }, [activeMainTab, status, session?.accessToken, handleError, handleSuccess]);

  const handleInstallApp = () => {
    try {
      const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'YOUR_APP_NAME';
      window.location.href = `https://github.com/apps/${appName}/installations/new`;
    } catch {
      handleError('Failed to initiate GitHub app installation.');
    }
  };

  const handleManageAccess = () => {
    try {
      const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'YOUR_APP_NAME';
      if (installationId) {
        window.open(`https://github.com/apps/${appName}/installations/${installationId}`, '_blank');
      } else {
        window.open('https://github.com/settings/installations', '_blank');
      }
    } catch {
      handleError('Failed to open GitHub settings.');
    }
  };

  const handleVizifyRepo = async (repo: Repository) => {
    setProcessingRepos((prev) => [...prev, repo.id]);
    setLoading(true);
    setError(null);

    try {
      const requestData = {
        repo_url: repo.html_url,
        branch: repo.branch || 'main',
        jwt_token: session?.jwt_token,
      };
      const { text_content: formattedText, repo_id } = await fetchGithubRepoWithAuth(requestData);

      setCurrentRepoId(repo_id);
      setOutput(formattedText);
      setSourceType('github');
      setSourceData(requestData);
      setOutputMessage('Repository analysis successful!');
      router.push('/results');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process repository.';
      handleError(message);
      setError(message);
    } finally {
      setProcessingRepos((prev) => prev.filter((id) => id !== repo.id));
      setLoading(false);
    }
  };

  const filteredRepositories = repositories.filter((repo) => {
    const matchesSearch =
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeRepoFilter === 'all') return matchesSearch;
    if (activeRepoFilter === 'public') return matchesSearch && !repo.private;
    if (activeRepoFilter === 'private') return matchesSearch && repo.private;
    return matchesSearch;
  });

  // --- Handlers for GitHub URL & ZIP Upload Forms ---
  const handleGitHubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }
    setLoading(true);
    setError(null);
    setOutput(null);
    setOutputMessage(null);

    try {
      const requestData = {
        repo_url: repoUrl.trim(),
        access_token: accessToken.trim() || undefined,
        branch: branch.trim() || 'main',
        jwt_token: session?.jwt_token || undefined,
      };
      const { text_content: formattedText, repo_id } = await fetchGithubRepoWithAuth(requestData);
      setCurrentRepoId(repo_id);
      setOutput(formattedText);
      setSourceType('github');
      setSourceData(requestData);
      setOutputMessage('Repository analysis successful!');
      router.push('/results');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to analyze repository.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipFile) {
      setError('Please select a ZIP file');
      return;
    }
    setLoading(true);
    setError(null);
    setOutput(null);
    setOutputMessage(null);

    try {
      const { text_content: text, repo_id } = await uploadLocalZipWithAuth(
        zipFile,
        session?.jwt_token || '',
      );
      setCurrentRepoId(repo_id);
      setOutput(text);
      setSourceType('zip');
      setSourceData(zipFile);
      setOutputMessage('ZIP file processed successfully!');
      router.push('/results');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to process ZIP file.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setZipFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setZipFile(e.target.files[0]);
      setError(null);
    }
  };

  // --- Render Method ---
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-6 sm:space-y-8">
        <Tabs
          defaultValue="github"
          className="space-y-6 sm:space-y-8"
          onValueChange={(val) => {
            if (val === 'my-repos' && status === 'unauthenticated') {
              router.push('/signin');
              return;
            }
            setActiveMainTab(val);
          }}
        >
          {/* Tab Navigation */}
          <div className="flex justify-center">
            <TabsList className="bg-background/80 backdrop-blur-xl border border-border/60 rounded-2xl p-1 sm:p-2 shadow-lg min-h-[50px] sm:min-h-[60px] w-full sm:w-auto">
              <TabsTrigger
                value="github"
                className="rounded-xl px-3 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2 sm:gap-3 min-w-[120px] sm:min-w-[160px] justify-center"
              >
                <Github className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden xs:inline">GitHub Repository</span>
                <span className="xs:hidden">GitHub</span>
              </TabsTrigger>
              <TabsTrigger
                value="upload"
                className="rounded-xl px-3 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2 sm:gap-3 min-w-[120px] sm:min-w-[160px] justify-center"
              >
                <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden xs:inline">ZIP Upload</span>
                <span className="xs:hidden">Upload</span>
              </TabsTrigger>
              <TabsTrigger
                value="my-repos"
                className="rounded-xl px-3 sm:px-8 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-muted/50 flex items-center gap-2 sm:gap-3 min-w-[120px] sm:min-w-[160px] justify-center"
              >
                <GitBranch className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden xs:inline">My Repositories</span>
                <span className="xs:hidden">My Repos</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* GitHub Tab */}
          <TabsContent
            value="github"
            className="animate-in fade-in-50 duration-300 max-h-[70vh] overflow-y-auto"
          >
            <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10">
                    <Github className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold tracking-tight">
                      GitHub Repository
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Enter a GitHub repository URL to analyze its structure and generate insights
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-8">
                <form onSubmit={handleGitHubSubmit} className="space-y-4 sm:space-y-6">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="repo-url"
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <GitBranch className="h-4 w-4 text-primary" /> Repository URL
                      </Label>
                      <SupportedLanguages languages={SUPPORTED_LANGUAGES} />
                    </div>
                    <Input
                      id="repo-url"
                      placeholder="https://github.com/username/repository"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="h-10 sm:h-12 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm text-sm sm:text-base"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="rounded-xl text-muted-foreground hover:text-foreground text-xs sm:text-sm"
                    >
                      <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-2" /> Advanced Options
                      <ArrowRight
                        className={cn(
                          'h-3 w-3 sm:h-4 sm:w-4 ml-2 transition-transform',
                          showAdvanced && 'rotate-90',
                        )}
                      />
                    </Button>
                  </div>
                  {showAdvanced && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:space-y-3">
                          <Label
                            htmlFor="access-token"
                            className="flex items-center gap-2 text-sm font-medium"
                          >
                            <Lock className="h-4 w-4 text-primary" /> Access Token (Optional)
                          </Label>
                          <Input
                            id="access-token"
                            type="password"
                            placeholder="ghp_xxxxxxxxxxxx"
                            value={accessToken || ''}
                            onChange={(e) => setAccessToken(e.target.value)}
                            className="h-10 sm:h-12 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm text-sm sm:text-base"
                          />
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          <Label htmlFor="branch" className="text-sm font-medium">
                            {' '}
                            Branch{' '}
                          </Label>
                          <Input
                            id="branch"
                            placeholder="main"
                            value={branch || ''}
                            onChange={(e) => setBranch(e.target.value)}
                            className="h-10 sm:h-12 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm text-sm sm:text-base"
                          />
                        </div>
                      </div>
                      <div className="bg-muted/30 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-border/30">
                        <div className="flex items-start gap-3">
                          <div className="p-1.5 rounded-full bg-blue-500/10 flex-shrink-0">
                            <Info className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                          </div>
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium">Privacy & Security</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Your access token is stored locally and only sent to GitHub. It&apos;s
                              never shared with our servers.{' '}
                              <a
                                href="https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:no-underline"
                              >
                                How to create a GitHub token
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={loading || !repoUrl.trim()}
                    className="w-full h-10 sm:h-12 text-sm sm:text-base rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02]"
                    size="lg"
                  >
                    {loading && activeMainTab === 'github' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        <span className="hidden xs:inline">Analyze Repository</span>
                        <span className="xs:hidden">Analyze</span>
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent
            value="upload"
            className="animate-in fade-in-50 duration-300 max-h-[70vh] overflow-y-auto"
          >
            {/* ... (Existing Upload tab content is unchanged) ... */}
            <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-primary/10">
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold tracking-tight">
                      ZIP File Upload
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Upload a ZIP file containing your project to analyze its structure
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-8">
                <form onSubmit={handleZipSubmit} className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Upload File</span>
                    <SupportedLanguages languages={SUPPORTED_LANGUAGES} />
                  </div>
                  <div
                    className={cn(
                      'relative border-2 border-dashed rounded-xl sm:rounded-2xl p-6 sm:p-12 text-center transition-all duration-300',
                      dragActive
                        ? 'border-primary bg-primary/5 scale-[1.02]'
                        : 'border-border/50 hover:border-primary/50 hover:bg-muted/20',
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleFileInput}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-3 sm:space-y-4">
                      <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-xl sm:rounded-2xl flex items-center justify-center">
                        <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <p className="text-sm sm:text-lg font-medium">
                          {dragActive
                            ? 'Drop your ZIP file here'
                            : 'Click to browse or drag and drop'}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Supports ZIP files up to 100MB
                        </p>
                      </div>
                    </div>
                  </div>
                  {zipFile && (
                    <div className="bg-muted/30 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-border/30 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 sm:p-2 bg-green-500/10 rounded-lg sm:rounded-xl flex-shrink-0">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base truncate">
                            {zipFile.name}
                          </p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {(zipFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Badge className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 text-xs">
                          Ready
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setZipFile(null)}
                          className="h-6 w-6 sm:h-8 sm:w-8 rounded-full hover:bg-muted/50 flex-shrink-0"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={loading || !zipFile}
                    className="w-full h-10 sm:h-12 text-sm sm:text-base rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02]"
                    size="lg"
                  >
                    {loading && activeMainTab === 'upload' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        <span className="hidden xs:inline">Process ZIP File</span>
                        <span className="xs:hidden">Process</span>
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>

          {/* My Repositories Tab */}
          <TabsContent value="my-repos" className="animate-in fade-in-50 duration-300">
            <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
              {isReposLoading ? (
                <div className="p-4 sm:p-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-64 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                  </div>
                  <Skeleton className="h-12 w-full rounded-2xl" />
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ) : !isAppInstalled ? (
                <>
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
                          Install our GitHub App to select from your repositories
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 sm:p-8">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="rounded-full bg-primary/10 p-4 mb-6">
                        <Github className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="text-2xl font-semibold mb-2">Connect Your Repositories</h2>
                      <p className="text-muted-foreground max-w-md mb-8">
                        Install the gitvizz GitHub App to securely access and analyze your
                        repositories with one click.
                      </p>
                      <Button
                        size="lg"
                        className="w-full max-w-sm h-12 text-base rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02]"
                        onClick={handleInstallApp}
                      >
                        <Github className="h-5 w-5 mr-2" /> Set up GitHub App{' '}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="relative w-full sm:max-w-md">
                      <Input
                        placeholder="Search repositories..."
                        className="w-full h-10 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <Code className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                    <Button
                      variant="outline"
                      className="h-10 px-4 text-sm rounded-xl hover:bg-muted/50 transition-all duration-200 self-end sm:self-auto"
                      onClick={handleManageAccess}
                    >
                      Manage Access <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </div>

                  <Tabs defaultValue="all" className="w-full" onValueChange={setActiveRepoFilter}>
                    <div className="flex justify-center border-b border-border/30">
                      <TabsList className="bg-transparent p-0 h-auto">
                        <TabsTrigger
                          value="all"
                          className="text-sm data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                        >
                          All ({repositories.length})
                        </TabsTrigger>
                        <TabsTrigger
                          value="public"
                          className="text-sm data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                        >
                          Public ({repositories.filter((r) => !r.private).length})
                        </TabsTrigger>
                        <TabsTrigger
                          value="private"
                          className="text-sm data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                        >
                          Private ({repositories.filter((r) => r.private).length})
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    <div className="mt-6">
                      {filteredRepositories.length > 0 ? (
                        <div className="divide-y divide-border/30 border border-border/50 rounded-xl overflow-hidden bg-background/20 max-h-[45vh] overflow-y-auto">
                          {filteredRepositories.map((repo) => (
                            <div
                              key={repo.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center gap-4 mb-3 sm:mb-0 min-w-0">
                                <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                                  {repo.private ? (
                                    <Lock className="h-4 w-4 text-primary" />
                                  ) : (
                                    <Code className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <a
                                      href={repo.html_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-base font-semibold tracking-tight truncate hover:underline"
                                    >
                                      {repo.name}
                                    </a>
                                    {repo.private && (
                                      <Badge variant="outline" className="text-xs rounded-md">
                                        Private
                                      </Badge>
                                    )}
                                    {repo.language && (
                                      <Badge variant="secondary" className="text-xs rounded-md">
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
                                  className="h-9 px-4 text-sm rounded-xl bg-primary hover:bg-primary/90"
                                  onClick={() => handleVizifyRepo(repo)}
                                  disabled={processingRepos.includes(repo.id) || loading}
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
                        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-xl">
                          <div className="rounded-full bg-muted p-3 mb-4">
                            <AlertCircle className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-medium mb-2">No Repositories Found</h3>
                          <p className="text-muted-foreground max-w-md mb-6">
                            {searchQuery
                              ? `No repositories match your search for "${searchQuery}".`
                              : `No ${activeRepoFilter !== 'all' ? activeRepoFilter : ''} repositories found. Try adding more via "Manage Access".`}
                          </p>
                        </div>
                      )}
                    </div>
                  </Tabs>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
