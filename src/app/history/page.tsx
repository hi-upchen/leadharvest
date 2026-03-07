'use client'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Download, ExternalLink } from 'lucide-react'

interface PostRow {
  post: {
    id: string
    subreddit: string
    title: string
    url: string
    relevanceTier: string
    status: string
    fetchedAt: string
    matchedKeywords: string[]
  }
  product: { id: string; name: string } | null
}

const STATUS_OPTIONS = ['new', 'draft', 'approved', 'posted', 'skipped', 'bookmarked']

export default function HistoryPage() {
  const [rows, setRows] = useState<PostRow[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/posts/history?${params}`)
    const data = await res.json()
    setRows(data)
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => load(), 300)
    return () => clearTimeout(timer)
  }, [load])

  function exportCsv() {
    const headers = ['title', 'subreddit', 'product', 'tier', 'status', 'fetchedAt', 'url']
    const csvRows = [headers.join(',')]

    for (const { post, product } of rows) {
      csvRows.push(
        [
          `"${(post.title ?? '').replace(/"/g, '""')}"`,
          post.subreddit,
          product?.name ?? '',
          post.relevanceTier,
          post.status,
          post.fetchedAt,
          post.url,
        ].join(',')
      )
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `reddit-posts-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Post History ({rows.length})</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download size={14} className="mr-1" /> Export CSV
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search titles..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm bg-background"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading history...</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No posts found. Run a scan to discover Reddit posts.
        </p>
      ) : (
        <div className="space-y-1">
          {rows.map(({ post, product }) => (
            <div
              key={post.id}
              className="border rounded p-3 flex flex-wrap gap-2 items-center text-sm hover:bg-gray-50"
            >
              <Badge variant="outline" className="shrink-0">r/{post.subreddit}</Badge>
              {product && (
                <Badge variant="secondary" className="shrink-0">
                  {product.name}
                </Badge>
              )}
              <Badge
                className="shrink-0"
                variant={
                  post.relevanceTier === 'high'
                    ? 'default'
                    : post.relevanceTier === 'medium'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {post.relevanceTier}
              </Badge>
              <Badge variant="outline" className="shrink-0">
                {post.status}
              </Badge>

              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 hover:underline flex items-center gap-1 min-w-0"
              >
                <span className="truncate">{post.title}</span>
                <ExternalLink size={12} className="shrink-0 text-muted-foreground" />
              </a>

              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(post.fetchedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
