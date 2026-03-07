import { db } from '@/db'
import { appSettings } from '@/db/schema'
import { encrypt, decrypt } from './encrypt'
import { eq } from 'drizzle-orm'

const REDDIT_TOKEN_KEY = 'reddit_token'
const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/authorize'
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'

export interface RedditTokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number // unix ms
  username: string
}

export function getRedditAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.REDDIT_CLIENT_ID!,
    response_type: 'code',
    state,
    redirect_uri: process.env.REDDIT_REDIRECT_URI!,
    duration: 'permanent',
    scope: 'identity submit history read',
  })
  return `${REDDIT_AUTH_URL}?${params}`
}

export async function exchangeCodeForToken(code: string): Promise<RedditTokenData> {
  const credentials = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'RedditMarketingMonitor/1.0',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDDIT_REDIRECT_URI!,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Reddit OAuth error: ${data.error}`)

  // Fetch username
  const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
      'User-Agent': 'RedditMarketingMonitor/1.0',
    },
  })
  const me = await meRes.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    username: me.name,
  }
}

export async function refreshAccessToken(tokenData: RedditTokenData): Promise<RedditTokenData> {
  const credentials = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'RedditMarketingMonitor/1.0',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refreshToken,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Token refresh failed: ${data.error}`)

  return {
    ...tokenData,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function saveToken(tokenData: RedditTokenData): Promise<void> {
  const encrypted = encrypt(JSON.stringify(tokenData))
  await db.insert(appSettings)
    .values({ key: REDDIT_TOKEN_KEY, value: encrypted })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: encrypted, updatedAt: new Date().toISOString() },
    })
}

export async function getToken(): Promise<RedditTokenData | null> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, REDDIT_TOKEN_KEY))
  if (!rows.length) return null

  const tokenData: RedditTokenData = JSON.parse(decrypt(rows[0].value))

  // Auto-refresh if expired (within 60 seconds of expiry)
  if (Date.now() > tokenData.expiresAt - 60_000) {
    try {
      const refreshed = await refreshAccessToken(tokenData)
      await saveToken(refreshed)
      return refreshed
    } catch (e) {
      console.error('Token refresh failed:', e)
      return tokenData // Return stale token, let caller handle error
    }
  }
  return tokenData
}

export async function deleteToken(): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, REDDIT_TOKEN_KEY))
}
