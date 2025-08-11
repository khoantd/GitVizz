'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch'; // Using Switch for a better toggle UX
import {
  Key,
  Save,
  Eye,
  EyeOff,
  ArrowLeft,
  Plus,
  Shield,
  Zap,
  Globe,
  Lock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { showToast } from '@/components/toaster';
import { saveApiKey, getAvailableModels, verifyApiKey } from '@/utils/api';
import type { AvailableModelsResponse } from '@/api-client/types.gen';
import { useResultData } from '@/context/ResultDataContext';

export default function ApiKeysPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { userKeyPreferences, setUserKeyPreferences } = useResultData();
  const addKeyCardRef = useRef<HTMLDivElement>(null);

  // State management
  const [apiKey, setApiKey] = useState('');
  const [keyName, setKeyName] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid?: boolean;
    message?: string;
    availableModels?: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState<AvailableModelsResponse | null>(null);
  const [provider, setProvider] = useState<string>('gemini');

  // Fetch available models on mount
  useEffect(() => {
    const fetchAndSetModels = async () => {
      if (!session?.jwt_token) return;
      try {
        setIsLoading(true);
        const models = await getAvailableModels(session.jwt_token);
        setAvailableModels(models);

        // Initialize preferences if they don't exist
        if (Object.keys(userKeyPreferences).length === 0) {
          const initialPreferences: Record<string, boolean> = {};
          models.user_has_keys?.forEach((key) => {
            initialPreferences[key] = true;
          });
          setUserKeyPreferences(initialPreferences);
        }
      } catch {
        showToast.error('Failed to load your key configuration.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndSetModels();
  }, [session?.jwt_token, setUserKeyPreferences, userKeyPreferences]); // Dependencies are important

  // Redirect if not authenticated
  useEffect(() => {
    if (session === null) {
      // Check for session explicitly being null after loading
      router.push('/signin');
    }
  }, [session, router]);

  const handleToggleUserKey = (provider: string, enabled: boolean) => {
    const newPreferences = { ...userKeyPreferences, [provider]: enabled };
    setUserKeyPreferences(newPreferences);
    showToast.success(
      `${provider.charAt(0).toUpperCase() + provider.slice(1)} key preference updated.`,
    );
  };

  const handleVerifyKey = async () => {
    if (!apiKey.trim() || !session?.jwt_token) return;

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const result = await verifyApiKey({
        token: session.jwt_token,
        provider,
        api_key: apiKey.trim(),
      });

      setVerificationResult({
        isValid: result.is_valid,
        message: result.message,
        availableModels: result.available_models,
      });

      if (result.is_valid) {
        showToast.success(`✅ ${result.message}`);
      } else {
        showToast.error(`❌ ${result.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setVerificationResult({
        isValid: false,
        message: errorMessage,
      });
      showToast.error(`Failed to verify API key: ${errorMessage}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim() || !session?.jwt_token) return;

    setIsSaving(true);
    try {
      await saveApiKey({
        token: session.jwt_token,
        provider,
        api_key: apiKey.trim(),
        key_name: keyName.trim() || undefined,
      });

      setApiKey('');
      setKeyName('');
      setVerificationResult(null);
      showToast.success(
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key saved successfully!`,
      );

      // Refetch models to update the UI with the new key status
      const models = await getAvailableModels(session.jwt_token);
      setAvailableModels(models);

      // Ensure the new key is enabled by default in preferences
      handleToggleUserKey(provider, true);
    } catch (error) {
      showToast.error(
        `Failed to save API key: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectProviderToAdd = (providerValue: string) => {
    setProvider(providerValue);
    setVerificationResult(null); // Clear verification when switching providers
    addKeyCardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getProviderInfo = (p: string) => {
    const info = {
      openai: {
        icon: '🤖',
        url: 'https://platform.openai.com/api-keys',
        instruction: 'Create an API key from your OpenAI dashboard.',
      },
      anthropic: {
        icon: '🧠',
        url: 'https://console.anthropic.com/',
        instruction: 'Generate an API key from Anthropic Console.',
      },
      gemini: {
        icon: '💎',
        url: 'https://makersuite.google.com/app/apikey',
        instruction: 'Get your API key from Google AI Studio.',
      },
      groq: {
        icon: '⚡️',
        url: 'https://console.groq.com/keys',
        instruction: 'Create an API key from Groq Console.',
      },
      xai: {
        icon: '🚀',
        url: 'https://console.x.ai/',
        instruction: 'Generate an API key from xAI Console.',
      },
    };
    return (
      info[p as keyof typeof info] || {
        icon: '🔑',
        url: '#',
        instruction: "Check the provider's documentation for API key instructions.",
      }
    );
  };

  // --- Loading and Auth States ---
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading configurations...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 p-8">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-medium">Authentication Required</h3>
          <p className="text-sm text-muted-foreground">Please sign in to manage your API keys.</p>
        </div>
      </div>
    );
  }

  if (!availableModels) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 p-8">
          <XCircle className="h-10 w-10 mx-auto text-destructive" />
          <h3 className="font-medium">Failed to Load</h3>
          <p className="text-sm text-muted-foreground">
            There was an error fetching API key information.
          </p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  const allProviders = Object.entries(availableModels.providers).map(([key, models]) => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    description: `${models.length} models available`,
    hasUserKey: availableModels.user_has_keys?.includes(key) ?? false,
    icon: getProviderInfo(key).icon,
  }));

  const providerInfo = getProviderInfo(provider);

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-primary/5 to-transparent -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <h1 className="font-semibold text-lg">API Key Management</h1>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/60"
          >
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            Secure & Encrypted
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl space-y-8">
        {/* Add New Key Form */}
        <Card ref={addKeyCardRef}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add or Update API Key
            </CardTitle>
            <CardDescription>
              Select a provider and enter your API key to connect. Adding a key for an existing
              provider will overwrite it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="provider">AI Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allProviders.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{p.icon}</span>
                          <span className="font-medium">{p.label}</span>
                          {p.hasUserKey && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="keyName">Key Name (Optional)</Label>
                <Input
                  id="keyName"
                  placeholder="e.g., Personal Key"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apiKey">
                API Key for {allProviders.find((p) => p.value === provider)?.label}
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  placeholder="Paste your API key here"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-11 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-9 w-9"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
              <a
                href={providerInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 pt-1"
              >
                <Globe className="h-3 w-3" />
                {providerInfo.instruction}
              </a>
            </div>

            {/* Verification Result */}
            {verificationResult && (
              <div
                className={cn(
                  'p-3 rounded-lg border text-sm',
                  verificationResult.isValid
                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                    : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {verificationResult.isValid ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="font-medium">
                    {verificationResult.isValid ? 'Valid API Key' : 'Invalid API Key'}
                  </span>
                </div>
                <p>{verificationResult.message}</p>
                {verificationResult.availableModels &&
                  verificationResult.availableModels.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium mb-1">Available models:</p>
                      <div className="flex flex-wrap gap-1">
                        {verificationResult.availableModels.slice(0, 5).map((model) => (
                          <Badge key={model} variant="outline" className="text-xs">
                            {model}
                          </Badge>
                        ))}
                        {verificationResult.availableModels.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{verificationResult.availableModels.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleVerifyKey}
                disabled={!apiKey.trim() || isVerifying}
                variant="outline"
                className="flex-1 h-11 text-base"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" /> Verify Key
                  </>
                )}
              </Button>

              <Button
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || isSaving}
                className="flex-1 h-11 text-base"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Save & Connect
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Your Connected Providers List */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Provider Connections
            </h2>
            <p className="text-muted-foreground">
              Manage your connected keys below. Keys you provide have higher rate limits.
            </p>
          </div>
          {allProviders.map((p) => (
            <Card
              key={p.value}
              className={cn(
                'transition-all',
                p.hasUserKey ? 'bg-green-50/30 dark:bg-green-900/10' : 'bg-muted/30',
              )}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{p.icon}</span>
                  <div>
                    <h3 className="font-semibold">{p.label}</h3>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {p.hasUserKey ? (
                    <>
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/60"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" /> Connected
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`switch-${p.value}`} className="text-sm font-medium">
                          Use My Key
                        </Label>
                        <Switch
                          id={`switch-${p.value}`}
                          checked={userKeyPreferences[p.value] ?? true}
                          onCheckedChange={(checked) => handleToggleUserKey(p.value, checked)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline">Not Connected</Badge>
                      <Button
                        variant="secondary"
                        onClick={() => handleSelectProviderToAdd(p.value)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Key
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Your Keys are Safe:</strong> API keys are stored using industry-standard
            encryption and are only used to make requests to providers on your behalf.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  );
}
