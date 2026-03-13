import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  const logs = await query(
    'SELECT * FROM scan_logs ORDER BY started_at DESC LIMIT 50'
  )
  return NextResponse.json(logs)
}
