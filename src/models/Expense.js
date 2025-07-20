// src/models/Expense.js
import mongoose from 'mongoose'

const expenseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be greater than 0']
    },
    currency: {
        type: String,
        required: true,
        default: 'INR',
        maxlength: 3
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },
    category: {
        type: String,
        required: true,
        enum: [
            'food', 'transport', 'entertainment', 'shopping', 'bills',
            'healthcare', 'education', 'travel', 'groceries', 'business',
            'personal', 'recharge', 'investment', 'other'
        ]
    },
    subcategory: {
        type: String,
        trim: true,
        maxlength: 50
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: 30
    }],
    date: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    location: {
        name: String,
        coordinates: {
            type: [Number], // [longitude, latitude]
            index: '2dsphere'
        }
    },
    receipt: {
        url: String,
        filename: String,
        extractedData: {
            merchant: String,
            total: Number,
            items: [String]
        }
    },
    recurring: {
        isRecurring: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'yearly'],
            default: null
        },
        endDate: Date,
        parentExpenseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Expense'
        }
    },
    split: {
        isSplit: {
            type: Boolean,
            default: false
        },
        totalAmount: Number,
        splitWith: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            email: String,
            amount: Number,
            isPaid: {
                type: Boolean,
                default: false
            },
            paidAt: Date
        }],
        splitType: {
            type: String,
            enum: ['equal', 'custom', 'percentage']
        }
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'completed'
    },
    metadata: {
        source: {
            type: String,
            enum: ['manual', 'import', 'recurring', 'api'],
            default: 'manual'
        },
        deviceInfo: String,
        ipAddress: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

// Compound indexes for efficient queries
expenseSchema.index({ user: 1, date: -1 })
expenseSchema.index({ user: 1, category: 1, date: -1 })
expenseSchema.index({ user: 1, 'recurring.isRecurring': 1 })
expenseSchema.index({ user: 1, 'split.isSplit': 1 })
expenseSchema.index({ date: 1, category: 1 })

// Text index for search functionality
expenseSchema.index({
    description: 'text',
    'tags': 'text',
    'receipt.extractedData.merchant': 'text'
})

// Virtual for formatted amount
expenseSchema.virtual('formattedAmount').get(function () {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: this.currency
    }).format(this.amount)
})

// Virtual for month/year for aggregation
expenseSchema.virtual('monthYear').get(function () {
    const date = new Date(this.date)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
})

// Pre-save middleware for validation and processing
expenseSchema.pre('save', function (next) {
    // Auto-categorization based on description keywords
    if (!this.category || this.category === 'other') {
        this.category = this.inferCategory()
    }

    // Normalize tags
    if (this.tags && this.tags.length > 0) {
        this.tags = this.tags
            .map(tag => tag.toLowerCase().trim())
            .filter((tag, index, arr) => arr.indexOf(tag) === index) // Remove duplicates
            .slice(0, 10) // Limit to 10 tags
    }

    next()
})

// Instance method to infer category from description (Indian context)
expenseSchema.methods.inferCategory = function () {
    const desc = this.description.toLowerCase()

    // Indian-specific categorization
    const indianCategories = {
        food: ['zomato', 'swiggy', 'restaurant', 'cafe', 'dhaba', 'food', 'dining', 'lunch', 'dinner', 'dominos', 'pizzahut', 'kfc', 'mcdonalds'],
        transport: ['uber', 'ola', 'auto', 'rickshaw', 'taxi', 'metro', 'bus', 'train', 'petrol', 'diesel', 'fuel', 'parking', 'toll', 'rapido'],
        groceries: ['grocery', 'vegetables', 'fruits', 'bigbasket', 'grofers', 'blinkit', 'dunzo', 'supermarket', 'kirana', 'dmart'],
        entertainment: ['movie', 'cinema', 'pvr', 'inox', 'bookmyshow', 'netflix', 'hotstar', 'prime', 'spotify', 'game', 'concert'],
        bills: ['electricity', 'bijli', 'water', 'internet', 'broadband', 'jio', 'airtel', 'vi', 'bsnl', 'gas', 'cylinder', 'rent', 'emi'],
        healthcare: ['doctor', 'hospital', 'clinic', 'pharmacy', 'medical', 'medicine', 'apollo', 'fortis', 'max', 'dental'],
        shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'reliance', 'big bazaar', 'clothes', 'clothing', 'mall', 'shop'],
        recharge: ['recharge', 'mobile', 'phone', 'paytm', 'phonepe', 'googlepay', 'prepaid', 'postpaid', 'dth'],
        investment: ['sip', 'mutual fund', 'stock', 'share', 'zerodha', 'groww', 'upstox', 'investment', 'fd', 'ppf', 'nps'],
        travel: ['flight', 'irctc', 'hotel', 'booking', 'makemytrip', 'goibibo', 'vacation', 'holiday', 'trip']
    }

    for (const [category, keywords] of Object.entries(indianCategories)) {
        if (keywords.some(keyword => desc.includes(keyword))) {
            return category
        }
    }

    return 'other'
}

// Static method for expense analytics - FIXED ObjectId usage
expenseSchema.statics.getMonthlyStats = function (userId, year, month) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    return this.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId), // FIXED: Added 'new' keyword
                date: { $gte: startDate, $lte: endDate },
                status: 'completed'
            }
        },
        {
            $group: {
                _id: '$category',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
                avgAmount: { $avg: '$amount' }
            }
        },
        {
            $sort: { total: -1 }
        }
    ])
}

// Static method for spending trends - FIXED ObjectId usage
expenseSchema.statics.getSpendingTrend = function (userId, months = 6) {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    return this.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId), // FIXED: Added 'new' keyword
                date: { $gte: startDate, $lte: endDate },
                status: 'completed'
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' }
                },
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1 }
        }
    ])
}

// Static method to detect recurring patterns
expenseSchema.statics.detectRecurring = function (userId, description, amount) {
    const threshold = amount * 0.1 // 10% tolerance

    return this.find({
        user: userId,
        description: { $regex: description, $options: 'i' },
        amount: {
            $gte: amount - threshold,
            $lte: amount + threshold
        },
        date: {
            $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        }
    }).sort({ date: -1 }).limit(5)
}

export default mongoose.model('Expense', expenseSchema)