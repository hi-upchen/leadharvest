import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { redditPosts, replyDrafts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getToken } from '@/lib/reddit-auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { draftId, body } = await req.json()

  const [post] = await db
    .select()
    .from(redditPosts)
    .where(eq(redditPosts.id, id))

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Reddit not connected' }, { status: 401 })

  // Submit comment via Reddit API
  const res = await fetch('https://oauth.reddit.com/api/comment', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'RedditMarketingMonitor/1.0',
    },
    body: new URLSearchParams({
      api_type: 'json',
      text: body,
      thing_id: `t3_${post.redditPostId}`, // t3_ prefix for posts
    }),
  })

  const data = await res.json()

  if (data.json?.errors?.length > 0) {
    return NextResponse.json(
      { error: data.json.errors[0][1] ?? 'Reddit API error' },
      { status: 400 }
    )
  }

  const comment = data.json?.data?.things?.[0]?.data
  const commentId = comment?.id
  const commentUrl = comment?.permalink
    ? `https://reddit.com${comment.permalink}`
    : null

  await db
    .update(replyDrafts)
    .set({
      body,
      isApproved: true,
      isPosted: true,
      approvedAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      redditCommentId: commentId ?? null,
      redditCommentUrl: commentUrl ?? null,
    })
    .where(eq(replyDrafts.id, draftId))

  await db
    .update(redditPosts)
    .set({ status: 'posted' })
    .where(eq(redditPosts.id, id))

  return NextResponse.json({ ok: true, commentUrl })
}
