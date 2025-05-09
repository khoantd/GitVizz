"use client";
import { useEffect, useState } from "react";

export function useThemeGraph() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Try to detect theme from document.documentElement or body class
    const getCurrentTheme = () => {
      if (typeof window === 'undefined') return 'light';
      if (document.documentElement.classList.contains('dark')) return 'dark';
      if (document.body.classList.contains('dark')) return 'dark';
      return 'light';
    };
    setTheme(getCurrentTheme());
    // Listen for theme changes
    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
