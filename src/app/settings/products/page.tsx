'use client'
import { useEffect, useState } from 'react'
import { ProductForm } from '@/components/ProductForm'
import { Card, CardContent } from '@/components/ui/card'

interface Product {
  id: string
  name: string
  url: string
  description: string
  problemsSolved: string
  features: string
  targetAudience: string
  replyTone: string
  promotionIntensity: 'subtle' | 'moderate' | 'direct'
  keywords: string[]
  subreddits: string[]
  isActive: boolean
}

export default function ProductsSettingsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/products')
    const data = await res.json()
    setProducts(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-muted-foreground">Loading products...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-bold">Product Configuration</h1>
      {products.map(p => (
        <Card key={p.id}>
          <CardContent className="pt-6">
            <ProductForm
              product={p}
              onSave={() => load()}
            />
          </CardContent>
        </Card>
      ))}
      {products.length === 0 && (
        <p className="text-muted-foreground">
          No products configured. Run <code>npm run db:seed</code> to add the default products.
        </p>
      )}
    </div>
  )
}
