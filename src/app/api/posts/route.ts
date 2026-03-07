import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { redditPosts, products } from '@/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const tier = searchParams.get('tier')
  const status = searchParams.get('status') ?? 'new,draft,approved,bookmarked'
  const statuses = status.split(',').filter(Boolean)

  const conditions = []
  if (productId) conditions.push(eq(redditPosts.productId, productId))
  if (tier) conditions.push(eq(redditPosts.relevanceTier, tier as 'high' | 'medium' | 'low'))
  if (statuses.length > 0) {
    conditions.push(
      inArray(
        redditPosts.status,
        statuses as ('new' | 'draft' | 'approved' | 'posted' | 'skipped' | 'bookmarked')[]
      )
    )
  }

  const rows = await db
    .select({
      post: redditPosts,
      product: { id: products.id, name: products.name },
    })
    .from(redditPosts)
    .leftJoin(products, eq(redditPosts.productId, products.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(redditPosts.relevanceScore), desc(redditPosts.fetchedAt))
    .limit(100)

  // Parse JSON fields
  return NextResponse.json(
    rows.map(r => ({
      post: {
        ...r.post,
        matchedKeywords: JSON.parse(r.post.matchedKeywords as string),
      },
      product: r.product,
    }))
  )
}
