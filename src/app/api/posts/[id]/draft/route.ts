import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { redditPosts, products, replyDrafts } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { generateReplyDraft } from '@/lib/ai'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const tone = body.tone ?? 'default'

  const [postRow] = await db
    .select()
    .from(redditPosts)
    .where(eq(redditPosts.id, id))

  if (!postRow) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, postRow.productId))

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const draft = await generateReplyDraft(
    {
      name: product.name,
      url: product.url,
      description: product.description,
      problemsSolved: product.problemsSolved,
      features: product.features,
      targetAudience: product.targetAudience,
      replyTone: product.replyTone,
      promotionIntensity: product.promotionIntensity,
    },
    {
      title: postRow.title,
      body: postRow.body,
      subreddit: postRow.subreddit,
    },
    tone
  )

  // Get current version count
  const existingDrafts = await db
    .select({ version: replyDrafts.version })
    .from(replyDrafts)
    .where(eq(replyDrafts.postId, id))
    .orderBy(desc(replyDrafts.version))
    .limit(1)

  const version = (existingDrafts[0]?.version ?? 0) + 1

  const [saved] = await db
    .insert(replyDrafts)
    .values({
      postId: id,
      productId: product.id,
      body: draft,
      version,
    })
    .returning()

  // Update post status to 'draft'
  await db
    .update(redditPosts)
    .set({ status: 'draft' })
    .where(eq(redditPosts.id, id))

  return NextResponse.json(saved)
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const drafts = await db
    .select()
    .from(replyDrafts)
    .where(eq(replyDrafts.postId, id))
    .orderBy(desc(replyDrafts.version))

  return NextResponse.json(drafts)
}
