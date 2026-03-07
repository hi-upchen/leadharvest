import { db } from '@/db'
import { appSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'

interface NotifiablePost {
  id: string
  title: string
  subreddit: string
  url: string
  relevanceReason: string
  relevanceTier: string
}

interface NotificationSettings {
  email: string
  threshold: 'high' | 'high,medium'
  quietStart: string
  quietEnd: string
  telegramEnabled: boolean
}

function isQuietHours(quietStart: string, quietEnd: string): boolean {
  const now = new Date()
  const [sh, sm] = quietStart.split(':').map(Number)
  const [eh, em] = quietEnd.split(':').map(Number)
  const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes()
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em

  // Handle overnight window (e.g. 23:00 - 08:00)
  if (startMins > endMins) {
    return nowMins >= startMins || nowMins < endMins
  }
  return nowMins >= startMins && nowMins < endMins
}

async function getNotificationSettings(): Promise<NotificationSettings | null> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'notification_settings'))

  if (!rows.length) return null
  return JSON.parse(rows[0].value) as NotificationSettings
}

export async function sendNewPostsNotification(posts: NotifiablePost[]) {
  if (!posts.length) return

  const settings = await getNotificationSettings()
  if (!settings || !settings.email) {
    console.log('[notify] No notification settings configured, skipping email')
    return
  }

  if (isQuietHours(settings.quietStart || '23:00', settings.quietEnd || '08:00')) {
    console.log('[notify] Quiet hours active, suppressing notification')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const html = `
    <h2>Reddit Marketing Monitor — ${posts.length} new relevant post${posts.length > 1 ? 's' : ''}</h2>
    ${posts
      .map(
        p => `
      <div style="border:1px solid #eee;padding:12px;margin:8px 0;border-radius:6px">
        <strong>r/${p.subreddit}</strong><br/>
        <a href="${p.url}">${p.title}</a><br/>
        <em>${p.relevanceReason}</em><br/>
        <a href="${appUrl}/reply/${p.id}">Draft Reply →</a>
      </div>
    `
      )
      .join('')}
  `

  const subject = `[RMM] ${posts.length} new Reddit post${posts.length > 1 ? 's' : ''} to reply to`

  if (!process.env.RESEND_API_KEY) {
    // Fallback: log to console
    console.log('[notify] RESEND_API_KEY not set. Email would have been sent:')
    console.log(`To: ${settings.email}`)
    console.log(`Subject: ${subject}`)
    console.log(`Posts: ${posts.map(p => p.title).join(', ')}`)
    return
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: settings.email,
      subject,
      html,
    })
    console.log(`[notify] Email sent to ${settings.email}`)
  } catch (e) {
    console.error('[notify] Failed to send email:', e)
  }
}
