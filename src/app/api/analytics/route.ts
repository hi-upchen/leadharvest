import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { redditPosts } from '@/db/schema'
import { eq, and, gte, sql, count } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const days = parseInt(searchParams.get('days') ?? '30')
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const baseConditions = [gte(redditPosts.fetchedAt, since)]
  if (productId) baseConditions.push(eq(redditPosts.productId, productId))

  const [byTierRaw, bySubredditRaw, totalRaw, replyRateRaw] = await Promise.all([
    // Posts by relevance tier
    db
      .select({
        tier: redditPosts.relevanceTier,
        count: count(),
      })
      .from(redditPosts)
      .where(and(...baseConditions))
      .groupBy(redditPosts.relevanceTier),

    // Posts by subreddit (top 10)
    db
      .select({
        subreddit: redditPosts.subreddit,
        count: count(),
      })
      .from(redditPosts)
      .where(and(...baseConditions))
      .groupBy(redditPosts.subreddit)
      .orderBy(sql`count(*) desc`)
      .limit(10),

    // Total count
    db.select({ count: count() }).from(redditPosts).where(and(...baseConditions)),

    // Reply rate (among high-relevance posts)
    db
      .select({
        status: redditPosts.status,
        count: count(),
      })
      .from(redditPosts)
      .where(
        and(...baseConditions, eq(redditPosts.relevanceTier, 'high'))
      )
      .groupBy(redditPosts.status),
  ])

  const totalHigh = replyRateRaw.reduce((a, r) => a + r.count, 0)
  const posted = replyRateRaw.find(r => r.status === 'posted')?.count ?? 0

  return NextResponse.json({
    total: totalRaw[0]?.count ?? 0,
    byTier: byTierRaw,
    bySubreddit: bySubredditRaw,
    replyRate: totalHigh > 0 ? Math.round((posted / totalHigh) * 100) : 0,
    posted,
    totalHigh,
    days,
  })
}
