// src/controllers/incomeController.js
import Income from '../models/Income.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'

// @desc    Create new income source
// @route   POST /api/income
// @access  Private
export const createIncome = asyncHandler(async (req, res) => {
    const {
        source,
        type,
        amount,
        currency,
        frequency,
        description,
        startDate,
        endDate,
        isRecurring,
        taxable,
        employer
    } = req.body

    // Validation
    if (!source || !type || !amount || !frequency) {
        throw new ApiError(400, 'Source, type, amount, and frequency are required')
    }

    if (amount < 0) {
        throw new ApiError(400, 'Amount cannot be negative')
    }

    const user = await User.findById(req.user._id)

    const income = await Income.create({
        user: req.user._id,
        source: source.trim(),
        type,
        amount,
        currency: currency || user.preferences?.currency || 'INR',
        frequency,
        description: description?.trim(),
        startDate: startDate || new Date(),
        endDate,
        isRecurring: isRecurring !== undefined ? isRecurring : true,
        taxable: taxable !== undefined ? taxable : true,
        employer
    })

    // Update user's total income
    await updateUserTotalIncome(req.user._id)

    res.status(201).json(
        new ApiResponse(201, { income }, 'Income source created successfully')
    )
})

// @desc    Get all income sources
// @route   GET /api/income
// @access  Private
export const getIncomes = asyncHandler(async (req, res) => {
    const { active = 'true', type, frequency } = req.query

    const query = { user: req.user._id }

    if (active === 'true') {
        query.isActive = true
        query.$or = [
            { endDate: null },
            { endDate: { $gte: new Date() } }
        ]
    }

    if (type && type !== 'all') {
        query.type = type
    }

    if (frequency && frequency !== 'all') {
        query.frequency = frequency
    }

    const incomes = await Income.find(query).sort({ createdAt: -1 })

    res.status(200).json(
        new ApiResponse(200, { incomes }, 'Income sources retrieved successfully')
    )
})

// @desc    Get single income source
// @route   GET /api/income/:id
// @access  Private
export const getIncome = asyncHandler(async (req, res) => {
    const income = await Income.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!income) {
        throw new ApiError(404, 'Income source not found')
    }

    res.status(200).json(
        new ApiResponse(200, { income }, 'Income source retrieved successfully')
    )
})

// @desc    Update income source
// @route   PUT /api/income/:id
// @access  Private
export const updateIncome = asyncHandler(async (req, res) => {
    const income = await Income.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!income) {
        throw new ApiError(404, 'Income source not found')
    }

    // Update allowed fields
    const allowedUpdates = ['source', 'amount', 'frequency', 'description', 'endDate', 'isActive', 'taxable', 'employer']
    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
            income[field] = req.body[field]
        }
    })

    await income.save()

    // Update user's total income
    await updateUserTotalIncome(req.user._id)

    res.status(200).json(
        new ApiResponse(200, { income }, 'Income source updated successfully')
    )
})

// @desc    Delete income source
// @route   DELETE /api/income/:id
// @access  Private
export const deleteIncome = asyncHandler(async (req, res) => {
    const income = await Income.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!income) {
        throw new ApiError(404, 'Income source not found')
    }

    await income.deleteOne()

    // Update user's total income
    await updateUserTotalIncome(req.user._id)

    res.status(200).json(
        new ApiResponse(200, {}, 'Income source deleted successfully')
    )
})

// @desc    Get income summary
// @route   GET /api/income/summary
// @access  Private
export const getIncomeSummary = asyncHandler(async (req, res) => {
    const summary = await Income.getTotalAnnualIncome(req.user._id)

    if (!summary || summary.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, {
                totalAnnual: 0,
                totalMonthly: 0,
                sourceCount: 0,
                breakdown: []
            }, 'No income sources found')
        )
    }

    res.status(200).json(
        new ApiResponse(200, summary[0], 'Income summary retrieved successfully')
    )
})

// @desc    Get income by type
// @route   GET /api/income/analytics/by-type
// @access  Private
export const getIncomeByType = asyncHandler(async (req, res) => {
    const { year = new Date().getFullYear() } = req.query

    const incomeByType = await Income.getIncomeByType(req.user._id, parseInt(year))

    res.status(200).json(
        new ApiResponse(200, { incomeByType }, 'Income breakdown by type retrieved successfully')
    )
})

// @desc    Get upcoming income
// @route   GET /api/income/upcoming
// @access  Private
export const getUpcomingIncome = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query

    const upcomingIncome = await Income.getUpcomingIncome(req.user._id, parseInt(days))

    res.status(200).json(
        new ApiResponse(200, { upcomingIncome }, 'Upcoming income retrieved successfully')
    )
})

// @desc    Mark income as received
// @route   POST /api/income/:id/received
// @access  Private
export const markIncomeReceived = asyncHandler(async (req, res) => {
    const { amount, date } = req.body

    const income = await Income.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!income) {
        throw new ApiError(404, 'Income source not found')
    }

    await income.markAsReceived(amount, date)

    res.status(200).json(
        new ApiResponse(200, { income }, 'Income marked as received')
    )
})

// @desc    Get income vs expense analysis
// @route   GET /api/income/analytics/vs-expenses
// @access  Private
export const getIncomeVsExpenseAnalysis = asyncHandler(async (req, res) => {
    const { months = 6 } = req.query
    const userId = req.user._id

    // Get total income
    const incomeData = await Income.getTotalAnnualIncome(userId)
    const totalIncome = incomeData[0] || { totalAnnual: 0, totalMonthly: 0 }

    // Get expense data for comparison
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - parseInt(months))

    const expenseData = await Income.aggregate([
        {
            $lookup: {
                from: 'expenses',
                let: { userId: mongoose.Types.ObjectId(userId) },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ['$user', '$userId'] },
                            status: 'completed',
                            date: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$date' },
                                month: { $month: '$date' }
                            },
                            monthlyExpenses: { $sum: '$amount' }
                        }
                    }
                ],
                as: 'expenses'
            }
        },
        {
            $unwind: { path: '$expenses', preserveNullAndEmptyArrays: true }
        },
        {
            $group: {
                _id: null,
                avgMonthlyExpenses: { $avg: '$expenses.monthlyExpenses' },
                totalExpenses: { $sum: '$expenses.monthlyExpenses' }
            }
        }
    ])

    const avgMonthlyExpenses = expenseData[0]?.avgMonthlyExpenses || 0
    const totalExpenses = expenseData[0]?.totalExpenses || 0

    // Calculate ratios and insights
    const savingsRate = totalIncome.totalMonthly > 0
        ? ((totalIncome.totalMonthly - avgMonthlyExpenses) / totalIncome.totalMonthly) * 100
        : 0

    const analysis = {
        income: {
            annual: totalIncome.totalAnnual,
            monthly: totalIncome.totalMonthly
        },
        expenses: {
            avgMonthly: avgMonthlyExpenses,
            total: totalExpenses
        },
        ratios: {
            savingsRate: Math.round(savingsRate * 100) / 100,
            expenseToIncomeRatio: totalIncome.totalMonthly > 0
                ? Math.round((avgMonthlyExpenses / totalIncome.totalMonthly) * 100 * 100) / 100
                : 0
        },
        insights: generateFinancialInsights(totalIncome.totalMonthly, avgMonthlyExpenses, savingsRate)
    }

    res.status(200).json(
        new ApiResponse(200, { analysis }, 'Income vs expense analysis retrieved successfully')
    )
})

// Helper function to update user's total income
const updateUserTotalIncome = async (userId) => {
    try {
        const incomeData = await Income.getTotalAnnualIncome(userId)
        const totalIncome = incomeData[0] || { totalAnnual: 0, totalMonthly: 0 }

        await User.findByIdAndUpdate(userId, {
            'stats.currentIncome.annual': totalIncome.totalAnnual,
            'stats.currentIncome.monthly': totalIncome.totalMonthly,
            'stats.currentIncome.lastUpdated': new Date()
        })
    } catch (error) {
        console.error('Error updating user total income:', error)
    }
}

// Helper function to generate financial insights
const generateFinancialInsights = (monthlyIncome, avgMonthlyExpenses, savingsRate) => {
    const insights = []

    if (monthlyIncome === 0) {
        insights.push({
            type: 'warning',
            message: 'No income sources added. Add your income to get better financial insights.',
            priority: 'high'
        })
        return insights
    }

    if (savingsRate < 0) {
        insights.push({
            type: 'critical',
            message: 'You are spending more than you earn. Consider reducing expenses or increasing income.',
            priority: 'critical'
        })
    } else if (savingsRate < 10) {
        insights.push({
            type: 'warning',
            message: 'Your savings rate is below 10%. Consider increasing your savings for better financial health.',
            priority: 'high'
        })
    } else if (savingsRate >= 20) {
        insights.push({
            type: 'success',
            message: 'Great job! You\'re saving 20% or more of your income.',
            priority: 'low'
        })
    }

    const expenseRatio = (avgMonthlyExpenses / monthlyIncome) * 100
    if (expenseRatio > 80) {
        insights.push({
            type: 'warning',
            message: 'You\'re spending over 80% of your income. Consider creating a budget to track expenses.',
            priority: 'medium'
        })
    }

    return insights
}