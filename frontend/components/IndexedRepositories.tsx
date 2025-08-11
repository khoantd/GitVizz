'use client';

import { useRouter } from 'next/navigation';
import { Clock, Github, Upload, ArrowRight, ChevronRight, Calendar, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIndexedRepositories } from '@/hooks/useIndexedRepositories';
import type { IndexedRepository } from '@/api-client/types.gen';
import { cn } from '@/lib/utils';

interface IndexedRepositoriesProps {
  className?: string;
}

export function IndexedRepositories({ className }: IndexedRepositoriesProps) {
  const router = useRouter();
  const { repositories, loading, error, isPremium, totalCount } = useIndexedRepositories({
    limit: 6, // Show max 6 recent repositories
    autoLoad: true,
  });
  // Future expansion functionality
  // const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const formatDate = (dateInput: string | Date) => {
    const date = new Date(dateInput);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) {
        return `${diffInDays}d ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
      }
    }
  };

  const getRepoDisplayName = (repo: IndexedRepository) => {
    if (repo.source === 'github' && repo.github_url) {
      try {
        const url = new URL(repo.github_url);
        return url.pathname.substring(1); // Remove leading slash
      } catch {
        return repo.repo_name;
      }
    }
    return repo.repo_name;
  };

  const handleRepoClick = (repo: IndexedRepository) => {
    if (repo.source === 'github' && repo.github_url) {
      try {
        const url = new URL(repo.github_url);
        const [owner, name] = url.pathname.substring(1).split('/');
        router.push(`/results/${owner}/${name}`);
      } catch {
        router.push('/results');
      }
    } else {
      router.push('/results');
    }
  };

  // Don't render anything if there are no repositories and not loading
  if (!loading && repositories.length === 0 && !error) {
    return null;
  }

  return (
    <div className={cn('w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6', className)}>
      <div className="bg-background/40 backdrop-blur-xl border border-border/30 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-border/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold tracking-tight">
                  Recently Indexed
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {loading ? 'Loading...' : `${totalCount} repositories analyzed`}
                </p>
              </div>
            </div>

            {/* Power Features Badge */}
            {isPremium && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 rounded-xl px-3 py-1 text-xs font-medium shadow-lg">
                <Sparkles className="h-3 w-3 mr-1.5" />
                Power Features
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {loading ? (
            // Loading skeletons
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : (
            // Repository cards
            <div className="space-y-2">
              {repositories.map((repo) => {
                const displayName = getRepoDisplayName(repo);

                return (
                  <div
                    key={repo.repo_id}
                    className="group p-3 sm:p-4 rounded-xl border border-border/30 bg-background/20 hover:bg-background/40 hover:border-border/50 transition-all duration-200 cursor-pointer"
                    onClick={() => handleRepoClick(repo)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                          {repo.source === 'github' ? (
                            <Github className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                          ) : (
                            <Upload className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{displayName}</span>
                            <Badge
                              variant="outline"
                              className="text-xs rounded-md px-1.5 py-0.5 h-auto"
                            >
                              {repo.branch}
                            </Badge>
                            {repo.file_size_mb && (
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {repo.file_size_mb}MB
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatDate(repo.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {repo.source === 'github' && repo.github_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(repo.github_url!, '_blank');
                            }}
                          >
                            <Github className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Show more button */}
          {!loading && repositories.length > 0 && totalCount > repositories.length && (
            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-primary"
                onClick={() => router.push('/repositories')}
              >
                View all {totalCount} repositories
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
