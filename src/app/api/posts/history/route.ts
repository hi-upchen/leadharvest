import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { redditPosts, products } from '@/db/schema'
import { eq, and, desc, like } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q')
  const status = searchParams.get('status')
  const productId = searchParams.get('productId')
  const subreddit = searchParams.get('subreddit')

  const conditions = []
  if (status) conditions.push(eq(redditPosts.status, status as 'new' | 'draft' | 'approved' | 'posted' | 'skipped' | 'bookmarked'))
  if (productId) conditions.push(eq(redditPosts.productId, productId))
  if (subreddit) conditions.push(eq(redditPosts.subreddit, subreddit))
  // SQLite uses LIKE (case-insensitive by default for ASCII)
  if (search) conditions.push(like(redditPosts.title, `%${search}%`))

  const rows = await db
    .select({
      post: redditPosts,
      product: { id: products.id, name: products.name },
    })
    .from(redditPosts)
    .leftJoin(products, eq(redditPosts.productId, products.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(redditPosts.fetchedAt))
    .limit(200)

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
