'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { TagInput } from './TagInput'

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

interface ProductFormProps {
  product: Product
  onSave: () => void
}

export function ProductForm({ product, onSave }: ProductFormProps) {
  const [form, setForm] = useState<Product>(product)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function set<K extends keyof Product>(field: K, value: Product[K]) {
    setForm(f => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setError('')
    if (!form.name.trim()) {
      setError('Product name is required')
      return
    }
    if (!form.description.trim()) {
      setError('Description is required')
      return
    }
    if (!form.url.trim() || !form.url.startsWith('http')) {
      setError('URL must start with http:// or https://')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSaved(true)
        onSave()
      } else {
        setError('Failed to save product')
      }
    } catch {
      setError('Network error saving product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{form.name}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active</span>
          <Switch
            checked={form.isActive}
            onCheckedChange={v => set('isActive', v)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Product Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>URL *</Label>
          <Input
            value={form.url}
            onChange={e => set('url', e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Description * (for AI context)</Label>
        <Textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-1">
        <Label>Problems Solved</Label>
        <Textarea
          value={form.problemsSolved}
          onChange={e => set('problemsSolved', e.target.value)}
          rows={2}
        />
      </div>

      <div className="space-y-1">
        <Label>Key Features</Label>
        <Textarea
          value={form.features}
          onChange={e => set('features', e.target.value)}
          rows={2}
        />
      </div>

      <div className="space-y-1">
        <Label>Target Audience</Label>
        <Input
          value={form.targetAudience}
          onChange={e => set('targetAudience', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Reply Tone</Label>
          <Input
            value={form.replyTone}
            onChange={e => set('replyTone', e.target.value)}
            placeholder="e.g. helpful and friendly"
          />
        </div>
        <div className="space-y-1">
          <Label>Promotion Intensity</Label>
          <Select
            value={form.promotionIntensity}
            onValueChange={v => set('promotionIntensity', (v ?? 'moderate') as 'subtle' | 'moderate' | 'direct')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="subtle">Subtle</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Keywords (press Enter to add)</Label>
        <TagInput
          value={form.keywords}
          onChange={v => set('keywords', v)}
          placeholder="e.g. kobo highlights export"
        />
      </div>

      <div className="space-y-1">
        <Label>Subreddits (without r/, press Enter to add)</Label>
        <TagInput
          value={form.subreddits}
          onChange={v => set('subreddits', v)}
          placeholder="e.g. kobo"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && <p className="text-sm text-green-600">✅ Saved successfully!</p>}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  )
}
