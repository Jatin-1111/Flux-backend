// src/models/Income.js
import mongoose from 'mongoose'

const incomeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    source: {
        type: String,
        required: [true, 'Income source is required'],
        trim: true,
        maxlength: [100, 'Source name cannot exceed 100 characters']
    },
    type: {
        type: String,
        required: true,
        enum: ['salary', 'freelance', 'business', 'investment', 'rental', 'bonus', 'gift', 'other']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    currency: {
        type: String,
        required: true,
        default: 'INR',
        maxlength: 3
    },
    frequency: {
        type: String,
        required: true,
        enum: ['one-time', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly'],
        default: 'monthly'
    },
    description: {
        type: String,
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    endDate: {
        type: Date,
        default: null // null means ongoing
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isRecurring: {
        type: Boolean,
        default: true
    },
    taxable: {
        type: Boolean,
        default: true
    },
    employer: {
        name: String,
        address: String,
        taxId: String
    },
    metadata: {
        lastReceived: Date,
        nextExpected: Date,
        totalReceived: {
            type: Number,
            default: 0
        },
        source: {
            type: String,
            enum: ['manual', 'bank-sync', 'api'],
            default: 'manual'
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

// Compound indexes for efficient queries
incomeSchema.index({ user: 1, isActive: 1, startDate: -1 })
incomeSchema.index({ user: 1, type: 1, frequency: 1 })
incomeSchema.index({ user: 1, endDate: 1 }, { sparse: true })
incomeSchema.index({ startDate: 1, endDate: 1, isActive: 1 })

// Virtual for annual amount calculation
incomeSchema.virtual('annualAmount').get(function () {
    if (!this.isActive) return 0

    const multipliers = {
        'one-time': 0, // One-time doesn't count toward annual
        'weekly': 52,
        'bi-weekly': 26,
        'monthly': 12,
        'quarterly': 4,
        'yearly': 1
    }

    return this.amount * (multipliers[this.frequency] || 0)
})

// Virtual for monthly amount calculation
incomeSchema.virtual('monthlyAmount').get(function () {
    return this.annualAmount / 12
})

// Virtual for status
incomeSchema.virtual('status').get(function () {
    if (!this.isActive) return 'inactive'
    if (this.endDate && this.endDate < new Date()) return 'ended'
    if (this.startDate > new Date()) return 'future'
    return 'active'
})

// Pre-save middleware to calculate next expected date
incomeSchema.pre('save', function (next) {
    if (this.isRecurring && this.isActive && !this.endDate) {
        this.metadata.nextExpected = this.calculateNextPaymentDate()
    }
    next()
})

// Instance method to calculate next payment date
incomeSchema.methods.calculateNextPaymentDate = function () {
    const lastReceived = this.metadata.lastReceived || this.startDate
    const date = new Date(lastReceived)

    switch (this.frequency) {
        case 'weekly':
            date.setDate(date.getDate() + 7)
            break
        case 'bi-weekly':
            date.setDate(date.getDate() + 14)
            break
        case 'monthly':
            date.setMonth(date.getMonth() + 1)
            break
        case 'quarterly':
            date.setMonth(date.getMonth() + 3)
            break
        case 'yearly':
            date.setFullYear(date.getFullYear() + 1)
            break
        default:
            return null
    }

    return date
}

// Instance method to mark as received
incomeSchema.methods.markAsReceived = function (amount = null, date = null) {
    this.metadata.lastReceived = date || new Date()
    this.metadata.totalReceived += amount || this.amount
    this.metadata.nextExpected = this.calculateNextPaymentDate()
    return this.save()
}

// Static method to get user's total annual income - FIXED ObjectId usage
incomeSchema.statics.getTotalAnnualIncome = function (userId) {
    return this.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId), // FIXED: Added 'new' keyword
                isActive: true,
                $or: [
                    { endDate: null },
                    { endDate: { $gte: new Date() } }
                ]
            }
        },
        {
            $addFields: {
                annualAmount: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$frequency', 'weekly'] }, then: { $multiply: ['$amount', 52] } },
                            { case: { $eq: ['$frequency', 'bi-weekly'] }, then: { $multiply: ['$amount', 26] } },
                            { case: { $eq: ['$frequency', 'monthly'] }, then: { $multiply: ['$amount', 12] } },
                            { case: { $eq: ['$frequency', 'quarterly'] }, then: { $multiply: ['$amount', 4] } },
                            { case: { $eq: ['$frequency', 'yearly'] }, then: '$amount' }
                        ],
                        default: 0
                    }
                }
            }
        },
        {
            $group: {
                _id: null,
                totalAnnual: { $sum: '$annualAmount' },
                totalMonthly: { $sum: { $divide: ['$annualAmount', 12] } },
                sourceCount: { $sum: 1 },
                breakdown: {
                    $push: {
                        source: '$source',
                        type: '$type',
                        annualAmount: '$annualAmount',
                        frequency: '$frequency'
                    }
                }
            }
        }
    ])
}

// Static method to get income by type - FIXED ObjectId usage
incomeSchema.statics.getIncomeByType = function (userId, year = new Date().getFullYear()) {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59)

    return this.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId), // FIXED: Added 'new' keyword
                isActive: true,
                startDate: { $lte: endDate },
                $or: [
                    { endDate: null },
                    { endDate: { $gte: startDate } }
                ]
            }
        },
        {
            $addFields: {
                annualAmount: {
                    $switch: {
                        branches: [
                            { case: { $eq: ['$frequency', 'weekly'] }, then: { $multiply: ['$amount', 52] } },
                            { case: { $eq: ['$frequency', 'bi-weekly'] }, then: { $multiply: ['$amount', 26] } },
                            { case: { $eq: ['$frequency', 'monthly'] }, then: { $multiply: ['$amount', 12] } },
                            { case: { $eq: ['$frequency', 'quarterly'] }, then: { $multiply: ['$amount', 4] } },
                            { case: { $eq: ['$frequency', 'yearly'] }, then: '$amount' }
                        ],
                        default: 0
                    }
                }
            }
        },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$annualAmount' },
                count: { $sum: 1 },
                sources: { $push: { source: '$source', amount: '$annualAmount' } }
            }
        },
        {
            $sort: { total: -1 }
        }
    ])
}

// Static method to get upcoming income
incomeSchema.statics.getUpcomingIncome = function (userId, days = 30) {
    const now = new Date()
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    return this.find({
        user: userId,
        isActive: true,
        isRecurring: true,
        'metadata.nextExpected': {
            $gte: now,
            $lte: futureDate
        }
    }).sort({ 'metadata.nextExpected': 1 })
}

export default mongoose.model('Income', incomeSchema)