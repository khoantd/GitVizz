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

interface ApiKeyManagerProps {
  onClose: () => void
}

export function ApiKeyManager({ onClose }: ApiKeyManagerProps) {
  const { data: session } = useSession()
  const [provider, setProvider] = useState<string>("openai")
  const [apiKey, setApiKey] = useState("")
  const [keyName, setKeyName] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [savedKeys, setSavedKeys] = useState<string[]>([])

  const providers = [
    { value: "openai", label: "OpenAI", description: "GPT models" },
    { value: "anthropic", label: "Anthropic", description: "Claude models" },
    { value: "gemini", label: "Google Gemini", description: "Gemini models" },
  ]

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
      <div className="space-y-4">
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
                    <Badge variant="secondary" className="text-xs">
                      {p.description}
                    </Badge>
                    {savedKeys.includes(p.value) && <Check className="h-3 w-3 text-green-500" />}
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
