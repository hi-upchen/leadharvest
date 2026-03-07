import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { redditPosts, replyDrafts } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { draftId, body } = await req.json()

  await db
    .update(replyDrafts)
    .set({
      body,
      isApproved: true,
      approvedAt: new Date().toISOString(),
    })
    .where(eq(replyDrafts.id, draftId))

  await db
    .update(redditPosts)
    .set({ status: 'approved' })
    .where(eq(redditPosts.id, id))

  return NextResponse.json({ ok: true })
}
