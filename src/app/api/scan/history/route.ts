import { NextResponse } from 'next/server'
import { db } from '@/db'
import { scanLogs } from '@/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const logs = await db
    .select()
    .from(scanLogs)
    .orderBy(desc(scanLogs.startedAt))
    .limit(50)
  return NextResponse.json(logs)
}
