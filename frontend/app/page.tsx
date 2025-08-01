'use client';

import { useResultData } from '@/context/ResultDataContext';
import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Custom Components
import { RepoTabs } from '@/components/repo-tabs';
import { showToast } from '@/components/toaster';
import Footer from '@/components/footer';
import Header from '@/components/header';

function HomeContent() {
  const { error, outputMessage, setError, setOutputMessage } = useResultData();
  const searchParams = useSearchParams();
  const prefilledRepo = searchParams.get('repo');

  useEffect(() => {
    if (error) {
      showToast.error(error);
      setError(''); // Clear error after showing
    }
  }, [error, setError]);

  useEffect(() => {
    if (outputMessage) {
      showToast.success(outputMessage);
      setOutputMessage(''); // Clear message after showing
    }
  }, [outputMessage, setOutputMessage]);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground antialiased relative">
      {/* Visual Anchor - Top Gradient */}
      <div className="fixed top-0 left-0 right-0 h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Header */}
      <Header />

      <main className="flex flex-col items-center w-full relative z-10 max-w-5xl mx-auto px-6 pb-16">
        {/* Subtle Hero Section */}
        <div className="text-center mb-8 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            From Repo to Reasoning — <span className="text-primary">Instantly</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Transform any GitHub repository into comprehensive documentation and interactive insights.
          </p>
          
          {/* Hub to Vizz Hint */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/30 backdrop-blur-sm rounded-full border border-border/30 text-sm text-muted-foreground hover:bg-primary/5 hover:border-primary/30 transition-all duration-300 cursor-default">
            <span className="font-mono">github.com/user/repo</span>
            <span className="text-primary">→</span>
            <span className="font-mono text-primary font-medium">gitvizz.com/user/repo</span>
          </div>
        </div>

        <RepoTabs prefilledRepo={prefilledRepo} />
      </main>

      {/* Visual Anchor - Bottom Gradient */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
