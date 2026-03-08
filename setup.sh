#!/bin/bash
set -e

echo "🔧 Reddit Marketing Monitor — Setup"
echo "===================================="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org (LTS version)"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Create .env.local if not exists
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  # Pre-fill generated values
  ENCRYPTION_KEY=$(openssl rand -hex 16)
  CRON_SECRET=$(openssl rand -hex 8)
  sed -i.bak "s/ENCRYPTION_KEY=/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env.local
  sed -i.bak "s/CRON_SECRET=/CRON_SECRET=$CRON_SECRET/" .env.local
  rm -f .env.local.bak
  echo ""
  echo "📝 Created .env.local — please fill in:"
  echo "   GEMINI_API_KEY=AIzaSy..."
  echo "   APP_PASSWORD=pick_any_password"
  echo ""
  echo "Then run this script again."
  exit 0
fi

echo "📦 Installing dependencies..."
npm install --include=dev

echo "🗄️  Setting up database..."
npx drizzle-kit migrate
npx tsx src/db/seed.ts

echo ""
echo "✅ Ready! Starting app at http://localhost:3000"
echo "   Login with your APP_PASSWORD"
echo ""
npm run dev
