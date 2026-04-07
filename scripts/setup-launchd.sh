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
