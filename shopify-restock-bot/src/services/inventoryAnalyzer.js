const moment = require('moment');
const ss = require('simple-statistics');

class InventoryAnalyzer {
    constructor() {
        this.analysisCache = new Map();
    }

    async analyzeInventory(inventoryData) {
        const analysis = {
            totalProducts: inventoryData.length,
            lowStockItems: [],
            highPerformers: [],
            slowMovers: [],
            recommendations: [],
            metrics: {
                totalInventoryValue: 0,
                averageDaysOfInventory: 0,
                turnoverRate: 0
            },
            generatedAt: new Date().toISOString()
        };

        // Process each inventory item
        for (const item of inventoryData) {
            const itemAnalysis = this.analyzeItem(item);
            
            // Calculate inventory value
            analysis.metrics.totalInventoryValue += (item.price * item.inventoryQuantity);
            
            // Categorize items
            if (itemAnalysis.isLowStock) {
                analysis.lowStockItems.push(itemAnalysis);
            }
            
            if (itemAnalysis.isHighPerformer) {
                analysis.highPerformers.push(itemAnalysis);
            }
            
            if (itemAnalysis.isSlowMover) {
                analysis.slowMovers.push(itemAnalysis);
            }
        }

        // Calculate overall metrics
        analysis.metrics.averageDaysOfInventory = this.calculateAverageDOI(inventoryData);
        analysis.metrics.turnoverRate = this.calculateTurnoverRate(inventoryData);
        
        // Sort by priority
        analysis.lowStockItems.sort((a, b) => b.urgencyScore - a.urgencyScore);
        analysis.highPerformers.sort((a, b) => b.salesVelocity - a.salesVelocity);
        
        return analysis;
    }

    analyzeItem(item) {
        const salesData = item.salesData || { totalSold: 0, revenue: 0, orders: [] };
        
        // Calculate sales velocity (units per day over last 30 days)
        const salesVelocity = salesData.totalSold / 30;
        
        // Calculate days of inventory remaining
        const daysOfInventory = salesVelocity > 0 ? item.inventoryQuantity / salesVelocity : Infinity;
        
        // Calculate demand trend (comparing first 15 days vs last 15 days)
        const demandTrend = this.calculateDemandTrend(salesData.orders);
        
        // Calculate urgency score (0-100, higher = more urgent)
        const urgencyScore = this.calculateUrgencyScore({
            daysOfInventory,
            salesVelocity,
            currentStock: item.inventoryQuantity,
            demandTrend,
            price: item.price
        });

        // Determine stock status
        const isLowStock = daysOfInventory <= 14 && salesVelocity > 0; // Less than 2 weeks
        const isCritical = daysOfInventory <= 7 && salesVelocity > 0;   // Less than 1 week
        const isHighPerformer = salesVelocity >= 1 && salesData.revenue >= 100; // 1+ units/day, $100+ revenue
        const isSlowMover = salesVelocity <= 0.1 && item.inventoryQuantity > 10; // Less than 3 units/month with high stock

        // Calculate optimal reorder quantity using Economic Order Quantity (simplified)
        const optimalReorderQuantity = this.calculateReorderQuantity({
            salesVelocity,
            leadTimeDays: 14, // Default 2-week lead time
            safetyStockDays: 7 // 1-week safety stock
        });

        return {
            productId: item.productId,
            variantId: item.variantId,
            productTitle: item.productTitle,
            variantTitle: item.variantTitle,
            sku: item.sku,
            currentStock: item.inventoryQuantity,
            price: item.price,
            salesVelocity,
            daysOfInventory,
            demandTrend,
            urgencyScore,
            isLowStock,
            isCritical,
            isHighPerformer,
            isSlowMover,
            optimalReorderQuantity,
            estimatedRevenueLost: isCritical ? (salesVelocity * item.price * 7) : 0, // 1 week of lost sales
            recommendation: this.generateRecommendation({
                isLowStock,
                isCritical,
                isHighPerformer,
                isSlowMover,
                daysOfInventory,
                optimalReorderQuantity
            })
        };
    }

    calculateDemandTrend(orders) {
        if (orders.length < 2) return 0;

        // Split orders into first half and second half of the period
        const midpoint = new Date();
        midpoint.setDate(midpoint.getDate() - 15);

        const firstHalfSales = orders
            .filter(order => new Date(order.date) < midpoint)
            .reduce((sum, order) => sum + order.quantity, 0);

        const secondHalfSales = orders
            .filter(order => new Date(order.date) >= midpoint)
            .reduce((sum, order) => sum + order.quantity, 0);

        // Return percentage change
        if (firstHalfSales === 0) return secondHalfSales > 0 ? 100 : 0;
        return ((secondHalfSales - firstHalfSales) / firstHalfSales) * 100;
    }

    calculateUrgencyScore({ daysOfInventory, salesVelocity, currentStock, demandTrend, price }) {
        let score = 0;

        // Days of inventory component (0-40 points)
        if (daysOfInventory <= 3) score += 40;
        else if (daysOfInventory <= 7) score += 30;
        else if (daysOfInventory <= 14) score += 20;
        else if (daysOfInventory <= 30) score += 10;

        // Sales velocity component (0-25 points)
        if (salesVelocity >= 5) score += 25;      // 5+ units/day
        else if (salesVelocity >= 2) score += 20; // 2-5 units/day
        else if (salesVelocity >= 1) score += 15; // 1-2 units/day
        else if (salesVelocity >= 0.5) score += 10; // 0.5-1 units/day

        // Demand trend component (0-20 points)
        if (demandTrend > 50) score += 20;        // Growing fast
        else if (demandTrend > 20) score += 15;   // Growing
        else if (demandTrend > 0) score += 10;    // Slight growth
        else if (demandTrend < -20) score -= 10;  // Declining

        // Revenue impact component (0-15 points)
        const dailyRevenue = salesVelocity * price;
        if (dailyRevenue >= 100) score += 15;
        else if (dailyRevenue >= 50) score += 10;
        else if (dailyRevenue >= 20) score += 5;

        return Math.min(100, Math.max(0, score));
    }

    calculateReorderQuantity({ salesVelocity, leadTimeDays, safetyStockDays }) {
        if (salesVelocity <= 0) return 0;
        
        // Simple reorder calculation: (lead time + safety stock) * daily sales velocity
        const totalDaysToStock = leadTimeDays + safetyStockDays;
        const reorderQuantity = Math.ceil(salesVelocity * totalDaysToStock);
        
        // Minimum order of 1, maximum of 1000 (configurable)
        return Math.min(1000, Math.max(1, reorderQuantity));
    }

    generateRecommendation({ isLowStock, isCritical, isHighPerformer, isSlowMover, daysOfInventory, optimalReorderQuantity }) {
        if (isCritical) {
            return {
                action: 'reorder_immediately',
                priority: 'critical',
                message: `URGENT: Only ${Math.floor(daysOfInventory)} days of stock remaining. Reorder ${optimalReorderQuantity} units immediately.`,
                suggestedQuantity: optimalReorderQuantity
            };
        }

        if (isLowStock && isHighPerformer) {
            return {
                action: 'reorder_soon',
                priority: 'high',
                message: `High-performing item running low. Reorder ${optimalReorderQuantity} units within the next few days.`,
                suggestedQuantity: optimalReorderQuantity
            };
        }

        if (isLowStock) {
            return {
                action: 'monitor_closely',
                priority: 'medium',
                message: `Low stock levels detected. Consider reordering ${optimalReorderQuantity} units.`,
                suggestedQuantity: optimalReorderQuantity
            };
        }

        if (isSlowMover) {
            return {
                action: 'reduce_inventory',
                priority: 'low',
                message: 'Slow-moving item with high inventory. Consider promotions to reduce stock levels.',
                suggestedQuantity: 0
            };
        }

        return {
            action: 'maintain',
            priority: 'low',
            message: 'Inventory levels are healthy.',
            suggestedQuantity: 0
        };
    }

    calculateAverageDOI(inventoryData) {
        const validItems = inventoryData.filter(item => {
            const velocity = item.salesData?.totalSold / 30 || 0;
            return velocity > 0;
        });

        if (validItems.length === 0) return 0;

        const totalDOI = validItems.reduce((sum, item) => {
            const velocity = item.salesData.totalSold / 30;
            return sum + (item.inventoryQuantity / velocity);
        }, 0);

        return Math.round(totalDOI / validItems.length);
    }

    calculateTurnoverRate(inventoryData) {
        const totalSold = inventoryData.reduce((sum, item) => sum + (item.salesData?.totalSold || 0), 0);
        const totalInventory = inventoryData.reduce((sum, item) => sum + item.inventoryQuantity, 0);
        
        if (totalInventory === 0) return 0;
        
        // Annualized turnover rate (30 days * 12 = 360 days approximation)
        return Math.round((totalSold * 12) / totalInventory * 100) / 100;
    }
}

module.exports = InventoryAnalyzer;