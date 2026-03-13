import { NextRequest, NextResponse } from 'next/server'
import { query, execute } from '@/lib/db'
import { generateReplyDraft } from '@/lib/ai'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const tone = body.tone ?? 'default'

  const posts = await query<{
    id: string; product_id: string; title: string; body: string; subreddit: string
  }>('SELECT id, product_id, title, body, subreddit FROM reddit_posts WHERE id = ?', [id])
  if (!posts.length) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  const post = posts[0]

  const products = await query<{
    id: string; name: string; url: string; description: string; problems_solved: string
    features: string; target_audience: string; reply_tone: string; promotion_intensity: string
  }>('SELECT * FROM products WHERE id = ?', [post.product_id])
  if (!products.length) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  const product = products[0]

  const draft = await generateReplyDraft(
    {
      name: product.name,
      url: product.url,
      description: product.description,
      problemsSolved: product.problems_solved,
      features: product.features,
      targetAudience: product.target_audience,
      replyTone: product.reply_tone,
      promotionIntensity: product.promotion_intensity,
    },
    { title: post.title, body: post.body, subreddit: post.subreddit },
    tone
  )

  const existingDrafts = await query<{ version: number }>(
    'SELECT version FROM reply_drafts WHERE post_id = ? ORDER BY version DESC LIMIT 1', [id]
  )
  const version = (existingDrafts[0]?.version ?? 0) + 1

  const draftId = crypto.randomUUID()
  await execute(
    `INSERT INTO reply_drafts (id, post_id, product_id, body, version) VALUES (?, ?, ?, ?, ?)`,
    [draftId, id, product.id, draft, version]
  )
  await execute(`UPDATE reddit_posts SET status = 'draft' WHERE id = ?`, [id])

  const [saved] = await query('SELECT * FROM reply_drafts WHERE id = ?', [draftId])
  return NextResponse.json(saved)
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const drafts = await query(
    'SELECT * FROM reply_drafts WHERE post_id = ? ORDER BY version DESC', [id]
  )
  return NextResponse.json(drafts)
}
