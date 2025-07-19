// src/controllers/expenseController.js
import Expense from '../models/Expense.js'
import Budget from '../models/Budget.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { getQueryOptions } from '../utils/queryHelpers.js'

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
export const createExpense = asyncHandler(async (req, res) => {
    const {
        amount,
        currency,
        description,
        category,
        subcategory,
        tags,
        date,
        location,
        recurring
    } = req.body

    // Validation
    if (!amount || !description || !category) {
        throw new ApiError(400, 'Amount, description, and category are required')
    }

    // Check user's monthly limits for free tier
    const user = await User.findById(req.user._id)
    if (!user.canAddExpense()) {
        throw new ApiError(403, 'Monthly expense limit reached. Upgrade to premium for unlimited expenses.')
    }

    // Create expense
    const expense = await Expense.create({
        user: req.user._id,
        amount,
        currency: currency || user.preferences.currency,
        description: description.trim(),
        category,
        subcategory: subcategory?.trim(),
        tags: tags || [],
        date: date || new Date(),
        location,
        recurring: recurring || { isRecurring: false },
        metadata: {
            source: 'manual',
            deviceInfo: req.get('User-Agent'),
            ipAddress: req.ip
        }
    })

    // Update user's expense count
    await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.totalExpenses': 1 }
    })

    // Update relevant budgets
    await updateBudgetSpending(req.user._id, expense.category, expense.amount)

    // Check for recurring pattern detection
    if (!recurring?.isRecurring) {
        const similarExpenses = await Expense.detectRecurring(
            req.user._id,
            description,
            amount
        )

        if (similarExpenses.length >= 2) {
            expense.metadata.recurringDetected = true
        }
    }

    await expense.save()
    await expense.populate('user', 'firstName lastName email')

    res.status(201).json(
        new ApiResponse(201, { expense }, 'Expense created successfully')
    )
})

// @desc    Get all expenses with filtering
// @route   GET /api/expenses
// @access  Private
export const getExpenses = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, category, startDate, endDate, search, sortBy = 'date', sortOrder = 'desc' } = req.query

    // Build query
    const query = { user: req.user._id, status: 'completed' }

    if (category && category !== 'all') {
        query.category = category
    }

    if (startDate || endDate) {
        query.date = {}
        if (startDate) query.date.$gte = new Date(startDate)
        if (endDate) query.date.$lte = new Date(endDate)
    }

    if (search) {
        query.$text = { $search: search }
    }

    // Pagination options
    const options = getQueryOptions(page, limit, sortBy, sortOrder)

    const expenses = await Expense.find(query)
        .sort(options.sort)
        .limit(options.limit)
        .skip(options.skip)
        .populate('user', 'firstName lastName')

    const total = await Expense.countDocuments(query)

    res.status(200).json(
        new ApiResponse(200, {
            expenses,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalExpenses: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        }, 'Expenses retrieved successfully')
    )
})

// @desc    Get single expense
// @route   GET /api/expenses/:id
// @access  Private
export const getExpense = asyncHandler(async (req, res) => {
    const expense = await Expense.findOne({
        _id: req.params.id,
        user: req.user._id
    }).populate('user', 'firstName lastName')

    if (!expense) {
        throw new ApiError(404, 'Expense not found')
    }

    res.status(200).json(
        new ApiResponse(200, { expense }, 'Expense retrieved successfully')
    )
})

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
export const updateExpense = asyncHandler(async (req, res) => {
    const expense = await Expense.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!expense) {
        throw new ApiError(404, 'Expense not found')
    }

    const oldAmount = expense.amount
    const oldCategory = expense.category

    // Update fields
    Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
            expense[key] = req.body[key]
        }
    })

    await expense.save()

    // Update budget if amount or category changed
    if (oldAmount !== expense.amount || oldCategory !== expense.category) {
        // Reverse old budget impact
        await updateBudgetSpending(req.user._id, oldCategory, -oldAmount)
        // Apply new budget impact
        await updateBudgetSpending(req.user._id, expense.category, expense.amount)
    }

    res.status(200).json(
        new ApiResponse(200, { expense }, 'Expense updated successfully')
    )
})

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
export const deleteExpense = asyncHandler(async (req, res) => {
    const expense = await Expense.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!expense) {
        throw new ApiError(404, 'Expense not found')
    }

    // Update budget (reverse the spending)
    await updateBudgetSpending(req.user._id, expense.category, -expense.amount)

    // Update user's expense count
    await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'stats.totalExpenses': -1 }
    })

    await expense.deleteOne()

    res.status(200).json(
        new ApiResponse(200, {}, 'Expense deleted successfully')
    )
})

// @desc    Get expense analytics
// @route   GET /api/expenses/analytics
// @access  Private
export const getExpenseAnalytics = asyncHandler(async (req, res) => {
    const { period = 'month', year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query

    const userId = req.user._id

    // Get monthly stats
    const monthlyStats = await Expense.getMonthlyStats(userId, parseInt(year), parseInt(month))

    // Get spending trend
    const spendingTrend = await Expense.getSpendingTrend(userId, 6)

    // Get top categories
    const topCategories = await Expense.aggregate([
        {
            $match: {
                user: userId,
                status: 'completed',
                date: {
                    $gte: new Date(year, month - 1, 1),
                    $lte: new Date(year, month, 0, 23, 59, 59)
                }
            }
        },
        {
            $group: {
                _id: '$category',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        { $sort: { total: -1 } },
        { $limit: 10 }
    ])

    // Get daily spending for current month
    const dailySpending = await Expense.aggregate([
        {
            $match: {
                user: userId,
                status: 'completed',
                date: {
                    $gte: new Date(year, month - 1, 1),
                    $lte: new Date(year, month, 0, 23, 59, 59)
                }
            }
        },
        {
            $group: {
                _id: { $dayOfMonth: '$date' },
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } }
    ])

    res.status(200).json(
        new ApiResponse(200, {
            monthlyStats,
            spendingTrend,
            topCategories,
            dailySpending
        }, 'Analytics retrieved successfully')
    )
})

// @desc    Get expense insights
// @route   GET /api/expenses/insights
// @access  Private
export const getExpenseInsights = asyncHandler(async (req, res) => {
    const userId = req.user._id
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    // This month vs last month comparison
    const [thisMonthTotal, lastMonthTotal] = await Promise.all([
        Expense.aggregate([
            {
                $match: {
                    user: userId,
                    date: { $gte: thisMonth },
                    status: 'completed'
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Expense.aggregate([
            {
                $match: {
                    user: userId,
                    date: { $gte: lastMonth, $lte: lastMonthEnd },
                    status: 'completed'
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
    ])

    const thisTotal = thisMonthTotal[0]?.total || 0
    const lastTotal = lastMonthTotal[0]?.total || 0
    const monthlyChange = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0

    // Most expensive categories
    const expensiveCategories = await Expense.aggregate([
        {
            $match: {
                user: userId,
                date: { $gte: thisMonth },
                status: 'completed'
            }
        },
        {
            $group: {
                _id: '$category',
                total: { $sum: '$amount' },
                avgAmount: { $avg: '$amount' },
                count: { $sum: 1 }
            }
        },
        { $sort: { total: -1 } },
        { $limit: 5 }
    ])

    // Recurring expense suggestions
    const recurringCandidates = await Expense.aggregate([
        {
            $match: {
                user: userId,
                'recurring.isRecurring': false,
                date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
            }
        },
        {
            $group: {
                _id: {
                    description: { $toLower: '$description' },
                    category: '$category'
                },
                count: { $sum: 1 },
                amounts: { $push: '$amount' },
                dates: { $push: '$date' }
            }
        },
        {
            $match: { count: { $gte: 3 } }
        },
        { $limit: 5 }
    ])

    const insights = {
        monthlyComparison: {
            thisMonth: thisTotal,
            lastMonth: lastTotal,
            changePercentage: monthlyChange,
            trend: monthlyChange > 0 ? 'increase' : 'decrease'
        },
        topCategories: expensiveCategories,
        recurringCandidates: recurringCandidates.map(item => ({
            description: item._id.description,
            category: item._id.category,
            frequency: item.count,
            avgAmount: item.amounts.reduce((a, b) => a + b, 0) / item.amounts.length
        }))
    }

    res.status(200).json(
        new ApiResponse(200, { insights }, 'Insights retrieved successfully')
    )
})

// Helper function to update budget spending
const updateBudgetSpending = async (userId, category, amount) => {
    try {
        // Update category-specific budget
        const categoryBudget = await Budget.findOne({
            user: userId,
            category,
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        })

        if (categoryBudget) {
            await categoryBudget.updateSpent(amount, 0)
        }

        // Update total budget
        const totalBudget = await Budget.findOne({
            user: userId,
            category: 'total',
            isActive: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        })

        if (totalBudget) {
            await totalBudget.updateSpent(amount, 0)
        }
    } catch (error) {
        console.error('Error updating budget spending:', error)
    }
}