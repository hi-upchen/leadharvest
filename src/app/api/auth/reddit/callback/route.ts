import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, saveToken } from '@/lib/reddit-auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = req.cookies.get('reddit_oauth_state')?.value

  if (!code || state !== storedState) {
    return NextResponse.redirect(new URL('/settings/reddit?error=oauth_failed', req.url))
  }

  try {
    const tokenData = await exchangeCodeForToken(code)
    await saveToken(tokenData)
    return NextResponse.redirect(new URL('/settings/reddit?connected=true', req.url))
  } catch (e) {
    console.error('Reddit OAuth callback error:', e)
    return NextResponse.redirect(new URL('/settings/reddit?error=token_exchange_failed', req.url))
  }
}
