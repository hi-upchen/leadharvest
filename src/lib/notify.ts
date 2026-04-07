import { query } from '@/lib/db'

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
  threshold: 'high' | 'high,medium' | 'all'
  frequency: 'digest' | 'immediate'
  quietStart: string
  quietEnd: string
}

function isQuietHours(quietStart: string, quietEnd: string): boolean {
  const now = new Date()
  const [sh, sm] = quietStart.split(':').map(Number)
  const [eh, em] = quietEnd.split(':').map(Number)
  const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes()
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  if (startMins > endMins) return nowMins >= startMins || nowMins < endMins
  return nowMins >= startMins && nowMins < endMins
}

async function getNotificationSettings(): Promise<NotificationSettings | null> {
  const rows = await query<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    ['notification_settings']
  )
  if (!rows.length) return null
  return JSON.parse(rows[0].value) as NotificationSettings
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendEmailDigest(settings: NotificationSettings, posts: NotifiablePost[]) {
  if (!settings.email) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const html = `
    <h2>LeadHarvest — ${posts.length} new relevant post${posts.length > 1 ? 's' : ''}</h2>
    ${posts.map(p => `
      <div style="border:1px solid #eee;padding:12px;margin:8px 0;border-radius:6px">
        <strong>r/${escapeHtml(p.subreddit)}</strong> &nbsp;
        <span style="background:${p.relevanceTier === 'high' ? '#dcfce7' : '#fef9c3'};padding:2px 6px;border-radius:4px;font-size:12px">${escapeHtml(p.relevanceTier)}</span><br/>
        <a href="${escapeHtml(p.url)}" style="font-weight:600">${escapeHtml(p.title)}</a><br/>
        <em style="color:#666">${escapeHtml(p.relevanceReason)}</em><br/>
        <a href="${appUrl}/reply/${escapeHtml(p.id)}">Draft Reply →</a>
      </div>
    `).join('')}
  `
  const subject = `[LeadHarvest] ${posts.length} new Reddit post${posts.length > 1 ? 's' : ''} to reply to`

  if (!process.env.RESEND_API_KEY) {
    console.log('[notify] RESEND_API_KEY not set. Would send email:')
    console.log(`To: ${settings.email} | Subject: ${subject}`)
    return
  }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: settings.email,
    subject,
    html,
  })
}

function escapeTelegramMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

async function sendTelegramNotification(posts: NotifiablePost[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const highPosts = posts.filter(p => p.relevanceTier === 'high')
  const mediumPosts = posts.filter(p => p.relevanceTier === 'medium')

  let message = `📊 *LeadHarvest 週報*\n找到 ${posts.length} 篇新帖子，${highPosts.length} 篇高相關\n`

  if (highPosts.length > 0) {
    message += `\n🔴 *HIGH*\n`
    for (const p of highPosts) {
      message += `• \\[r/${escapeTelegramMarkdown(p.subreddit)}\\] ${escapeTelegramMarkdown(p.title.slice(0, 80))}\n`
      message += `  → [Reddit](${p.url})\n`
      message += `  → [Dashboard](${appUrl}/reply/${p.id})\n`
    }
  }

  if (mediumPosts.length > 0) {
    message += `\n🟡 *MEDIUM*\n`
    for (const p of mediumPosts) {
      message += `• \\[r/${escapeTelegramMarkdown(p.subreddit)}\\] ${escapeTelegramMarkdown(p.title.slice(0, 80))}\n`
      message += `  → [Reddit](${p.url})\n`
      message += `  → [Dashboard](${appUrl}/reply/${p.id})\n`
    }
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    }),
  })
}

export async function sendTelegramError(errorMessage: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const message = `❌ *LeadHarvest 掃描失敗*\n錯誤：${escapeTelegramMarkdown(errorMessage)}\n時間：${escapeTelegramMarkdown(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }))}`

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'MarkdownV2',
    }),
  })
}

export async function sendNewPostsNotification(posts: NotifiablePost[]) {
  if (!posts.length) return

  const settings = await getNotificationSettings()

  // Email notification (requires settings from DB)
  if (settings) {
    if (!isQuietHours(settings.quietStart || '23:00', settings.quietEnd || '08:00')) {
      if (settings.email) {
        try { await sendEmailDigest(settings, posts) } catch (e) { console.error('[notify] Email failed:', e) }
      }
    }
  }

  // Telegram notification (independent of DB settings)
  try { await sendTelegramNotification(posts) } catch (e) { console.error('[notify] Telegram failed:', e) }
}
