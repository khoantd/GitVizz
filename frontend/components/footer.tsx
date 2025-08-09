import { Github, Globe, Star } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="relative w-full bottom-0 z-10 border-t border-border/50 bg-background/80 backdrop-blur-sm mt-4">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Top section with Open Source emphasis */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/adithya-s-k/gitvizz"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Repository"
              className="flex items-center gap-2 text-sm font-semibold text-foreground hover:underline transition-colors group"
            >
              <Github className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span>Proudly Open Source</span>
              <Star className="h-4 w-4 group-hover:text-yellow-500 transition-colors" />
            </a>
            <div className="hidden md:block h-4 border-l border-border/30" />
            <a
              href="https://cognitivelab.in"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cognitivelab Website"
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="h-4 w-4" />
              CognitiveLab
            </a>
          </div>

          {/* Attribution */}
          <div className="text-xs text-muted-foreground text-center md:text-right">
            Made with ❤️ by{' '}
            <a
              href="https://cognitivelab.in"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              Cognitivelab
            </a>{' '}
            (powered by <span className="font-semibold text-primary">omniparse</span>)
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="text-center text-xs text-muted-foreground border-t border-border/30 pt-4">
          &copy; {new Date().getFullYear()} gitvizz - Understand Any Codebase in Minutes.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
