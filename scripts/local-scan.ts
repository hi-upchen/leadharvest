import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  // Dynamic imports — must load AFTER dotenv so env vars are available
  const { runScan } = await import('../src/lib/scanner')
  const { sendNewPostsNotification, sendTelegramError } = await import('../src/lib/notify')
  const { query } = await import('../src/lib/db')

  console.log(`[local-scan] Starting scan at ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`)

  try {
    const result = await runScan('scheduled')
    console.log(`[local-scan] Scan complete: ${result.postsFound} found, ${result.newPosts} new`)

    // Query high/medium posts added in the last hour (covers this scan run)
    const recentPosts = await query<{
      id: string; title: string; subreddit: string; url: string;
      relevance_reason: string; relevance_tier: string
    }>(
      `SELECT id, title, subreddit, url, relevance_reason, relevance_tier
       FROM reddit_posts
       WHERE relevance_tier IN ('high', 'medium')
         AND fetched_at > datetime('now', '-1 hour')
       ORDER BY relevance_tier ASC, relevance_score DESC`
    )

    if (recentPosts.length > 0) {
      await sendNewPostsNotification(recentPosts.map(p => ({
        id: p.id,
        title: p.title,
        subreddit: p.subreddit,
        url: p.url,
        relevanceReason: p.relevance_reason,
        relevanceTier: p.relevance_tier,
      })))
      console.log(`[local-scan] Notified: ${recentPosts.length} high/medium posts`)
    } else {
      console.log('[local-scan] No high/medium posts found this scan')
    }

    process.exit(0)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[local-scan] Failed: ${message}`)
    try {
      await sendTelegramError(message)
    } catch (notifyErr) {
      console.error('[local-scan] Failed to send error notification:', notifyErr)
    }
    process.exit(1)
  }
}

main()
