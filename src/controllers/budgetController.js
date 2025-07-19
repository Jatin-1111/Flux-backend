// src/controllers/budgetController.js
import Budget from '../models/Budget.js'
import Expense from '../models/Expense.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'

// @desc    Create new budget
// @route   POST /api/budgets
// @access  Private
export const createBudget = asyncHandler(async (req, res) => {
    const {
        name,
        category,
        amount,
        currency,
        period,
        startDate,
        endDate,
        alerts
    } = req.body

    // Validation
    if (!name || !category || !amount) {
        throw new ApiError(400, 'Name, category, and amount are required')
    }

    // Check for existing active budget in the same category and period
    const existingBudget = await Budget.findOne({
        user: req.user._id,
        category,
        isActive: true,
        startDate: { $lte: new Date(endDate || Date.now()) },
        endDate: { $gte: new Date(startDate || Date.now()) }
    })

    if (existingBudget) {
        throw new ApiError(409, `Active budget already exists for ${category} in this period`)
    }

    const budget = await Budget.create({
        user: req.user._id,
        name: name.trim(),
        category,
        amount,
        currency: currency || req.user.preferences?.currency || 'USD',
        period: period || 'monthly',
        startDate: startDate || new Date(),
        endDate: endDate || getEndDateForPeriod(period || 'monthly'),
        alerts: alerts || {}
    })

    // Calculate current spending for this budget
    await recalculateBudgetSpending(budget)

    res.status(201).json(
        new ApiResponse(201, { budget }, 'Budget created successfully')
    )
})

// @desc    Get all budgets for user
// @route   GET /api/budgets
// @access  Private
export const getBudgets = asyncHandler(async (req, res) => {
    const { active = 'true', category, period } = req.query

    const query = { user: req.user._id }

    if (active === 'true') {
        query.isActive = true
        query.startDate = { $lte: new Date() }
        query.endDate = { $gte: new Date() }
    }

    if (category && category !== 'all') {
        query.category = category
    }

    if (period) {
        query.period = period
    }

    const budgets = await Budget.find(query)
        .sort({ createdAt: -1 })
        .populate('user', 'firstName lastName')

    res.status(200).json(
        new ApiResponse(200, { budgets }, 'Budgets retrieved successfully')
    )
})

// @desc    Get single budget
// @route   GET /api/budgets/:id
// @access  Private
export const getBudget = asyncHandler(async (req, res) => {
    const budget = await Budget.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!budget) {
        throw new ApiError(404, 'Budget not found')
    }

    // Get recent expenses for this budget
    const recentExpenses = await Expense.find({
        user: req.user._id,
        category: budget.category,
        date: {
            $gte: budget.startDate,
            $lte: budget.endDate
        },
        status: 'completed'
    })
        .sort({ date: -1 })
        .limit(10)
        .select('amount description date category')

    res.status(200).json(
        new ApiResponse(200, {
            budget,
            recentExpenses
        }, 'Budget retrieved successfully')
    )
})

// @desc    Update budget
// @route   PUT /api/budgets/:id
// @access  Private
export const updateBudget = asyncHandler(async (req, res) => {
    const budget = await Budget.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!budget) {
        throw new ApiError(404, 'Budget not found')
    }

    // Update fields
    const allowedUpdates = ['name', 'amount', 'alerts', 'autoRenew', 'tags']
    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
            budget[field] = req.body[field]
        }
    })

    await budget.save()

    res.status(200).json(
        new ApiResponse(200, { budget }, 'Budget updated successfully')
    )
})

// @desc    Delete budget
// @route   DELETE /api/budgets/:id
// @access  Private
export const deleteBudget = asyncHandler(async (req, res) => {
    const budget = await Budget.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!budget) {
        throw new ApiError(404, 'Budget not found')
    }

    await budget.deleteOne()

    res.status(200).json(
        new ApiResponse(200, {}, 'Budget deleted successfully')
    )
})

// @desc    Get budget summary
// @route   GET /api/budgets/summary
// @access  Private
export const getBudgetSummary = asyncHandler(async (req, res) => {
    const summary = await Budget.getBudgetSummary(req.user._id)

    if (!summary || summary.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, {
                totalBudget: 0,
                totalSpent: 0,
                totalRemaining: 0,
                budgetCount: 0,
                overBudgetCount: 0,
                overallPercentage: 0
            }, 'No active budgets found')
        )
    }

    res.status(200).json(
        new ApiResponse(200, summary[0], 'Budget summary retrieved successfully')
    )
})

// @desc    Get budget alerts
// @route   GET /api/budgets/alerts
// @access  Private
export const getBudgetAlerts = asyncHandler(async (req, res) => {
    const budgets = await Budget.find({
        user: req.user._id,
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
        'alerts.enabled': true
    })

    const alerts = []

    budgets.forEach(budget => {
        const percentage = budget.percentageUsed

        // Check for threshold breaches
        budget.alerts.thresholds.forEach(threshold => {
            if (percentage >= threshold.percentage && threshold.triggered) {
                alerts.push({
                    type: 'threshold',
                    budgetId: budget._id,
                    budgetName: budget.name,
                    category: budget.category,
                    threshold: threshold.percentage,
                    currentPercentage: percentage,
                    amount: budget.amount,
                    spent: budget.spent,
                    remaining: budget.remaining,
                    triggeredAt: threshold.triggeredAt,
                    severity: percentage >= 100 ? 'critical' : percentage >= 90 ? 'high' : 'medium'
                })
            }
        })

        // Check for projected overspending
        const projected = budget.getProjectedSpending()
        if (projected > budget.amount && budget.daysRemaining > 0) {
            alerts.push({
                type: 'projection',
                budgetId: budget._id,
                budgetName: budget.name,
                category: budget.category,
                projectedSpending: projected,
                budgetAmount: budget.amount,
                daysRemaining: budget.daysRemaining,
                severity: 'warning'
            })
        }
    })

    res.status(200).json(
        new ApiResponse(200, { alerts }, 'Budget alerts retrieved successfully')
    )
})

// @desc    Recalculate budget spending
// @route   POST /api/budgets/:id/recalculate
// @access  Private
export const recalculateBudget = asyncHandler(async (req, res) => {
    const budget = await Budget.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!budget) {
        throw new ApiError(404, 'Budget not found')
    }

    await recalculateBudgetSpending(budget)

    res.status(200).json(
        new ApiResponse(200, { budget }, 'Budget recalculated successfully')
    )
})

// @desc    Duplicate budget for next period
// @route   POST /api/budgets/:id/duplicate
// @access  Private
export const duplicateBudget = asyncHandler(async (req, res) => {
    const sourceBudget = await Budget.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!sourceBudget) {
        throw new ApiError(404, 'Budget not found')
    }

    const { startDate, endDate } = req.body

    if (!startDate || !endDate) {
        throw new ApiError(400, 'Start date and end date are required')
    }

    // Check for overlapping budget
    const existingBudget = await Budget.findOne({
        user: req.user._id,
        category: sourceBudget.category,
        isActive: true,
        startDate: { $lte: new Date(endDate) },
        endDate: { $gte: new Date(startDate) }
    })

    if (existingBudget) {
        throw new ApiError(409, 'Budget already exists for this period')
    }

    const newBudget = await Budget.create({
        user: req.user._id,
        name: sourceBudget.name,
        category: sourceBudget.category,
        amount: sourceBudget.amount,
        currency: sourceBudget.currency,
        period: sourceBudget.period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        alerts: sourceBudget.alerts,
        autoRenew: sourceBudget.autoRenew,
        tags: sourceBudget.tags
    })

    res.status(201).json(
        new ApiResponse(201, { budget: newBudget }, 'Budget duplicated successfully')
    )
})

// Helper function to get end date based on period
const getEndDateForPeriod = (period) => {
    const now = new Date()

    switch (period) {
        case 'weekly':
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        case 'yearly':
            return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        case 'monthly':
        default:
            return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    }
}

// Helper function to recalculate budget spending
const recalculateBudgetSpending = async (budget) => {
    const totalSpent = await Expense.aggregate([
        {
            $match: {
                user: budget.user,
                category: budget.category === 'total' ? { $exists: true } : budget.category,
                date: {
                    $gte: budget.startDate,
                    $lte: budget.endDate
                },
                status: 'completed'
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' }
            }
        }
    ])

    budget.spent = totalSpent[0]?.total || 0

    // Reset alert triggers if spending decreased
    if (budget.spent < budget.amount) {
        budget.alerts.thresholds.forEach(threshold => {
            const currentPercentage = (budget.spent / budget.amount) * 100
            if (currentPercentage < threshold.percentage) {
                threshold.triggered = false
                threshold.triggeredAt = undefined
            }
        })
    }

    await budget.save()
    return budget
}