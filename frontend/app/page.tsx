"use client";

import { useResultData } from "@/context/ResultDataContext";
import { useEffect } from "react";

// Custom Components
import { RepoTabs } from "@/components/repo-tabs";
import { showToast } from "@/components/toaster";
import Footer from "@/components/footer";
import Header from "@/components/header"


export default function Home() {
  const { error, outputMessage, setError, setOutputMessage } = useResultData();

  useEffect(() => {
    if (error) {
      showToast.error(error);
      setError(""); // Clear error after showing
    }
  }, [error, setError]);

  useEffect(() => {
    if (outputMessage) {
      showToast.success(outputMessage);
      setOutputMessage(""); // Clear message after showing
    }
  }, [outputMessage, setOutputMessage]);

  return (
    <div className="min-h-screen">
      {/* Visual Anchor - Top Gradient */}
      <div className="fixed top-0 left-0 right-0 h-96 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      
      {/* Header */}
      <Header />

      <main className="flex items-center content-center min-h-[calc(100vh-15vh)] relative z-10 max-w-5xl mx-auto px-6 pb-16">
        <RepoTabs />
      </main>

      {/* Visual Anchor - Bottom Gradient */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

      {/* Footer */}
      <Footer />
    </div>
  );
}