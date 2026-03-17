import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  const denied = await requireAuth(); if (denied) return denied
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM scan_logs ORDER BY started_at DESC LIMIT 50'
  )
  const logs = rows.map(r => ({
    id: r.id,
    triggeredBy: r.triggered_by,
    status: r.status,
    postsFound: r.posts_found ?? 0,
    newPosts: r.new_posts ?? 0,
    claudeCalls: r.claude_calls ?? 0,
    errorMessage: r.error_message ?? null,
    startedAt: r.started_at,
    completedAt: r.completed_at ?? null,
  }))
  return NextResponse.json(logs)
}
