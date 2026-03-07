import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row] = await db.select().from(products).where(eq(products.id, id))
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...row,
    keywords: JSON.parse(row.keywords as string),
    subreddits: JSON.parse(row.subreddits as string),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Whitelist updatable fields — never allow id or createdAt to be changed
  const ALLOWED = ['name', 'url', 'description', 'problemsSolved', 'features',
    'targetAudience', 'replyTone', 'promotionIntensity', 'keywords', 'subreddits', 'isActive']
  const INTENSITY_VALUES = ['subtle', 'moderate', 'direct']

  const updateData: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (body[key] !== undefined) updateData[key] = body[key]
  }

  // Validate required string fields if present
  if (updateData.name !== undefined && (typeof updateData.name !== 'string' || !updateData.name.trim())) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
  }
  if (updateData.url !== undefined && (typeof updateData.url !== 'string' || !updateData.url.startsWith('http'))) {
    return NextResponse.json({ error: 'url must start with http:// or https://' }, { status: 400 })
  }
  if (updateData.description !== undefined && (typeof updateData.description !== 'string' || !updateData.description.trim())) {
    return NextResponse.json({ error: 'description cannot be empty' }, { status: 400 })
  }
  if (updateData.promotionIntensity !== undefined && !INTENSITY_VALUES.includes(updateData.promotionIntensity as string)) {
    return NextResponse.json({ error: 'promotionIntensity must be subtle, moderate, or direct' }, { status: 400 })
  }

  // Serialize JSON fields
  if (Array.isArray(updateData.keywords)) updateData.keywords = JSON.stringify(updateData.keywords)
  if (Array.isArray(updateData.subreddits)) updateData.subreddits = JSON.stringify(updateData.subreddits)

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const [row] = await db.update(products)
    .set(updateData)
    .where(eq(products.id, id))
    .returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...row,
    keywords: JSON.parse(row.keywords as string),
    subreddits: JSON.parse(row.subreddits as string),
  })
}
