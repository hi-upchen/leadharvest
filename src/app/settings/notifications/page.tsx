'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface NotificationSettings {
  email: string
  threshold: string
  quietStart: string
  quietEnd: string
  telegramEnabled: boolean
}

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    email: '',
    threshold: 'high',
    quietStart: '23:00',
    quietEnd: '08:00',
    telegramEnabled: false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then(r => r.json())
      .then(setSettings)
  }, [])

  function set<K extends keyof NotificationSettings>(
    field: K,
    value: NotificationSettings[K]
  ) {
    setSettings(s => ({ ...s, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/settings/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    if (res.ok) setSaved(true)
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Notification Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Notification Email</Label>
            <Input
              type="email"
              value={settings.email}
              onChange={e => set('email', e.target.value)}
              placeholder="your@email.com"
            />
            <p className="text-xs text-muted-foreground">
              Email to notify when new relevant posts are found.
            </p>
          </div>

          <div className="space-y-1">
            <Label>Notification Threshold</Label>
            <Select value={settings.threshold} onValueChange={v => set('threshold', v ?? 'high')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High relevance only</SelectItem>
                <SelectItem value="high,medium">High + Medium relevance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Quiet Hours Start (UTC)</Label>
              <Input
                type="time"
                value={settings.quietStart}
                onChange={e => set('quietStart', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Quiet Hours End (UTC)</Label>
              <Input
                type="time"
                value={settings.quietEnd}
                onChange={e => set('quietEnd', e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Notifications will be suppressed during quiet hours.
          </p>

          <div className="space-y-1">
            <p className="text-sm font-medium">Email Provider</p>
            <p className="text-xs text-muted-foreground">
              {process.env.NEXT_PUBLIC_APP_URL?.includes('localhost')
                ? '⚠️ RESEND_API_KEY not configured — emails will be logged to console only'
                : 'Using Resend for email delivery'}
            </p>
          </div>

          {saved && (
            <p className="text-sm text-green-600">✅ Settings saved!</p>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
