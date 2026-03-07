import { NextResponse } from 'next/server'
import { deleteToken } from '@/lib/reddit-auth'

export async function POST() {
  await deleteToken()
  return NextResponse.json({ ok: true })
}
