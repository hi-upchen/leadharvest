# Local Cron Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Reddit scanner locally via macOS launchd (every Friday 20:00) with Telegram notifications, bypassing Vercel's blocked datacenter IPs.

**Architecture:** A local TypeScript script calls the existing `runScan()` function, then queries new posts and sends a Telegram summary. macOS launchd handles scheduling via a plist symlinked from the project. The Vercel app remains untouched as the dashboard.

**Tech Stack:** Node.js 24, tsx (via npx), launchd, Telegram Bot API, existing scanner/db/ai modules

---

### Task 1: Add Telegram notification to notify.ts

**Files:**
- Modify: `src/lib/notify.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add Telegram env vars to .env.example**

Append to the end of `.env.example`:

```
# Telegram notifications (optional — used by local scanner)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

- [ ] **Step 2: Add Telegram env vars to .env.local**

Append to `.env.local`:

```
TELEGRAM_BOT_TOKEN=8389449697:AAFv2emRLeZQm3AbxTprac6XGchCEvDAkeQ
TELEGRAM_CHAT_ID=7914928200
```

- [ ] **Step 3: Add sendTelegramNotification function to notify.ts**

Add this function above `sendNewPostsNotification`:

```typescript
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
```

- [ ] **Step 4: Add sendTelegramError export for the local script to use**

Add this exported function below `sendTelegramNotification`:

```typescript
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
```

- [ ] **Step 5: Integrate Telegram into sendNewPostsNotification**

Replace the existing `sendNewPostsNotification` function:

```typescript
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
```

- [ ] **Step 6: Test Telegram notification manually**

Run from project root:

```bash
npx tsx -e "
import 'dotenv/config'
import { sendTelegramError } from './src/lib/notify'
sendTelegramError('Test error from local script').then(() => console.log('Sent!')).catch(console.error)
"
```

Expected: You receive a Telegram message with the error format. If `dotenv` is not installed, install it first (see Task 2 Step 1).

- [ ] **Step 7: Commit**

```bash
git add src/lib/notify.ts .env.example
git commit -m "feat: add Telegram notification support to notify module"
```

---

### Task 2: Create local-scan.ts script

**Files:**
- Create: `scripts/local-scan.ts`
- Modify: `package.json` (add dotenv dependency)

- [ ] **Step 1: Install dotenv**

```bash
npm install dotenv
```

- [ ] **Step 2: Create scripts/local-scan.ts**

```typescript
import 'dotenv/config'
import { runScan } from '../src/lib/scanner'
import { sendNewPostsNotification, sendTelegramError } from '../src/lib/notify'
import { query } from '../src/lib/db'

async function main() {
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
         AND created_at > datetime('now', '-1 hour')
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
```

- [ ] **Step 3: Verify the script runs**

```bash
npx tsx scripts/local-scan.ts
```

Expected: Scanner runs, queries Reddit with your residential IP, scores posts, writes to Turso, sends Telegram notification. Check your Telegram for the message.

- [ ] **Step 4: Commit**

```bash
git add scripts/local-scan.ts package.json package-lock.json
git commit -m "feat: add local-scan script for cron-based Reddit scanning"
```

---

### Task 3: Create launchd plist and setup script

**Files:**
- Create: `com.leadharvest.scan.plist`
- Create: `scripts/setup-launchd.sh`

- [ ] **Step 1: Create com.leadharvest.scan.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.leadharvest.scan</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/opt/node@24/bin/npx</string>
        <string>tsx</string>
        <string>/Users/upchen/Dropbox/01_Projects/42-RedditMarketingMonitor/scripts/local-scan.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/upchen/Dropbox/01_Projects/42-RedditMarketingMonitor</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>5</integer>
        <key>Hour</key>
        <integer>20</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/upchen/Library/Logs/leadharvest-scan.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/upchen/Library/Logs/leadharvest-scan.err</string>
</dict>
</plist>
```

- [ ] **Step 2: Create scripts/setup-launchd.sh**

```bash
#!/bin/bash
set -e

PLIST_NAME="com.leadharvest.scan.plist"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SOURCE="$PROJECT_DIR/$PLIST_NAME"
PLIST_TARGET="$HOME/Library/LaunchAgents/$PLIST_NAME"

# Unload if already loaded
if launchctl list | grep -q "com.leadharvest.scan"; then
    echo "Unloading existing job..."
    launchctl unload "$PLIST_TARGET" 2>/dev/null || true
fi

# Remove old symlink if exists
rm -f "$PLIST_TARGET"

# Create symlink
ln -s "$PLIST_SOURCE" "$PLIST_TARGET"
echo "Symlink created: $PLIST_TARGET -> $PLIST_SOURCE"

# Load the job
launchctl load "$PLIST_TARGET"
echo "Job loaded successfully."

# Verify
if launchctl list | grep -q "com.leadharvest.scan"; then
    echo ""
    echo "✅ LeadHarvest scanner installed!"
    echo "   Schedule: Every Friday at 20:00"
    echo "   Logs: ~/Library/Logs/leadharvest-scan.log"
    echo "   Errors: ~/Library/Logs/leadharvest-scan.err"
    echo ""
    echo "To run now:  launchctl start com.leadharvest.scan"
    echo "To stop:     launchctl unload $PLIST_TARGET"
else
    echo "❌ Failed to load job. Check the plist for errors."
    exit 1
fi
```

- [ ] **Step 3: Make setup script executable**

```bash
chmod +x scripts/setup-launchd.sh
```

- [ ] **Step 4: Run setup to install**

```bash
./scripts/setup-launchd.sh
```

Expected: Symlink created, job loaded, confirmation message shown.

- [ ] **Step 5: Test by triggering manually**

```bash
launchctl start com.leadharvest.scan
```

Wait ~1 minute, then check:

```bash
cat ~/Library/Logs/leadharvest-scan.log
```

Expected: Scan output showing Reddit search results and AI scoring. Check Telegram for notification.

- [ ] **Step 6: Commit**

```bash
git add com.leadharvest.scan.plist scripts/setup-launchd.sh
git commit -m "feat: add launchd plist and setup script for weekly local scanning"
```

---

### Task 4: Create UNINSTALL.md

**Files:**
- Create: `UNINSTALL.md`

- [ ] **Step 1: Create UNINSTALL.md**

```markdown
# Uninstall Local Scanner

This project includes a local macOS scanner that runs via `launchd`.
Follow these steps to completely remove it.

## 1. Stop and unload the scheduled job

```bash
launchctl unload ~/Library/LaunchAgents/com.leadharvest.scan.plist
```

## 2. Remove the symlink

```bash
rm ~/Library/LaunchAgents/com.leadharvest.scan.plist
```

## 3. Remove log files (optional)

```bash
rm -f ~/Library/Logs/leadharvest-scan.log
rm -f ~/Library/Logs/leadharvest-scan.err
```

## 4. Remove Telegram env vars (optional)

Edit `.env.local` and remove:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## 5. Delete Telegram bot (optional)

Open Telegram, find `@BotFather`, send `/deletebot`, and select `@up_assistant_ai_bot`.

## Verify removal

```bash
launchctl list | grep leadharvest
```

If no output, the job has been fully removed.
```

- [ ] **Step 2: Commit**

```bash
git add UNINSTALL.md
git commit -m "docs: add uninstall instructions for local scanner"
```

---

### Task 5: Clean up test file

**Files:**
- Delete: `test-reddit-proxy.mjs`

- [ ] **Step 1: Remove the proxy test file**

```bash
rm test-reddit-proxy.mjs
```

- [ ] **Step 2: Commit**

```bash
git add -u test-reddit-proxy.mjs
git commit -m "chore: remove proxy test script (no longer needed)"
```
