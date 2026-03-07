'use client'
import { useEffect, useState, useCallback } from 'react'
import { PostCard } from '@/components/PostCard'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw } from 'lucide-react'

interface Product {
  id: string
  name: string
}

interface PostRow {
  post: {
    id: string
    subreddit: string
    title: string
    body: string
    author: string
    score: number
    commentCount: number
    url: string
    redditCreatedAt: string
    matchedKeywords: string[]
    relevanceTier: string
    relevanceReason: string
    status: string
    productId: string
  }
  product: { id: string; name: string } | null
}

export default function DashboardPage() {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [allPosts, setAllPosts] = useState<PostRow[]>([])
  const [products, setProductsList] = useState<Product[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [productFilter, setProductFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('high,medium')
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  const loadPosts = useCallback(async () => {
    const params = new URLSearchParams()
    if (productFilter !== 'all') params.set('productId', productFilter)
    const res = await fetch(`/api/posts?${params}`)
    const data = await res.json()
    setAllPosts(data)
  }, [productFilter])

  // Apply tier filter client-side
  useEffect(() => {
    if (tierFilter === 'all') {
      setPosts(allPosts)
    } else {
      const tiers = tierFilter.split(',')
      setPosts(allPosts.filter(r => tiers.includes(r.post.relevanceTier)))
    }
  }, [allPosts, tierFilter])

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(setProductsList)
  }, [])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  async function handleScanNow() {
    setScanning(true)
    setScanError(null)
    try {
      const res = await fetch('/api/scan', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setScanError(data.error ?? 'Scan failed')
      } else {
        setLastScanned(new Date().toLocaleTimeString())
        loadPosts()
      }
    } catch (e) {
      setScanError('Network error during scan')
    } finally {
      setScanning(false)
    }
  }

  async function handleAction(id: string, status: string) {
    await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadPosts()
  }

  const productMap = Object.fromEntries(products.map(p => [p.id, p.name]))

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Post Queue</h1>
        <div className="flex items-center gap-2">
          {lastScanned && (
            <span className="text-sm text-muted-foreground">Last scan: {lastScanned}</span>
          )}
          <Button onClick={handleScanNow} disabled={scanning} size="sm">
            <RefreshCw
              size={14}
              className={`mr-1 ${scanning ? 'animate-spin' : ''}`}
            />
            {scanning ? 'Scanning...' : 'Scan Now'}
          </Button>
        </div>
      </div>

      {scanning && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700 flex items-center gap-2">
          <RefreshCw size={14} className="animate-spin shrink-0" />
          Scanning Reddit for relevant posts… this can take up to 60 seconds.
        </div>
      )}

      {scanError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          Scan error: {scanError}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <Select value={productFilter} onValueChange={(v) => setProductFilter(v ?? "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tierFilter} onValueChange={(v) => setTierFilter(v ?? "high,medium")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Relevance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high,medium">High + Medium</SelectItem>
            <SelectItem value="high">High only</SelectItem>
            <SelectItem value="medium">Medium only</SelectItem>
            <SelectItem value="all">All (incl. Low)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{posts.length} posts</p>

      <div className="space-y-3">
        {posts.map(r => (
          <PostCard
            key={r.post.id}
            post={r.post}
            productName={r.product?.name ?? productMap[r.post.productId] ?? 'Unknown'}
            onAction={handleAction}
          />
        ))}
        {posts.length === 0 && (
          <div className="text-center text-muted-foreground py-12 space-y-2">
            <p>No posts found. Connect your Reddit account and run a scan to get started.</p>
            <div className="flex justify-center gap-2 text-sm">
              <a href="/settings/reddit" className="text-primary underline">
                Connect Reddit
              </a>
              <span>·</span>
              <a href="/settings/products" className="text-primary underline">
                Configure Products
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
