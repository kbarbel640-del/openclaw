#!/bin/bash

# 🤠 CHECK STATUS OF ALL DEPLOYED SHOPIFY RESTOCK BOTS
echo "🔍 CHECKING ALL DEPLOYMENT STATUSES..."
echo "💰 Verifying revenue machine availability across platforms..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to check URL status
check_url() {
    local url=$1
    local platform=$2
    
    if [ -z "$url" ]; then
        echo -e "${YELLOW}⚠️  $platform: URL not configured${NC}"
        return 1
    fi
    
    echo -n "🔍 Checking $platform ($url)... "
    
    # Try to get health check
    if curl -s --max-time 10 "$url/health" | grep -q "healthy"; then
        echo -e "${GREEN}✅ ONLINE & HEALTHY${NC}"
        return 0
    elif curl -s --max-time 10 "$url" | grep -q "Shopify Smart Restock"; then
        echo -e "${GREEN}✅ ONLINE (health endpoint not found)${NC}"
        return 0
    else
        echo -e "${RED}❌ OFFLINE OR ERROR${NC}"
        return 1
    fi
}

# Function to test demo functionality
test_demo() {
    local url=$1
    local platform=$2
    
    echo -n "🧪 Testing $platform demo API... "
    
    # Test store connection endpoint
    response=$(curl -s --max-time 15 -X POST "$url/api/stores/connect" \
        -H "Content-Type: application/json" \
        -d '{"shopDomain": "demo-store.myshopify.com", "accessToken": "demo-token"}' 2>/dev/null)
    
    if echo "$response" | grep -q "Demo Fashion Store"; then
        echo -e "${GREEN}✅ DEMO WORKING${NC}"
        return 0
    else
        echo -e "${RED}❌ DEMO FAILED${NC}"
        return 1
    fi
}

echo ""
echo "🚀 DEPLOYMENT STATUS CHECK:"
echo "=================================="

# Track statistics
online_count=0
total_count=0

# Define your deployment URLs (update these after deployment)
declare -A DEPLOYMENTS
DEPLOYMENTS[Railway]=""           # Add your Railway URL
DEPLOYMENTS[Vercel]=""            # Add your Vercel URL  
DEPLOYMENTS[Heroku]=""            # Add your Heroku URL
DEPLOYMENTS[Render]=""            # Add your Render URL
DEPLOYMENTS[DigitalOcean]=""      # Add your DO URL
DEPLOYMENTS[GoogleCloud]=""       # Add your GCP URL

# If no URLs configured, check for common patterns
if [ -z "${DEPLOYMENTS[Railway]}" ]; then
    # Try to get Railway URL from CLI
    if command -v railway >/dev/null 2>&1; then
        RAILWAY_URL=$(railway domain 2>/dev/null || echo "")
        if [ -n "$RAILWAY_URL" ]; then
            DEPLOYMENTS[Railway]="$RAILWAY_URL"
        fi
    fi
fi

echo ""
echo "📊 CHECKING ALL PLATFORMS:"

# Check each deployment
for platform in "${!DEPLOYMENTS[@]}"; do
    url="${DEPLOYMENTS[$platform]}"
    total_count=$((total_count + 1))
    
    if check_url "$url" "$platform"; then
        online_count=$((online_count + 1))
        
        # Test demo functionality on working deployments
        test_demo "$url" "$platform"
    fi
    echo ""
done

echo "=================================="
echo "📈 DEPLOYMENT SUMMARY:"
echo -e "✅ Online: ${GREEN}$online_count${NC} / $total_count platforms"

if [ $online_count -gt 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS: Revenue machine is ONLINE!${NC}"
    echo "💰 Ready for customer demos and money-making!"
    
    # Show working URLs
    echo ""
    echo "🔗 WORKING DEMO URLS:"
    for platform in "${!DEPLOYMENTS[@]}"; do
        url="${DEPLOYMENTS[$platform]}"
        if [ -n "$url" ]; then
            if curl -s --max-time 5 "$url/health" | grep -q "healthy" 2>/dev/null; then
                echo "   $platform: $url"
            fi
        fi
    done
    
else
    echo -e "${RED}⚠️  NO PLATFORMS ONLINE - Check deployments${NC}"
fi

echo ""
echo "🎯 NEXT STEPS:"
if [ $online_count -gt 0 ]; then
    echo "1. 📝 Update this script with your actual deployment URLs"
    echo "2. 🎬 Start customer demos with working URLs"
    echo "3. 📧 Begin outreach campaigns"  
    echo "4. 💰 Start generating revenue!"
else
    echo "1. 🚀 Complete deployments using deploy-all-platforms.sh"
    echo "2. 📝 Update URLs in this script"
    echo "3. 🔄 Run this check again"
fi

echo ""
echo "🤠 Your multi-platform revenue empire status: CHECKED!"