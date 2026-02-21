#!/usr/bin/env node

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const ShopifyService = require('./services/shopifyService');
const InventoryAnalyzer = require('./services/inventoryAnalyzer');
const RestockRecommender = require('./services/restockRecommender');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Services
const shopifyService = new ShopifyService();
const inventoryAnalyzer = new InventoryAnalyzer();
const restockRecommender = new RestockRecommender();

// Routes
app.get('/', (req, res) => {
    res.json({
        name: 'Shopify Smart Restock Bot',
        status: 'online',
        version: '1.0.0',
        features: [
            'Inventory monitoring',
            'Demand forecasting',
            'Smart reorder alerts',
            'Performance analytics'
        ]
    });
});

// Store onboarding endpoint
app.post('/api/stores/connect', async (req, res) => {
    try {
        const { shopDomain, accessToken } = req.body;
        
        if (!shopDomain || !accessToken) {
            return res.status(400).json({ error: 'Shop domain and access token required' });
        }

        const storeInfo = await shopifyService.validateStore(shopDomain, accessToken);
        
        // Store credentials securely (implement encryption)
        await shopifyService.saveStoreCredentials(shopDomain, accessToken, storeInfo);
        
        res.json({
            success: true,
            message: 'Store connected successfully',
            store: storeInfo
        });
    } catch (error) {
        console.error('Store connection error:', error);
        res.status(500).json({ error: 'Failed to connect store' });
    }
});

// Get inventory analysis
app.get('/api/stores/:shopDomain/analysis', async (req, res) => {
    try {
        const { shopDomain } = req.params;
        
        // Get current inventory data
        const inventoryData = await shopifyService.getInventoryData(shopDomain);
        
        // Analyze inventory patterns
        const analysis = await inventoryAnalyzer.analyzeInventory(inventoryData);
        
        // Generate restock recommendations
        const recommendations = await restockRecommender.getRecommendations(analysis);
        
        res.json({
            shopDomain,
            analysis,
            recommendations,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to generate analysis' });
    }
});

// Automated inventory monitoring (runs every 6 hours)
cron.schedule('0 */6 * * *', async () => {
    console.log('Running scheduled inventory check...');
    try {
        const stores = await shopifyService.getAllConnectedStores();
        
        for (const store of stores) {
            await processStoreInventory(store);
        }
    } catch (error) {
        console.error('Scheduled check error:', error);
    }
});

async function processStoreInventory(store) {
    try {
        const inventoryData = await shopifyService.getInventoryData(store.shopDomain);
        const analysis = await inventoryAnalyzer.analyzeInventory(inventoryData);
        const recommendations = await restockRecommender.getRecommendations(analysis);
        
        // Send alerts for critical items
        const criticalItems = recommendations.filter(r => r.priority === 'critical');
        if (criticalItems.length > 0) {
            await shopifyService.sendRestockAlert(store, criticalItems);
        }
        
        console.log(`Processed ${store.shopDomain}: ${criticalItems.length} critical items`);
    } catch (error) {
        console.error(`Error processing ${store.shopDomain}:`, error);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`🤠 Shopify Smart Restock Bot running on port ${port}`);
    console.log('💰 Ready to generate revenue through intelligent inventory management!');
});

module.exports = app;