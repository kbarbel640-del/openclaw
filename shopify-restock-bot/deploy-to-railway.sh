#!/bin/bash

# Quick deployment script for Railway
echo "🚀 Deploying Shopify Smart Restock Bot to Railway..."

# Install Railway CLI if needed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Initialize Railway project
echo "🔧 Setting up Railway deployment..."
railway login
railway link

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=\$PORT

# Deploy the application
echo "🚀 Deploying to production..."
railway up

echo "✅ Deployment complete! Your bot should be live at your Railway URL."
echo "🤠 Ready to start making money with customer demos!"