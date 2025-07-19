// src/models/User.js
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        trim: true,
        match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't include password in queries by default
    },
    isActive: {
        type: Boolean,
        default: true
    },
    subscription: {
        type: String,
        enum: ['free', 'premium'],
        default: 'free'
    },
    subscriptionExpiry: {
        type: Date,
        default: null
    },
    preferences: {
        currency: {
            type: String,
            default: 'INR',
            maxlength: 3
        },
        timezone: {
            type: String,
            default: 'UTC'
        },
        theme: {
            type: String,
            enum: ['light', 'dark'],
            default: 'light'
        }
    },
    stats: {
        totalExpenses: {
            type: Number,
            default: 0
        },
        monthlyLimit: {
            type: Number,
            default: 100 // Free tier limit
        },
        currentIncome: {
            annual: {
                type: Number,
                default: 0,
                min: [0, 'Annual income cannot be negative']
            },
            monthly: {
                type: Number,
                default: 0,
                min: [0, 'Monthly income cannot be negative']
            },
            lastUpdated: {
                type: Date,
                default: Date.now
            }
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ phone: 1 }, { sparse: true })
userSchema.index({ isActive: 1 })
userSchema.index({ subscription: 1, subscriptionExpiry: 1 })

// Virtual for full name
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`
})

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next()

    this.password = await bcrypt.hash(this.password, 12)
    next()
})

// Instance method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}

// Instance method to check subscription status
userSchema.methods.isPremium = function () {
    return this.subscription === 'premium' &&
        (!this.subscriptionExpiry || this.subscriptionExpiry > new Date())
}

// Instance method to check monthly limits
userSchema.methods.canAddExpense = function () {
    if (this.isPremium()) return true
    return this.stats.totalExpenses < this.stats.monthlyLimit
}

// Instance method to get income-to-expense ratio
userSchema.methods.getIncomeExpenseRatio = function () {
    if (!this.stats.currentIncome.monthly || this.stats.currentIncome.monthly === 0) {
        return null
    }

    // Calculate average monthly expenses (last 6 months)
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)

    return this.model('Expense').aggregate([
        {
            $match: {
                user: this._id,
                date: { $gte: sixMonthsAgo },
                status: 'completed'
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' }
                },
                monthlyTotal: { $sum: '$amount' }
            }
        },
        {
            $group: {
                _id: null,
                avgMonthlyExpenses: { $avg: '$monthlyTotal' }
            }
        }
    ]).then(result => {
        const avgExpenses = result[0]?.avgMonthlyExpenses || 0
        return {
            monthlyIncome: this.stats.currentIncome.monthly,
            avgMonthlyExpenses,
            ratio: avgExpenses / this.stats.currentIncome.monthly,
            savingsRate: ((this.stats.currentIncome.monthly - avgExpenses) / this.stats.currentIncome.monthly) * 100
        }
    })
}

// Instance method to update income
userSchema.methods.updateIncome = function (annualIncome) {
    this.stats.currentIncome.annual = annualIncome
    this.stats.currentIncome.monthly = annualIncome / 12
    this.stats.currentIncome.lastUpdated = new Date()
    return this.save()
}

// Instance method to check monthly limits
userSchema.methods.canAddExpense = function () {
    if (this.isPremium()) return true
    return this.stats.totalExpenses < this.stats.monthlyLimit
}

// Static method to find active users
userSchema.statics.findActive = function () {
    return this.find({ isActive: true })
}

export default mongoose.model('User', userSchema)