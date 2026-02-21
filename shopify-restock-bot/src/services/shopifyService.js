const Shopify = require('shopify-api-node');
const mongoose = require('mongoose');

// Store credentials schema (basic - implement proper encryption in production)
const StoreSchema = new mongoose.Schema({
    shopDomain: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    storeInfo: { type: Object, required: true },
    settings: {
        restockThreshold: { type: Number, default: 10 },
        leadTimeDays: { type: Number, default: 7 },
        alertEmail: { type: String },
        enabled: { type: Boolean, default: true }
    },
    createdAt: { type: Date, default: Date.now },
    lastAnalyzed: { type: Date }
});

const Store = mongoose.model('Store', StoreSchema);

class ShopifyService {
    constructor() {
        this.connectDB();
    }

    async connectDB() {
        if (!process.env.MONGODB_URI) {
            console.warn('⚠️  No MongoDB URI - using in-memory storage (not recommended for production)');
            return;
        }
        
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✅ Connected to MongoDB');
        } catch (error) {
            console.error('❌ MongoDB connection error:', error);
        }
    }

    async validateStore(shopDomain, accessToken) {
        try {
            const shopify = new Shopify({
                shopName: shopDomain,
                accessToken: accessToken
            });

            // Test the connection by fetching shop info
            const shop = await shopify.shop.get();
            
            return {
                id: shop.id,
                name: shop.name,
                domain: shop.domain,
                email: shop.email,
                currency: shop.currency,
                timezone: shop.iana_timezone,
                plan: shop.plan_name
            };
        } catch (error) {
            throw new Error(`Invalid Shopify credentials: ${error.message}`);
        }
    }

    async saveStoreCredentials(shopDomain, accessToken, storeInfo) {
        try {
            const store = await Store.findOneAndUpdate(
                { shopDomain },
                { 
                    shopDomain,
                    accessToken, // TODO: Encrypt this in production
                    storeInfo,
                    lastAnalyzed: new Date()
                },
                { upsert: true, new: true }
            );
            
            return store;
        } catch (error) {
            throw new Error(`Failed to save store credentials: ${error.message}`);
        }
    }

    async getAllConnectedStores() {
        try {
            return await Store.find({ 'settings.enabled': true });
        } catch (error) {
            console.error('Error fetching connected stores:', error);
            return [];
        }
    }

    async getInventoryData(shopDomain) {
        try {
            const store = await Store.findOne({ shopDomain });
            if (!store) {
                throw new Error('Store not found');
            }

            const shopify = new Shopify({
                shopName: shopDomain,
                accessToken: store.accessToken
            });

            // Get all products with inventory info
            const products = await shopify.product.list({ limit: 250 });
            
            const inventoryData = [];
            
            for (const product of products) {
                for (const variant of product.variants) {
                    inventoryData.push({
                        productId: product.id,
                        variantId: variant.id,
                        productTitle: product.title,
                        variantTitle: variant.title,
                        sku: variant.sku,
                        inventoryQuantity: variant.inventory_quantity,
                        inventoryPolicy: variant.inventory_policy,
                        price: parseFloat(variant.price),
                        weight: variant.weight,
                        createdAt: product.created_at,
                        updatedAt: product.updated_at
                    });
                }
            }

            // Get recent order data for demand analysis
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const orders = await shopify.order.list({
                status: 'any',
                created_at_min: thirtyDaysAgo.toISOString(),
                limit: 250
            });

            // Process order line items for sales velocity
            const salesData = {};
            
            for (const order of orders) {
                for (const lineItem of order.line_items) {
                    const variantId = lineItem.variant_id;
                    if (!salesData[variantId]) {
                        salesData[variantId] = {
                            totalSold: 0,
                            revenue: 0,
                            orders: []
                        };
                    }
                    
                    salesData[variantId].totalSold += lineItem.quantity;
                    salesData[variantId].revenue += parseFloat(lineItem.price) * lineItem.quantity;
                    salesData[variantId].orders.push({
                        date: order.created_at,
                        quantity: lineItem.quantity
                    });
                }
            }

            // Merge inventory and sales data
            const enrichedInventoryData = inventoryData.map(item => ({
                ...item,
                salesData: salesData[item.variantId] || { totalSold: 0, revenue: 0, orders: [] }
            }));

            return enrichedInventoryData;

        } catch (error) {
            throw new Error(`Failed to fetch inventory data: ${error.message}`);
        }
    }

    async sendRestockAlert(store, criticalItems) {
        // TODO: Implement email/webhook alerts
        console.log(`🚨 RESTOCK ALERT for ${store.shopDomain}:`);
        console.log(`${criticalItems.length} items need immediate attention:`);
        
        criticalItems.forEach(item => {
            console.log(`- ${item.productTitle} (${item.sku}): ${item.currentStock} units left`);
        });
        
        // In production, send actual notifications:
        // - Email alerts
        // - Slack/Discord webhooks  
        // - SMS notifications
        // - Dashboard notifications
    }
}

module.exports = ShopifyService;