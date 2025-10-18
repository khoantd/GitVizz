'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiKeyValidation } from '@/hooks/use-api-key-validation';
import { ApiKeyModal } from './api-key-modal';

interface FloatingChatButtonProps {
  isOpen: boolean;
  unreadCount?: number;
  isLoading?: boolean;
  onToggle?: () => void;
}

export function FloatingChatButton({ isOpen, unreadCount = 0, isLoading = false, onToggle }: FloatingChatButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const apiKeyValidation = useApiKeyValidation();

  const handleClick = async () => {
    // Check API keys before opening chat
    const canProceed = await apiKeyValidation.checkApiKeysBeforeAction();
    if (!canProceed) return;
    
    // Toggle chat sidebar
    onToggle?.();
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          <Button
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              'h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:shadow-xl',
              'bg-primary hover:bg-primary/90 text-primary-foreground',
              'border-2 border-background/20',
              isOpen && 'rotate-180',
              isHovered && 'scale-110',
              !apiKeyValidation.hasValidKeys && !isOpen && 'bg-orange-500 hover:bg-orange-600',
            )}
            size="icon"
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                {!apiKeyValidation.hasValidKeys ? (
                  <AlertTriangle className="h-6 w-6" />
                ) : (
                  <MessageCircle className="h-6 w-6" />
                )}
                {unreadCount > 0 && (
                  <div className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </>
            )}
          </Button>

        </div>
      </div>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={apiKeyValidation.showApiKeyModal}
        onClose={() => apiKeyValidation.setShowApiKeyModal(false)}
        userHasKeys={apiKeyValidation.userHasKeys}
        availableProviders={apiKeyValidation.availableProviders}
      />
    </>
  );
}
