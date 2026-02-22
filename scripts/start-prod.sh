#!/bin/bash
# Start production server with PM2

cd "$(dirname "$0")/.."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo "❌ PM2 not installed. Install with: pnpm add -g pm2"
  exit 1
fi

# Build if .output doesn't exist
if [ ! -d ".output" ]; then
  echo "📦 No build found, running pnpm build..."
  pnpm build
fi

# Start or restart PM2 process
if pm2 list | grep -q "agent-dashboard"; then
  echo "🔄 Restarting agent-dashboard..."
  pm2 restart agent-dashboard
else
  echo "🚀 Starting agent-dashboard..."
  pm2 start ecosystem.config.cjs
fi

echo "✅ Production server running!"
echo "📊 View logs: pm2 logs agent-dashboard"
echo "📈 Monitor: pm2 monit"
echo "🛑 Stop: pm2 stop agent-dashboard"
