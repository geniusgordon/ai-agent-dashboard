#!/bin/bash
# Stop production server

cd "$(dirname "$0")/.."

if ! command -v pm2 &> /dev/null; then
  echo "❌ PM2 not installed"
  exit 1
fi

if pm2 list | grep -q "agent-dashboard"; then
  echo "🛑 Stopping agent-dashboard..."
  pm2 stop agent-dashboard
  pm2 delete agent-dashboard
  echo "✅ Stopped!"
else
  echo "⚠️  agent-dashboard is not running"
fi
