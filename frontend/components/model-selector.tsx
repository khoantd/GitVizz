'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RefreshCw, Settings, Zap, Brain, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelSelectorProps {
  currentModel: Partial<{
    provider: string;
    model: string;
    temperature: number;
  }>;
  availableModels: {
    providers: Record<string, string[]>;
    user_has_keys: string[];
  };
  onModelChange: (provider: string, model: string) => void;
  onRefresh: () => void;
}

export function ModelSelector({
  currentModel,
  availableModels,
  onModelChange,
  onRefresh,
}: ModelSelectorProps) {
  const safeProvider =
    currentModel.provider ?? Object.keys(availableModels.providers)[0] ?? 'openai';
  const safeModel =
    currentModel.model ?? availableModels.providers[safeProvider]?.[0] ?? 'gpt-3.5-turbo';
  const [temperature, setTemperature] = useState(currentModel.temperature ?? 0.7);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai':
        return <Zap className="h-4 w-4" />;
      case 'anthropic':
        return <Brain className="h-4 w-4" />;
      case 'gemini':
        return <Sparkles className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'anthropic':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'gemini':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const hasUserKey = (provider: string) => {
    return availableModels.user_has_keys.includes(provider);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">AI Model</Label>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onRefresh} className="h-7 w-7 p-0">
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Popover open={showAdvanced} onOpenChange={setShowAdvanced}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Settings className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Temperature</Label>
                  <div className="mt-2 space-y-2">
                    <Slider
                      value={[temperature]}
                      onValueChange={(value) => setTemperature(value[0])}
                      max={2}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Focused (0)</span>
                      <span className="font-medium">{temperature}</span>
                      <span>Creative (2)</span>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        {/* Provider Selection */}
        <Select
          value={safeProvider}
          onValueChange={(provider) => {
            const firstModel = availableModels.providers[provider]?.[0];
            if (firstModel) {
              onModelChange(provider, firstModel);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                {getProviderIcon(safeProvider)}
                <span className="capitalize">{safeProvider}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.keys(availableModels.providers).map((provider) => (
              <SelectItem key={provider} value={provider}>
                <div className="flex items-center gap-2">
                  {getProviderIcon(provider)}
                  <span className="capitalize">{provider}</span>
                  {hasUserKey(provider) && (
                    <Badge variant="secondary" className="text-xs">
                      Your Key
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Model Selection */}
        <Select value={safeModel} onValueChange={(model) => onModelChange(safeProvider, model)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn('text-xs', getProviderColor(safeProvider))}
                >
                  {safeModel}
                </Badge>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(availableModels.providers[safeProvider] || []).map((model: string) => (
              <SelectItem key={model} value={model}>
                <Badge
                  variant="secondary"
                  className={cn('text-xs', getProviderColor(safeProvider))}
                >
                  {model}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
