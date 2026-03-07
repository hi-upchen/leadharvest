'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw } from 'lucide-react'

interface ScanLog {
  id: string
  triggeredBy: string
  status: string
  postsFound: number
  newPosts: number
  claudeCalls: number
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
}

export default function ScanPage() {
  const [logs, setLogs] = useState<ScanLog[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadLogs() {
    const res = await fetch('/api/scan/history')
    setLogs(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [])

  async function scanNow() {
    setScanning(true)
    setScanError(null)
    try {
      const res = await fetch('/api/scan', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setScanError(data.error ?? 'Scan failed')
      }
    } catch {
      setScanError('Network error during scan')
    } finally {
      setScanning(false)
      loadLogs()
    }
  }

  const getDuration = (log: ScanLog) => {
    if (!log.completedAt) return '...'
    const ms = new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Scan History</h1>
        <Button onClick={scanNow} disabled={scanning}>
          <RefreshCw size={14} className={`mr-1 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan Now'}
        </Button>
      </div>

      {scanError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          Scan error: {scanError}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Automated scans run every 3 hours. Manual scans can be triggered at any time.
      </p>

      {loading ? (
        <p className="text-muted-foreground">Loading scan history...</p>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No scans yet. Click &quot;Scan Now&quot; to run your first scan.</p>
          <p className="text-sm mt-1">
            Make sure to connect your Reddit account and configure products first.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div
              key={log.id}
              className="border rounded p-3 flex flex-wrap gap-3 items-center text-sm"
            >
              <Badge
                variant={log.triggeredBy === 'manual' ? 'secondary' : 'outline'}
              >
                {log.triggeredBy}
              </Badge>
              <Badge
                variant={
                  log.status === 'completed'
                    ? 'default'
                    : log.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {log.status}
              </Badge>
              <span className="text-muted-foreground">
                {new Date(log.startedAt).toLocaleString()}
              </span>
              <span>{log.newPosts} new posts</span>
              <span className="text-muted-foreground">{log.claudeCalls} AI calls</span>
              <span className="text-muted-foreground">{getDuration(log)}</span>
              {log.errorMessage && (
                <span className="text-red-500 text-xs w-full">{log.errorMessage}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
