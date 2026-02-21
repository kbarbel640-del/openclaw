#!/bin/bash

# 🚀 DEPLOY SHOPIFY SMART RESTOCK BOT TO ALL PLATFORMS
echo "🤠 MULTI-PLATFORM DEPLOYMENT INITIATED!"
echo "💰 Deploying revenue machine to MAXIMUM platforms..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo ""
echo "🔍 Checking available deployment tools..."

# Check Railway
if command_exists railway; then
    echo -e "${GREEN}✅ Railway CLI found${NC}"
    RAILWAY_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Railway CLI not found - install with: npm install -g @railway/cli${NC}"
    RAILWAY_AVAILABLE=false
fi

# Check Vercel
if command_exists vercel; then
    echo -e "${GREEN}✅ Vercel CLI found${NC}"
    VERCEL_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Vercel CLI not found - install with: npm install -g vercel${NC}"
    VERCEL_AVAILABLE=false
fi

# Check Heroku
if command_exists heroku; then
    echo -e "${GREEN}✅ Heroku CLI found${NC}"
    HEROKU_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Heroku CLI not found - install from: https://cli.heroku.com${NC}"
    HEROKU_AVAILABLE=false
fi

# Check Git (needed for most deployments)
if command_exists git; then
    echo -e "${GREEN}✅ Git found${NC}"
    GIT_AVAILABLE=true
else
    echo -e "${RED}❌ Git required for deployments${NC}"
    GIT_AVAILABLE=false
fi

echo ""
echo "🚀 DEPLOYMENT SEQUENCE STARTING..."

# Initialize git if not already done
if [ ! -d .git ]; then
    echo "📝 Initializing git repository..."
    git init
    git add .
    git commit -m "🚀 Initial deployment - Shopify Smart Restock Bot"
fi

DEPLOYED_URLS=()

# Deploy to Railway
if [ "$RAILWAY_AVAILABLE" = true ]; then
    echo ""
    echo -e "${BLUE}🚂 DEPLOYING TO RAILWAY...${NC}"
    railway whoami > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        railway up --detach
        if [ $? -eq 0 ]; then
            URL=$(railway domain)
            DEPLOYED_URLS+=("Railway: $URL")
            echo -e "${GREEN}✅ Railway deployment successful!${NC}"
        else
            echo -e "${RED}❌ Railway deployment failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Railway login required - run: railway login${NC}"
    fi
fi

# Deploy to Vercel
if [ "$VERCEL_AVAILABLE" = true ]; then
    echo ""
    echo -e "${BLUE}▲ DEPLOYING TO VERCEL...${NC}"
    vercel --prod --yes
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Vercel deployment successful!${NC}"
        DEPLOYED_URLS+=("Vercel: Check output above for URL")
    else
        echo -e "${RED}❌ Vercel deployment failed${NC}"
    fi
fi

# Deploy to Heroku
if [ "$HEROKU_AVAILABLE" = true ]; then
    echo ""
    echo -e "${BLUE}🟪 DEPLOYING TO HEROKU...${NC}"
    
    # Check if Heroku remote exists
    git remote | grep -q heroku
    if [ $? -ne 0 ]; then
        echo "Creating Heroku app..."
        APP_NAME="shopify-restock-$(date +%s)"
        heroku create $APP_NAME
        HEROKU_URL="https://$APP_NAME.herokuapp.com"
    fi
    
    git push heroku main
    if [ $? -eq 0 ]; then
        DEPLOYED_URLS+=("Heroku: $HEROKU_URL")
        echo -e "${GREEN}✅ Heroku deployment successful!${NC}"
    else
        echo -e "${RED}❌ Heroku deployment failed${NC}"
    fi
fi

# Instructions for GitHub + Render deployment
echo ""
echo -e "${BLUE}🎨 SETTING UP FOR RENDER DEPLOYMENT...${NC}"
echo "📝 To deploy on Render.com:"
echo "1. Push this repo to GitHub"
echo "2. Connect your GitHub account on render.com"
echo "3. Create new Web Service from this repo"
echo "4. Render will use render.yaml automatically"

# Instructions for other platforms
echo ""
echo -e "${BLUE}🐳 DOCKER DEPLOYMENT READY...${NC}"
echo "📝 To deploy with Docker anywhere:"
echo "docker build -t shopify-restock-bot ."
echo "docker run -p 3000:3000 shopify-restock-bot"

echo ""
echo "🎉 DEPLOYMENT SUMMARY:"
if [ ${#DEPLOYED_URLS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No automated deployments completed${NC}"
    echo "💡 Install CLI tools and run script again for automated deployment"
else
    echo -e "${GREEN}✅ Successfully deployed to ${#DEPLOYED_URLS[@]} platforms:${NC}"
    for url in "${DEPLOYED_URLS[@]}"; do
        echo "   $url"
    done
fi

echo ""
echo "💰 YOUR REVENUE MACHINE IS READY TO MAKE MONEY!"
echo "🤠 Test each URL and start customer demos immediately!"