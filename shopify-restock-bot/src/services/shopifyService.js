const Shopify = require('shopify-api-node');

// Temporary in-memory storage for demo purposes
let storesDatabase = new Map();

class ShopifyService {
    constructor() {
        this.connectDB();
    }

    async connectDB() {
        console.log('🚀 Using in-memory storage for demo deployment');
        console.log('💾 Ready to accept Shopify store connections!');
        this.demoMode = true;
    }

    async validateStore(shopDomain, accessToken) {
        // Demo mode - accept demo stores or validate real ones
        if (shopDomain.includes('demo-store') || shopDomain.includes('test-store')) {
            console.log('📝 Demo mode: Using sample store data');
            return {
                id: 'demo-12345',
                name: 'Demo Fashion Store',
                domain: shopDomain,
                email: 'owner@demo-store.com',
                currency: 'USD',
                timezone: 'America/New_York',
                plan: 'shopify_plus'
            };
        }

        try {
            const shopify = new Shopify({
                shopName: shopDomain.replace('.myshopify.com', ''),
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
            const storeData = {
                shopDomain,
                accessToken,
                storeInfo,
                settings: {
                    restockThreshold: 10,
                    leadTimeDays: 7,
                    alertEmail: storeInfo.email,
                    enabled: true
                },
                createdAt: new Date(),
                lastAnalyzed: new Date()
            };
            
            storesDatabase.set(shopDomain, storeData);
            console.log(`✅ Saved store data for ${shopDomain}`);
            
            return storeData;
        } catch (error) {
            throw new Error(`Failed to save store credentials: ${error.message}`);
        }
    }

    async getAllConnectedStores() {
        try {
            const stores = Array.from(storesDatabase.values())
                .filter(store => store.settings.enabled);
            return stores;
        } catch (error) {
            console.error('Error fetching connected stores:', error);
            return [];
        }
    }

    async getInventoryData(shopDomain) {
        try {
            const store = storesDatabase.get(shopDomain);
            if (!store) {
                throw new Error('Store not found');
            }

            // Demo mode - return sample inventory data
            if (shopDomain.includes('demo-store') || shopDomain.includes('test-store')) {
                return this.generateDemoInventoryData();
            }

            const shopify = new Shopify({
                shopName: shopDomain.replace('.myshopify.com', ''),
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

    generateDemoInventoryData() {
        // Generate realistic demo inventory data for demonstrations
        const products = [
            {
                productId: 'demo-1001',
                variantId: 'demo-variant-1001',
                productTitle: 'Classic White T-Shirt',
                variantTitle: 'Medium',
                sku: 'CWT-M-001',
                inventoryQuantity: 5, // Critical - low stock
                price: 29.99,
                salesData: {
                    totalSold: 180,
                    revenue: 5398.20,
                    orders: this.generateDemoOrders(180, 29.99)
                }
            },
            {
                productId: 'demo-1002',
                variantId: 'demo-variant-1002', 
                productTitle: 'Blue Jeans',
                variantTitle: 'Size 32',
                sku: 'BJ-32-002',
                inventoryQuantity: 12, // Low stock
                price: 79.99,
                salesData: {
                    totalSold: 95,
                    revenue: 7599.05,
                    orders: this.generateDemoOrders(95, 79.99)
                }
            },
            {
                productId: 'demo-1003',
                variantId: 'demo-variant-1003',
                productTitle: 'Sneakers',
                variantTitle: 'Size 9',
                sku: 'SNK-9-003',
                inventoryQuantity: 45, // Healthy stock
                price: 120.00,
                salesData: {
                    totalSold: 32,
                    revenue: 3840.00,
                    orders: this.generateDemoOrders(32, 120.00)
                }
            },
            {
                productId: 'demo-1004',
                variantId: 'demo-variant-1004',
                productTitle: 'Leather Jacket',
                variantTitle: 'Large',
                sku: 'LJ-L-004',
                inventoryQuantity: 78, // Slow mover - excess stock
                price: 299.99,
                salesData: {
                    totalSold: 8,
                    revenue: 2399.92,
                    orders: this.generateDemoOrders(8, 299.99)
                }
            },
            {
                productId: 'demo-1005',
                variantId: 'demo-variant-1005',
                productTitle: 'Summer Dress',
                variantTitle: 'Small',
                sku: 'SD-S-005',
                inventoryQuantity: 3, // Critical stock
                price: 89.99,
                salesData: {
                    totalSold: 142,
                    revenue: 12778.58,
                    orders: this.generateDemoOrders(142, 89.99)
                }
            }
        ];

        return products;
    }

    generateDemoOrders(totalQuantity, price) {
        const orders = [];
        const now = new Date();
        
        // Distribute orders over last 30 days with realistic patterns
        for (let i = 0; i < totalQuantity; i++) {
            const daysAgo = Math.floor(Math.random() * 30);
            const orderDate = new Date(now);
            orderDate.setDate(orderDate.getDate() - daysAgo);
            
            orders.push({
                date: orderDate.toISOString(),
                quantity: Math.random() < 0.8 ? 1 : Math.random() < 0.9 ? 2 : 3 // Most orders are 1 item
            });
        }
        
        return orders.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    async sendRestockAlert(store, criticalItems) {
        console.log(`🚨 RESTOCK ALERT for ${store.shopDomain}:`);
        console.log(`${criticalItems.length} items need immediate attention:`);
        
        criticalItems.forEach(item => {
            console.log(`- ${item.productTitle} (${item.sku}): ${item.currentStock} units left`);
        });
        
        // TODO: In production, implement:
        // - Email alerts via SendGrid/Mailgun
        // - Slack/Discord webhooks  
        // - SMS notifications via Twilio
        // - Dashboard notifications
        
        return true;
    }
}

module.exports = ShopifyService;