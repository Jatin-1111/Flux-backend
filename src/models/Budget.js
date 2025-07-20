// src/models/Budget.js
import mongoose from 'mongoose'

const budgetSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    category: {
        type: String,
        required: true,
        enum: [
            'food', 'transport', 'entertainment', 'shopping', 'bills',
            'healthcare', 'education', 'travel', 'groceries', 'business',
            'personal', 'recharge', 'investment', 'other', 'total' // 'total' for overall monthly budget
        ]
    },
    amount: {
        type: Number,
        required: true,
        min: [0, 'Budget amount must be positive']
    },
    currency: {
        type: String,
        required: true,
        default: 'INR',
        maxlength: 3
    },
    period: {
        type: String,
        enum: ['weekly', 'monthly', 'yearly'],
        default: 'monthly'
    },
    startDate: {
        type: Date,
        required: true,
        default: function () {
            // Start of current month
            const now = new Date()
            return new Date(now.getFullYear(), now.getMonth(), 1)
        }
    },
    endDate: {
        type: Date,
        required: true,
        default: function () {
            // End of current month
            const now = new Date()
            return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        }
    },
    spent: {
        type: Number,
        default: 0,
        min: 0
    },
    alerts: {
        enabled: {
            type: Boolean,
            default: true
        },
        thresholds: [{
            percentage: {
                type: Number,
                min: 1,
                max: 100
            },
            triggered: {
                type: Boolean,
                default: false
            },
            triggeredAt: Date
        }],
        defaultThresholds: {
            type: [Number],
            default: [50, 75, 90, 100]
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    autoRenew: {
        type: Boolean,
        default: true
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: 30
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

// Compound indexes
budgetSchema.index({ user: 1, category: 1, startDate: 1 })
budgetSchema.index({ user: 1, isActive: 1, endDate: 1 })
budgetSchema.index({ endDate: 1, autoRenew: 1 })

// Virtual for remaining amount
budgetSchema.virtual('remaining').get(function () {
    return Math.max(0, this.amount - this.spent)
})

// Virtual for percentage used
budgetSchema.virtual('percentageUsed').get(function () {
    return Math.min(100, (this.spent / this.amount) * 100)
})

// Virtual for status
budgetSchema.virtual('status').get(function () {
    const percentage = this.percentageUsed
    if (percentage >= 100) return 'exceeded'
    if (percentage >= 90) return 'critical'
    if (percentage >= 75) return 'warning'
    if (percentage >= 50) return 'moderate'
    return 'good'
})

// Virtual for days remaining
budgetSchema.virtual('daysRemaining').get(function () {
    const now = new Date()
    const end = new Date(this.endDate)
    const diffTime = end - now
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
})

// Virtual for daily spending rate
budgetSchema.virtual('dailySpendingRate').get(function () {
    const now = new Date()
    const start = new Date(this.startDate)
    const daysPassed = Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24)))
    return this.spent / daysPassed
})

// Pre-save middleware
budgetSchema.pre('save', function (next) {
    // Initialize alert thresholds if not set
    if (!this.alerts.thresholds || this.alerts.thresholds.length === 0) {
        this.alerts.thresholds = this.alerts.defaultThresholds.map(percentage => ({
            percentage,
            triggered: false
        }))
    }

    next()
})

// Instance method to update spent amount
budgetSchema.methods.updateSpent = async function (newExpenseAmount = 0, oldExpenseAmount = 0) {
    const difference = newExpenseAmount - oldExpenseAmount
    this.spent = Math.max(0, this.spent + difference)

    // Check alert thresholds
    const currentPercentage = this.percentageUsed

    for (const threshold of this.alerts.thresholds) {
        if (!threshold.triggered && currentPercentage >= threshold.percentage) {
            threshold.triggered = true
            threshold.triggeredAt = new Date()

            // TODO: Trigger notification/email here
            console.log(`Budget alert: ${threshold.percentage}% threshold reached for ${this.name}`)
        }
    }

    return this.save()
}

// Instance method to check if over budget
budgetSchema.methods.isOverBudget = function () {
    return this.spent > this.amount
}

// Instance method to get projected spending
budgetSchema.methods.getProjectedSpending = function () {
    const dailyRate = this.dailySpendingRate
    const daysInPeriod = this.getDaysInPeriod()
    return dailyRate * daysInPeriod
}

// Instance method to get days in budget period
budgetSchema.methods.getDaysInPeriod = function () {
    const start = new Date(this.startDate)
    const end = new Date(this.endDate)
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
}

// Static method to find active budgets for user
budgetSchema.statics.findActiveForUser = function (userId) {
    const now = new Date()
    return this.find({
        user: userId,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
    })
}

// Static method to find budgets needing renewal
budgetSchema.statics.findExpiredAutoRenew = function () {
    const now = new Date()
    return this.find({
        isActive: true,
        autoRenew: true,
        endDate: { $lt: now }
    })
}

// Static method to get budget summary for user - FIXED ObjectId usage
budgetSchema.statics.getBudgetSummary = function (userId) {
    return this.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId), // FIXED: Added 'new' keyword
                isActive: true,
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() }
            }
        },
        {
            $group: {
                _id: null,
                totalBudget: { $sum: '$amount' },
                totalSpent: { $sum: '$spent' },
                budgetCount: { $sum: 1 },
                overBudgetCount: {
                    $sum: {
                        $cond: [{ $gt: ['$spent', '$amount'] }, 1, 0]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalBudget: 1,
                totalSpent: 1,
                totalRemaining: { $subtract: ['$totalBudget', '$totalSpent'] },
                budgetCount: 1,
                overBudgetCount: 1,
                overallPercentage: {
                    $multiply: [
                        { $divide: ['$totalSpent', '$totalBudget'] },
                        100
                    ]
                }
            }
        }
    ])
}

export default mongoose.model('Budget', budgetSchema)