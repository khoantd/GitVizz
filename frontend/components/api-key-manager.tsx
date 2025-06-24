"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Key, Save, Eye, EyeOff, Check, AlertCircle } from "lucide-react"
import { saveApiKey } from "@/utils/api"
import { useSession } from "next-auth/react"
import { showToast } from "@/components/toaster"
import { AvailableModelsResponse } from "@/api-client/types.gen"

interface ApiKeyManagerProps {
  onClose: () => void,
  avavailableModels: AvailableModelsResponse,
  useUserKeys: Record<string, boolean>
  onToggleUserKey: (keys: Record<string, boolean>) => void
}

export function ApiKeyManager({ onClose, avavailableModels, useUserKeys, onToggleUserKey }: ApiKeyManagerProps) {
  const { data: session } = useSession()
  const [provider, setProvider] = useState<string>("gemini")
  const [apiKey, setApiKey] = useState("")
  const [keyName, setKeyName] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [savedKeys, setSavedKeys] = useState<string[]>([])

  const [localUseUserKeys, setLocalUseUserKeys] = useState(useUserKeys)
  const userHasKeys = avavailableModels.user_has_keys || []

  const handleToggleUserKey = (provider: string, enabled: boolean) => {
    const newPreferences = { ...localUseUserKeys, [provider]: enabled }
    setLocalUseUserKeys(newPreferences)
    onToggleUserKey(newPreferences)
  }

  // Transform providers object into an array of objects with value, label, and description
  const providers = Object.entries(avavailableModels.providers).map(([key, arr]) => ({
    value: key,
    label: key.charAt(0).toUpperCase() + key.slice(1), // Better label formatting
    description: `${arr.length} models available`,
    hasUserKey: userHasKeys.includes(key)
  }))

  const handleSaveKey = async () => {
    if (!apiKey.trim() || !session?.jwt_token) return

    setIsLoading(true)
    try {
      await saveApiKey({
        token: session.jwt_token,
        provider,
        api_key: apiKey.trim(),
        key_name: keyName.trim() || undefined,
      })

      setSavedKeys([...savedKeys, provider])
      setApiKey("")
      setKeyName("")
      showToast.success(`${provider} API key saved successfully`)
    } catch (error) {
      showToast.error(`Failed to save API key: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getProviderInstructions = (provider: string) => {
    switch (provider) {
      case "openai":
        return "Get your API key from https://platform.openai.com/api-keys"
      case "anthropic":
        return "Get your API key from https://console.anthropic.com/"
      case "gemini":
        return "Get your API key from https://makersuite.google.com/app/apikey"
      default:
        return "Check the provider's documentation for API key instructions"
    }
  }

  return (
    <div className="space-y-6">
      {/* User Key Preferences Section */}
      {userHasKeys.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Your API Keys</Label>
          <div className="space-y-2">
            {providers.filter(p => p.hasUserKey).map((provider) => (
              <div key={provider.value} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-green-500" />
                  <div>
                    <span className="font-medium">{provider.label}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">Connected</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`use-${provider.value}`} className="text-sm">Use your key</Label>
                  <input
                    id={`use-${provider.value}`}
                    type="checkbox"
                    checked={localUseUserKeys[provider.value] ?? true}
                    onChange={(e) => handleToggleUserKey(provider.value, e.target.checked)}
                    className="rounded"
                  />
                </div>
              </div>
            ))}
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Toggle off to use system keys (subject to rate limits). Your keys provide unlimited usage.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Add New Key Section */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Add New API Key</Label>

        <div>
          <Label htmlFor="provider">Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <div className="flex items-center gap-2">
                    <span>{p.label}</span>
                    {p.hasUserKey && <Check className="h-3 w-3 text-green-500" />}
                    <span className="text-xs text-muted-foreground">({p.description})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="keyName">Key Name (Optional)</Label>
          <Input
            id="keyName"
            placeholder="e.g., Personal Key, Project Key"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="apiKey">API Key</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showKey ? "text" : "password"}
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{getProviderInstructions(provider)}</AlertDescription>
        </Alert>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSaveKey} disabled={!apiKey.trim() || isLoading}>
          {isLoading ? (
            <>
              <Key className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Key
            </>
          )}
        </Button>
      </div>

      <Alert>
        <Key className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Your API keys are encrypted and stored securely. They are only used to make requests on your behalf.
        </AlertDescription>
      </Alert>
    </div>
  )
}
