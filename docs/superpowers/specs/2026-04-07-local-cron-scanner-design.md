# Local Cron Scanner Design

## Problem

Reddit blocks datacenter IPs (including Vercel/AWS). The existing Vercel Cron scanner fails with 403 errors. The user's local Mac has a residential IP that works fine.

## Solution

Run the Reddit scanner locally via macOS launchd, reusing the existing `runScan()` logic. Add Telegram notifications. Keep the Vercel app as-is for the dashboard.

## Architecture

```
macOS launchd (every Friday 20:00 Asia/Taipei)
  → tsx scripts/local-scan.ts
  → loads .env (dotenv)
  → calls runScan('scheduled') from src/lib/scanner.ts
  → runScan: Reddit search → AI scoring → write to Turso DB
  → after scan: query new high/medium posts from DB
  → send Telegram notification with summary
  → user reviews on Vercel Dashboard, drafts replies
```

## Schedule

- **Frequency**: Every Friday at 20:00 (Asia/Taipei local time)
- **Lookback window**: 7 days (existing `daysBack` setting)
- **Sleep handling**: launchd auto-runs missed jobs on wake

## New Files

### `scripts/local-scan.ts`

Entry point for local scanning:

1. Load `.env` with `dotenv`
2. Call `runScan('scheduled')` (existing scanner logic)
3. Query DB for newly added high/medium posts from this scan
4. Format and send Telegram notification
5. On failure, send Telegram error notification

### `com.leadharvest.scan.plist`

launchd plist in project root:

- `StartCalendarInterval`: Weekday=5, Hour=20, Minute=0
- `ProgramArguments`: path to tsx + scripts/local-scan.ts
- `StandardOutPath`: ~/Library/Logs/leadharvest-scan.log
- `StandardErrorPath`: ~/Library/Logs/leadharvest-scan.err
- Installed via symlink: `ln -s <project>/com.leadharvest.scan.plist ~/Library/LaunchAgents/`

### `scripts/setup-launchd.sh`

One-command installation:

1. Auto-detect project path and tsx path
2. Create symlink in ~/Library/LaunchAgents/
3. Run `launchctl load` to register
4. Print confirmation

### `UNINSTALL.md`

In project root, contains step-by-step uninstall instructions:

1. `launchctl unload ~/Library/LaunchAgents/com.leadharvest.scan.plist`
2. `rm ~/Library/LaunchAgents/com.leadharvest.scan.plist` (removes symlink)
3. `rm ~/Library/Logs/leadharvest-scan.log leadharvest-scan.err` (optional)
4. Remove `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from `.env` (optional)
5. Delete bot via @BotFather `/deletebot` (optional)

## Modified Files

### `src/lib/notify.ts`

Add `sendTelegramNotification()` function:

- Uses `fetch()` to call Telegram Bot API (no extra dependencies)
- Reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from env
- Message format: Markdown with scan summary, posts grouped by tier (HIGH first, MEDIUM second), each with Reddit link + Dashboard link
- Gracefully skips if env vars not set (won't break existing Email flow)

Integrate into existing `sendNewPostsNotification()`:

```
sendNewPostsNotification()
  ├── sendEmailNotification()    ← existing Resend logic (unchanged)
  └── sendTelegramNotification() ← new
```

### `.env`

Add two new variables:

```
TELEGRAM_BOT_TOKEN=8389449697:AAFv2emRLeZQm3AbxTprac6XGchCEvDAkeQ
TELEGRAM_CHAT_ID=7914928200
```

## Unchanged

- Vercel deployment and codebase — no changes to production
- Existing Email notifications via Resend — preserved
- Dashboard UI — no changes
- Reddit OAuth flow — unchanged
- AI scoring logic (Gemini/Claude) — unchanged

## Dependencies

- `tsx` — already available or install globally (`npm install -g tsx`)
- `dotenv` — add as dev dependency for loading .env in local script
- No other new dependencies

## Telegram Message Format

```
📊 LeadHarvest 週報
找到 {totalNew} 篇新帖子，{highCount} 篇高相關

🔴 HIGH
• [r/SaaS] How to automate outreach?
  → https://reddit.com/r/...
  → Dashboard: https://app.vercel.app/posts/xxx

🟡 MEDIUM
• [r/marketing] Best tools for lead gen
  → https://reddit.com/r/...

✅ 掃描完成，共 {aiCalls} 次 AI 評分
```

On failure:

```
❌ LeadHarvest 掃描失敗
錯誤：{error message}
時間：{timestamp}
```
