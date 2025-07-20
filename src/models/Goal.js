import mongoose from 'mongoose'

const goalSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: [true, 'Goal name is required'],
        trim: true,
        maxlength: [100, 'Goal name cannot exceed 100 characters']
    },
    targetAmount: {
        type: Number,
        required: [true, 'Target amount is required'],
        min: [0.01, 'Target amount must be greater than 0']
    },
    currentAmount: {
        type: Number,
        default: 0,
        min: [0, 'Current amount cannot be negative']
    },
    currency: {
        type: String,
        required: true,
        default: 'INR',
        maxlength: 3
    },
    category: {
        type: String,
        required: true,
        enum: [
            'emergency', 'vacation', 'gadget', 'car', 'home',
            'education', 'gift', 'entertainment', 'health', 'other'
        ],
        default: 'other'
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    deadline: {
        type: Date,
        required: [true, 'Deadline is required'],
        validate: {
            validator: function (date) {
                return date > new Date()
            },
            message: 'Deadline must be in the future'
        }
    },
    isCompleted: {
        type: Boolean,
        default: false
    },
    completedAt: {
        type: Date,
        default: null
    },
    autoSave: {
        enabled: {
            type: Boolean,
            default: false
        },
        amount: {
            type: Number,
            default: 0,
            min: [0, 'Auto-save amount cannot be negative']
        },
        frequency: {
            type: String,
            enum: ['weekly', 'monthly', 'quarterly'],
            default: 'monthly'
        },
        nextContribution: {
            type: Date,
            default: null
        }
    },
    contributions: [{
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        date: {
            type: Date,
            default: Date.now
        },
        description: {
            type: String,
            default: 'Manual contribution'
        },
        source: {
            type: String,
            enum: ['manual', 'auto-save', 'bonus'],
            default: 'manual'
        }
    }],
    tags: [{
        type: String,
        trim: true,
        maxlength: 30
    }],
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

// Compound indexes for efficient queries
goalSchema.index({ user: 1, isActive: 1, isCompleted: 1 })
goalSchema.index({ user: 1, category: 1 })
goalSchema.index({ user: 1, deadline: 1 })
goalSchema.index({ deadline: 1, isCompleted: 1 })
goalSchema.index({ 'autoSave.enabled': 1, 'autoSave.nextContribution': 1 })

// Virtual for progress percentage
goalSchema.virtual('progressPercentage').get(function () {
    return Math.min((this.currentAmount / this.targetAmount) * 100, 100)
})

// Virtual for remaining amount
goalSchema.virtual('remainingAmount').get(function () {
    return Math.max(0, this.targetAmount - this.currentAmount)
})

// Virtual for days remaining
goalSchema.virtual('daysRemaining').get(function () {
    const now = new Date()
    const deadline = new Date(this.deadline)
    const diffTime = deadline - now
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
})

// Virtual for status
goalSchema.virtual('status').get(function () {
    if (this.isCompleted) return 'completed'

    const daysLeft = this.daysRemaining
    if (daysLeft === 0) return 'overdue'
    if (daysLeft <= 30) return 'urgent'
    if (this.progressPercentage >= 75) return 'on-track'
    return 'active'
})

// Virtual for monthly savings needed
goalSchema.virtual('monthlySavingsNeeded').get(function () {
    const remaining = this.remainingAmount
    const daysLeft = this.daysRemaining
    const monthsLeft = Math.max(1, daysLeft / 30.44) // Average days per month
    return remaining / monthsLeft
})

// Pre-save middleware
goalSchema.pre('save', function (next) {
    // Auto-complete goal if target reached
    if (this.currentAmount >= this.targetAmount && !this.isCompleted) {
        this.isCompleted = true
        this.completedAt = new Date()
    }

    // Set next contribution date for auto-save
    if (this.autoSave.enabled && !this.autoSave.nextContribution) {
        this.autoSave.nextContribution = this.calculateNextContribution()
    }

    next()
})

// Instance method to add contribution
goalSchema.methods.addContribution = function (amount, description = 'Manual contribution', source = 'manual') {
    if (amount <= 0) {
        throw new Error('Contribution amount must be positive')
    }

    const previousAmount = this.currentAmount
    this.currentAmount = Math.min(this.currentAmount + amount, this.targetAmount)

    // Add to contributions history
    this.contributions.push({
        amount: this.currentAmount - previousAmount, // Actual amount added (may be less if target exceeded)
        description,
        source,
        date: new Date()
    })

    return this.save()
}

// Instance method to calculate next auto-save contribution date
goalSchema.methods.calculateNextContribution = function () {
    if (!this.autoSave.enabled) return null

    const now = new Date()
    const next = new Date(now)

    switch (this.autoSave.frequency) {
        case 'weekly':
            next.setDate(now.getDate() + 7)
            break
        case 'monthly':
            next.setMonth(now.getMonth() + 1)
            break
        case 'quarterly':
            next.setMonth(now.getMonth() + 3)
            break
        default:
            next.setMonth(now.getMonth() + 1)
    }

    return next
}

// Static method to get user's goal summary
goalSchema.statics.getUserSummary = function (userId) {
    return this.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId),
                isActive: true
            }
        },
        {
            $group: {
                _id: null,
                totalGoals: { $sum: 1 },
                activeGoals: {
                    $sum: { $cond: [{ $eq: ['$isCompleted', false] }, 1, 0] }
                },
                completedGoals: {
                    $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] }
                },
                totalTarget: { $sum: '$targetAmount' },
                totalSaved: { $sum: '$currentAmount' },
                avgProgress: { $avg: { $multiply: [{ $divide: ['$currentAmount', '$targetAmount'] }, 100] } }
            }
        },
        {
            $project: {
                _id: 0,
                totalGoals: 1,
                activeGoals: 1,
                completedGoals: 1,
                totalTarget: 1,
                totalSaved: 1,
                totalRemaining: { $subtract: ['$totalTarget', '$totalSaved'] },
                avgProgress: { $round: ['$avgProgress', 1] },
                overallProgress: {
                    $round: [{ $multiply: [{ $divide: ['$totalSaved', '$totalTarget'] }, 100] }, 1]
                }
            }
        }
    ])
}

// Static method to find goals needing auto-save contribution
goalSchema.statics.findAutoSaveDue = function () {
    const now = new Date()
    return this.find({
        'autoSave.enabled': true,
        'autoSave.nextContribution': { $lte: now },
        isCompleted: false,
        isActive: true
    })
}

// Static method to get goals by category
goalSchema.statics.getGoalsByCategory = function (userId) {
    return this.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId),
                isActive: true
            }
        },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                totalTarget: { $sum: '$targetAmount' },
                totalSaved: { $sum: '$currentAmount' },
                completed: { $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] } }
            }
        },
        {
            $project: {
                category: '$_id',
                count: 1,
                totalTarget: 1,
                totalSaved: 1,
                completed: 1,
                progress: {
                    $round: [{ $multiply: [{ $divide: ['$totalSaved', '$totalTarget'] }, 100] }, 1]
                }
            }
        },
        { $sort: { totalTarget: -1 } }
    ])
}

export default mongoose.model('Goal', goalSchema)