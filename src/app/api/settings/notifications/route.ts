import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'

const NOTIF_KEY = 'notification_settings'

const DEFAULT_SETTINGS = {
  email: process.env.NOTIFICATION_EMAIL ?? '',
  threshold: 'high',
  quietStart: '23:00',
  quietEnd: '08:00',
  telegramEnabled: false,
}

export async function GET() {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, NOTIF_KEY))
  const settings = rows.length ? JSON.parse(rows[0].value) : DEFAULT_SETTINGS
  return NextResponse.json(settings)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  await db
    .insert(appSettings)
    .values({ key: NOTIF_KEY, value: JSON.stringify(body) })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: JSON.stringify(body), updatedAt: new Date().toISOString() },
    })
  return NextResponse.json({ ok: true })
}
