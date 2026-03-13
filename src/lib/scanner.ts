import { query, execute } from '@/lib/db'
import { getToken } from './reddit-auth'
import { scorePostRelevance } from './ai'
import { sendNewPostsNotification } from './notify'

interface RedditPostData {
  id: string
  title: string
  selftext: string
  author: string
  score: number
  num_comments: number
  url: string
  subreddit: string
  created_utc: number
  permalink: string
}

const REDDIT_OAUTH_URL = 'https://oauth.reddit.com'
const REDDIT_PUBLIC_URL = 'https://www.reddit.com'
const USER_AGENT = 'RedditMarketingMonitor/1.0 (personal tool)'
const DELAY_MS_PUBLIC = 7000
const DELAY_MS_OAUTH = 1200
const MAX_BODY_CHARS = 2000

async function getScanSettings(): Promise<{ daysBack: number }> {
  try {
    const rows = await query<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      ['scan_settings']
    )
    if (rows.length) {
      const s = JSON.parse(rows[0].value)
      return { daysBack: Number(s.daysBack) || 7 }
    }
  } catch {}
  return { daysBack: 7 }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const MAX_RETRIES = 3

async function searchReddit(
  keyword: string,
  subreddit: string | null,
  daysBack: number,
  oauthToken: string | null,
  attempt = 1
): Promise<RedditPostData[]> {
  const cutoff = Math.floor(Date.now() / 1000) - daysBack * 86400
  const baseUrl = oauthToken ? REDDIT_OAUTH_URL : REDDIT_PUBLIC_URL
  let url: string
  if (subreddit) {
    url = `${baseUrl}/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=on&sort=new&t=week&limit=25`
  } else {
    url = `${baseUrl}/search.json?q=${encodeURIComponent(keyword)}&sort=new&t=week&limit=25`
  }

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
  }
  if (oauthToken) headers['Authorization'] = `Bearer ${oauthToken}`

  const res = await fetch(url, { headers })

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new Error(`Reddit rate limit exceeded after ${MAX_RETRIES} retries`)
    const retryAfter = Math.min(parseInt(res.headers.get('retry-after') ?? '60', 10), 120)
    await sleep(retryAfter * 1000)
    return searchReddit(keyword, subreddit, daysBack, oauthToken, attempt + 1)
  }

  if (!res.ok) throw new Error(`Reddit search failed: ${res.status} ${res.statusText}`)

  const data = await res.json()
  return (data.data?.children ?? [])
    .map((c: { data: RedditPostData }) => c.data)
    .filter((p: RedditPostData) => p.created_utc > cutoff)
}

async function browseSubredditNew(
  subreddit: string,
  daysBack: number,
  oauthToken: string | null,
  attempt = 1
): Promise<RedditPostData[]> {
  const cutoff = Math.floor(Date.now() / 1000) - daysBack * 86400
  const baseUrl = oauthToken ? REDDIT_OAUTH_URL : REDDIT_PUBLIC_URL
  const url = `${baseUrl}/r/${subreddit}/new.json?limit=50`

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/json, text/plain, */*',
    'Cache-Control': 'no-cache',
  }
  if (oauthToken) headers['Authorization'] = `Bearer ${oauthToken}`

  const res = await fetch(url, { headers })

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new Error(`Reddit rate limit exceeded`)
    const retryAfter = Math.min(parseInt(res.headers.get('retry-after') ?? '60', 10), 120)
    await sleep(retryAfter * 1000)
    return browseSubredditNew(subreddit, daysBack, oauthToken, attempt + 1)
  }

  if (!res.ok) throw new Error(`Reddit /new browse failed: ${res.status}`)

  const data = await res.json()
  return (data.data?.children ?? [])
    .map((c: { data: RedditPostData }) => c.data)
    .filter((p: RedditPostData) => p.created_utc > cutoff)
}

export async function cleanupStaleScanLogs() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  await execute(
    `UPDATE scan_logs SET status = 'failed', error_message = 'Scan interrupted (server restart)', completed_at = ?
     WHERE status = 'running' AND started_at < ?`,
    [new Date().toISOString(), tenMinutesAgo]
  )
}

export async function runScan(triggeredBy: 'manual' | 'scheduled' = 'manual') {
  await cleanupStaleScanLogs()

  const running = await query('SELECT id FROM scan_logs WHERE status = ?', ['running'])
  if (running.length > 0) throw new Error('A scan is already in progress')

  const logId = crypto.randomUUID()
  await execute(
    `INSERT INTO scan_logs (id, triggered_by, status) VALUES (?, ?, 'running')`,
    [logId, triggeredBy]
  )

  const updateLog = (data: Record<string, string | number | null>) => {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ')
    return execute(
      `UPDATE scan_logs SET ${sets}, completed_at = ? WHERE id = ?`,
      [...Object.values(data), new Date().toISOString(), logId]
    )
  }

  const newHighPosts: Array<{
    id: string
    title: string
    subreddit: string
    url: string
    relevanceReason: string
    relevanceTier: string
  }> = []

  try {
    const { daysBack } = await getScanSettings()

    const token = await getToken().catch(() => null)
    const oauthToken = token?.accessToken ?? null
    const DELAY_MS = oauthToken ? DELAY_MS_OAUTH : DELAY_MS_PUBLIC

    const activeProducts = await query<{
      id: string; name: string; description: string; problems_solved: string
      features: string; target_audience: string; reply_tone: string
      promotion_intensity: string; keywords: string; subreddits: string
    }>('SELECT * FROM products WHERE is_active = 1')

    if (!activeProducts.length) {
      await updateLog({ status: 'completed', posts_found: 0, new_posts: 0, claude_calls: 0 })
      return { postsFound: 0, newPosts: 0 }
    }

    let totalFound = 0
    let totalNew = 0
    let totalClaudeCalls = 0

    for (const product of activeProducts) {
      const keywords = JSON.parse(product.keywords) as string[]
      const subreddits = JSON.parse(product.subreddits) as string[]

      const seenInThisScan = new Map<string, { post: RedditPostData; matchedKeywords: string[] }>()

      for (const keyword of keywords) {
        const searchTargets = subreddits.length > 0 ? subreddits : [null]
        for (const sub of searchTargets) {
          try {
            const posts = await searchReddit(keyword, sub, daysBack, oauthToken)
            totalFound += posts.length
            for (const post of posts) {
              if (seenInThisScan.has(post.id)) {
                seenInThisScan.get(post.id)!.matchedKeywords.push(keyword)
              } else {
                seenInThisScan.set(post.id, { post, matchedKeywords: [keyword] })
              }
            }
          } catch (e) {
            console.error(`[scanner] Search error for "${keyword}" in ${sub ?? 'all'}:`, e)
          }
          await sleep(DELAY_MS)
        }
      }

      for (const sub of subreddits) {
        try {
          const newPosts = await browseSubredditNew(sub, daysBack, oauthToken)
          totalFound += newPosts.length
          for (const post of newPosts) {
            if (seenInThisScan.has(post.id)) {
              totalFound--
            } else {
              seenInThisScan.set(post.id, { post, matchedKeywords: ['__browse__'] })
            }
          }
        } catch (e) {
          console.error(`[scanner] /new browse error for r/${sub}:`, e)
        }
        await sleep(DELAY_MS)
      }

      for (const [redditPostId, { post, matchedKeywords }] of seenInThisScan) {
        const existing = await query(
          'SELECT id FROM reddit_posts WHERE reddit_post_id = ? AND product_id = ?',
          [redditPostId, product.id]
        )
        if (existing.length > 0) continue

        const body = (post.selftext ?? '').slice(0, MAX_BODY_CHARS)

        let relevanceScore = 0
        let relevanceTier: 'high' | 'medium' | 'low' = 'low'
        let relevanceReason = 'Scoring unavailable'

        try {
          const scored = await scorePostRelevance(
            {
              name: product.name,
              description: product.description,
              problemsSolved: product.problems_solved,
              features: product.features,
            },
            post.title,
            body
          )
          relevanceScore = scored.score
          relevanceTier = scored.tier
          relevanceReason = scored.reason
          totalClaudeCalls++
        } catch (e) {
          console.error(`[scanner] AI scoring failed for ${redditPostId}:`, e)
        }

        const postId = crypto.randomUUID()
        await execute(
          `INSERT INTO reddit_posts (
            id, reddit_post_id, product_id, subreddit, title, body, author, score,
            comment_count, url, matched_keywords, relevance_score, relevance_tier,
            relevance_reason, status, reddit_created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
          [
            postId, redditPostId, product.id, post.subreddit, post.title, body,
            post.author, post.score, post.num_comments,
            `https://reddit.com${post.permalink}`,
            JSON.stringify(matchedKeywords),
            relevanceScore, relevanceTier, relevanceReason,
            new Date(post.created_utc * 1000).toISOString(),
          ]
        )

        totalNew++

        if (relevanceTier === 'high' || relevanceTier === 'medium') {
          newHighPosts.push({
            id: postId,
            title: post.title,
            subreddit: post.subreddit,
            url: `https://reddit.com${post.permalink}`,
            relevanceReason,
            relevanceTier,
          })
        }
      }
    }

    await updateLog({
      status: 'completed',
      posts_found: totalFound,
      new_posts: totalNew,
      claude_calls: totalClaudeCalls,
    })

    try {
      const notifRows = await query<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        ['notification_settings']
      )
      const threshold = notifRows.length ? JSON.parse(notifRows[0].value).threshold : 'high'
      const postsToNotify = threshold === 'high'
        ? newHighPosts.filter(p => p.relevanceTier === 'high')
        : newHighPosts
      await sendNewPostsNotification(postsToNotify)
    } catch (e) {
      console.error('[scanner] Notification error (non-fatal):', e)
    }

    return { postsFound: totalFound, newPosts: totalNew }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    await execute(
      `UPDATE scan_logs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?`,
      [message, new Date().toISOString(), logId]
    )
    throw e
  }
}
