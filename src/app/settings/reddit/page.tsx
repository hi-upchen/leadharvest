'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Suspense } from 'react'

function RedditSettingsContent() {
  const [status, setStatus] = useState<{ connected: boolean; username: string | null }>({
    connected: false,
    username: null,
  })
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const connected = searchParams.get('connected')
  const error = searchParams.get('error')

  useEffect(() => {
    fetch('/api/auth/reddit/status')
      .then(r => r.json())
      .then(data => {
        setStatus(data)
        setLoading(false)
      })
  }, [])

  async function disconnect() {
    await fetch('/api/auth/reddit/disconnect', { method: 'POST' })
    setStatus({ connected: false, username: null })
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Reddit Connection</h1>

      {connected && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
          ✅ Successfully connected your Reddit account!
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          OAuth error: {error}. Please try again.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reddit Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : status.connected ? (
            <>
              <p className="text-green-700 font-medium">✅ Connected as u/{status.username}</p>
              <p className="text-sm text-muted-foreground">
                Your Reddit account is connected. The app will use this account to post replies
                when you approve them.
              </p>
              <Button variant="destructive" onClick={disconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Connect your Reddit account to post approved replies. The app uses your own account
                — no bot accounts.
              </p>
              <p className="text-sm text-muted-foreground">
                Required scopes: <code className="bg-gray-100 px-1 rounded">identity submit history read</code>
              </p>
              <Button onClick={() => window.location.href = '/api/auth/reddit/connect'}>
                Connect Reddit Account
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reddit App Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>To connect Reddit, you need a registered Reddit app:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer" className="underline text-primary">reddit.com/prefs/apps</a></li>
            <li>Click &quot;Create App&quot; → choose &quot;web app&quot;</li>
            <li>Set redirect URI to: <code className="bg-gray-100 px-1 rounded">{process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/auth/reddit/callback</code></li>
            <li>Copy Client ID and Secret to your <code className="bg-gray-100 px-1 rounded">.env.local</code></li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RedditSettingsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <RedditSettingsContent />
    </Suspense>
  )
}
