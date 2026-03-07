// Next.js instrumentation — runs once on server startup
// This sets up a node-cron fallback for local development
// In production on Vercel, use Vercel Cron instead (vercel.json)

export async function register() {
  // Only run in Node.js (not Edge), and only in development or when ENABLE_CRON is set
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    (process.env.NODE_ENV === 'development' || process.env.ENABLE_CRON === 'true')
  ) {
    try {
      const cron = await import('node-cron')
      const { runScan } = await import('@/lib/scanner')

      // Run every 3 hours by default, configurable via SCAN_INTERVAL_HOURS
      const intervalHours = parseInt(process.env.SCAN_INTERVAL_HOURS ?? '3', 10)
      const schedule = `0 */${intervalHours} * * *`

      console.log(`[cron] Starting scheduled scanner: ${schedule}`)

      cron.schedule(schedule, async () => {
        console.log('[cron] Running scheduled scan...')
        try {
          const result = await runScan('scheduled')
          console.log(`[cron] Scan completed: ${result.newPosts} new posts`)
        } catch (e) {
          console.error('[cron] Scheduled scan failed:', e)

          // Retry once after 5 minutes
          setTimeout(async () => {
            console.log('[cron] Retrying failed scan...')
            try {
              await runScan('scheduled')
            } catch (retryError) {
              console.error('[cron] Retry also failed:', retryError)
            }
          }, 5 * 60 * 1000)
        }
      })
    } catch (e) {
      console.error('[cron] Failed to start scheduler:', e)
    }
  }
}
