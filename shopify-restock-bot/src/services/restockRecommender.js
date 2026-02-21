class RestockRecommender {
    constructor() {
        this.defaultSettings = {
            criticalThreshold: 7,     // Days
            lowStockThreshold: 14,    // Days
            highPerformerMinVelocity: 1,  // Units per day
            slowMoverMaxVelocity: 0.1,    // Units per day
            maxReorderQuantity: 1000,
            minReorderQuantity: 1
        };
    }

    async getRecommendations(analysis) {
        const recommendations = {
            summary: {
                totalItems: analysis.totalProducts,
                criticalItems: 0,
                highPriorityItems: 0,
                mediumPriorityItems: 0,
                lowPriorityItems: 0,
                estimatedRevenueLoss: 0,
                totalReorderCost: 0
            },
            actionItems: {
                critical: [],
                high: [],
                medium: [],
                low: []
            },
            insights: [],
            generatedAt: new Date().toISOString()
        };

        // Process critical items
        const criticalItems = analysis.lowStockItems.filter(item => 
            item.isCritical && item.recommendation.priority === 'critical'
        );
        
        recommendations.actionItems.critical = criticalItems.map(item => ({
            ...item,
            reorderUrgency: 'immediate',
            potentialStockout: this.calculateStockoutDate(item),
            revenueAtRisk: item.estimatedRevenueLost
        }));

        // Process high priority items
        const highPriorityItems = analysis.lowStockItems.filter(item => 
            item.isHighPerformer && item.recommendation.priority === 'high'
        );
        
        recommendations.actionItems.high = highPriorityItems.map(item => ({
            ...item,
            reorderUrgency: 'within_3_days',
            potentialStockout: this.calculateStockoutDate(item),
            revenueAtRisk: item.salesVelocity * item.price * 14 // 2 weeks potential loss
        }));

        // Process medium priority items
        const mediumPriorityItems = analysis.lowStockItems.filter(item => 
            item.recommendation.priority === 'medium'
        );
        
        recommendations.actionItems.medium = mediumPriorityItems.map(item => ({
            ...item,
            reorderUrgency: 'within_1_week',
            potentialStockout: this.calculateStockoutDate(item),
            revenueAtRisk: item.salesVelocity * item.price * 7 // 1 week potential loss
        }));

        // Process low priority items (slow movers)
        const lowPriorityItems = analysis.slowMovers;
        
        recommendations.actionItems.low = lowPriorityItems.map(item => ({
            ...item,
            reorderUrgency: 'consider_promotion',
            excessInventoryValue: item.currentStock * item.price,
            recommendation: {
                ...item.recommendation,
                promotionSuggestion: this.generatePromotionSuggestion(item)
            }
        }));

        // Calculate summary metrics
        recommendations.summary.criticalItems = recommendations.actionItems.critical.length;
        recommendations.summary.highPriorityItems = recommendations.actionItems.high.length;
        recommendations.summary.mediumPriorityItems = recommendations.actionItems.medium.length;
        recommendations.summary.lowPriorityItems = recommendations.actionItems.low.length;

        // Calculate financial impact
        recommendations.summary.estimatedRevenueLoss = [
            ...recommendations.actionItems.critical,
            ...recommendations.actionItems.high,
            ...recommendations.actionItems.medium
        ].reduce((sum, item) => sum + (item.revenueAtRisk || 0), 0);

        recommendations.summary.totalReorderCost = [
            ...recommendations.actionItems.critical,
            ...recommendations.actionItems.high,
            ...recommendations.actionItems.medium
        ].reduce((sum, item) => {
            // Estimate cost at 60% of retail price (typical wholesale margin)
            const estimatedCost = item.price * 0.6;
            return sum + (item.optimalReorderQuantity * estimatedCost);
        }, 0);

        // Generate insights
        recommendations.insights = this.generateInsights(analysis, recommendations);

        return recommendations;
    }

    calculateStockoutDate(item) {
        if (item.salesVelocity <= 0) return null;
        
        const daysUntilStockout = item.currentStock / item.salesVelocity;
        const stockoutDate = new Date();
        stockoutDate.setDate(stockoutDate.getDate() + Math.floor(daysUntilStockout));
        
        return stockoutDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }

    generatePromotionSuggestion(item) {
        const excessValue = item.currentStock * item.price;
        
        if (excessValue > 1000) {
            return {
                type: 'flash_sale',
                suggestedDiscount: '25-40%',
                duration: '3-5 days',
                reason: 'High-value excess inventory'
            };
        } else if (excessValue > 500) {
            return {
                type: 'bundle_discount',
                suggestedDiscount: '15-25%',
                duration: '1-2 weeks',
                reason: 'Medium-value slow mover'
            };
        } else {
            return {
                type: 'clearance',
                suggestedDiscount: '30-50%',
                duration: '2-4 weeks',
                reason: 'Low-velocity clearance'
            };
        }
    }

    generateInsights(analysis, recommendations) {
        const insights = [];

        // Inventory health insight
        const healthyItems = analysis.totalProducts - 
            recommendations.summary.criticalItems - 
            recommendations.summary.highPriorityItems - 
            recommendations.summary.mediumPriorityItems;

        const healthPercentage = Math.round((healthyItems / analysis.totalProducts) * 100);
        
        insights.push({
            type: 'inventory_health',
            title: 'Overall Inventory Health',
            message: `${healthPercentage}% of your inventory (${healthyItems} items) has healthy stock levels.`,
            score: healthPercentage,
            impact: healthPercentage >= 80 ? 'positive' : healthPercentage >= 60 ? 'neutral' : 'negative'
        });

        // Cash flow insight
        if (recommendations.summary.totalReorderCost > 0) {
            insights.push({
                type: 'cash_flow',
                title: 'Reorder Investment Required',
                message: `Investing $${Math.round(recommendations.summary.totalReorderCost).toLocaleString()} in reorders could prevent $${Math.round(recommendations.summary.estimatedRevenueLoss).toLocaleString()} in lost revenue.`,
                roiRatio: Math.round((recommendations.summary.estimatedRevenueLoss / recommendations.summary.totalReorderCost) * 100) / 100,
                impact: 'positive'
            });
        }

        // Top performer insight
        if (analysis.highPerformers.length > 0) {
            const topPerformer = analysis.highPerformers[0];
            insights.push({
                type: 'top_performer',
                title: 'Top Performing Item',
                message: `"${topPerformer.productTitle}" is your fastest mover at ${Math.round(topPerformer.salesVelocity * 10) / 10} units/day. ${topPerformer.isLowStock ? 'Consider increasing stock levels.' : 'Stock levels look good.'}`,
                item: topPerformer,
                impact: 'positive'
            });
        }

        // Slow mover insight
        if (analysis.slowMovers.length > 0) {
            const totalSlowMoverValue = analysis.slowMovers.reduce((sum, item) => 
                sum + (item.currentStock * item.price), 0
            );
            
            insights.push({
                type: 'slow_movers',
                title: 'Excess Inventory Opportunity',
                message: `${analysis.slowMovers.length} slow-moving items tie up $${Math.round(totalSlowMoverValue).toLocaleString()} in capital. Consider promotions to free up cash flow.`,
                value: totalSlowMoverValue,
                itemCount: analysis.slowMovers.length,
                impact: 'neutral'
            });
        }

        // Turnover rate insight
        if (analysis.metrics.turnoverRate) {
            let turnoverMessage = '';
            let turnoverImpact = 'neutral';
            
            if (analysis.metrics.turnoverRate >= 12) {
                turnoverMessage = 'Excellent inventory turnover! Your stock moves quickly.';
                turnoverImpact = 'positive';
            } else if (analysis.metrics.turnoverRate >= 6) {
                turnoverMessage = 'Good inventory turnover. Room for improvement in some categories.';
                turnoverImpact = 'neutral';
            } else {
                turnoverMessage = 'Low inventory turnover indicates potential overstocking issues.';
                turnoverImpact = 'negative';
            }
            
            insights.push({
                type: 'turnover_rate',
                title: 'Inventory Turnover Analysis',
                message: `Annual turnover rate: ${analysis.metrics.turnoverRate}x. ${turnoverMessage}`,
                rate: analysis.metrics.turnoverRate,
                impact: turnoverImpact
            });
        }

        // Seasonal/trend insight
        const trendingUp = analysis.lowStockItems.filter(item => item.demandTrend > 20);
        if (trendingUp.length > 0) {
            insights.push({
                type: 'trending_demand',
                title: 'Growing Demand Alert',
                message: `${trendingUp.length} items show increasing demand trends (20%+ growth). Consider increasing order quantities.`,
                itemCount: trendingUp.length,
                impact: 'positive'
            });
        }

        return insights;
    }

    // Helper method to prioritize recommendations for dashboard display
    getPrioritizedActionList(recommendations, limit = 20) {
        const allActions = [
            ...recommendations.actionItems.critical.map(item => ({ ...item, priority: 'critical' })),
            ...recommendations.actionItems.high.map(item => ({ ...item, priority: 'high' })),
            ...recommendations.actionItems.medium.map(item => ({ ...item, priority: 'medium' })),
            ...recommendations.actionItems.low.map(item => ({ ...item, priority: 'low' }))
        ];

        // Sort by urgency score and potential revenue impact
        return allActions
            .sort((a, b) => {
                // First sort by priority level
                const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                
                if (priorityDiff !== 0) return priorityDiff;
                
                // Then by urgency score
                return b.urgencyScore - a.urgencyScore;
            })
            .slice(0, limit);
    }

    // Generate automated reorder list for bulk processing
    generateReorderList(recommendations, includeOptionalItems = false) {
        const reorderList = [];
        
        // Always include critical and high priority items
        const mustReorder = [
            ...recommendations.actionItems.critical,
            ...recommendations.actionItems.high
        ];
        
        mustReorder.forEach(item => {
            reorderList.push({
                sku: item.sku,
                productTitle: item.productTitle,
                variantTitle: item.variantTitle,
                currentStock: item.currentStock,
                recommendedQuantity: item.optimalReorderQuantity,
                urgency: item.reorderUrgency,
                estimatedCost: item.price * 0.6 * item.optimalReorderQuantity, // Assume 60% wholesale cost
                reason: item.recommendation.message
            });
        });

        // Optionally include medium priority items
        if (includeOptionalItems) {
            recommendations.actionItems.medium.forEach(item => {
                reorderList.push({
                    sku: item.sku,
                    productTitle: item.productTitle,
                    variantTitle: item.variantTitle,
                    currentStock: item.currentStock,
                    recommendedQuantity: item.optimalReorderQuantity,
                    urgency: item.reorderUrgency,
                    estimatedCost: item.price * 0.6 * item.optimalReorderQuantity,
                    reason: item.recommendation.message,
                    optional: true
                });
            });
        }

        return reorderList.sort((a, b) => {
            const urgencyOrder = { 
                immediate: 4, 
                within_3_days: 3, 
                within_1_week: 2, 
                consider_promotion: 1 
            };
            return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        });
    }
}

module.exports = RestockRecommender;