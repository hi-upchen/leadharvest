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
