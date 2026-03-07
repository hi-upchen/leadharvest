import { NextResponse } from 'next/server'
import { getToken } from '@/lib/reddit-auth'

export async function GET() {
  const token = await getToken()
  return NextResponse.json({
    connected: !!token,
    username: token?.username ?? null,
  })
}
