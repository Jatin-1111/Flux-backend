import Goal from '../models/Goal.js'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'

// @desc    Create new goal
// @route   POST /api/goals
// @access  Private
export const createGoal = asyncHandler(async (req, res) => {
    const {
        name,
        targetAmount,
        currentAmount = 0,
        category,
        description,
        deadline,
        autoSave,
        tags,
        priority = 'medium'
    } = req.body

    // Validation
    if (!name || !targetAmount || !category || !deadline) {
        throw new ApiError(400, 'Name, target amount, category, and deadline are required')
    }

    if (targetAmount <= 0) {
        throw new ApiError(400, 'Target amount must be greater than 0')
    }

    if (currentAmount < 0) {
        throw new ApiError(400, 'Current amount cannot be negative')
    }

    if (new Date(deadline) <= new Date()) {
        throw new ApiError(400, 'Deadline must be in the future')
    }

    const user = await User.findById(req.user._id)

    const goal = await Goal.create({
        user: req.user._id,
        name: name.trim(),
        targetAmount,
        currentAmount,
        currency: user.preferences?.currency || 'INR',
        category,
        description: description?.trim(),
        deadline: new Date(deadline),
        autoSave: autoSave || { enabled: false },
        tags: tags || [],
        priority
    })

    // Add initial contribution if currentAmount > 0
    if (currentAmount > 0) {
        await goal.addContribution(currentAmount, 'Initial contribution', 'manual')
    }

    await goal.populate('user', 'firstName lastName email')

    console.log('✅ Goal created:', { goalId: goal._id, userId: req.user._id, name: goal.name })

    res.status(201).json(
        new ApiResponse(201, { goal }, 'Goal created successfully')
    )
})

// @desc    Get all goals for user
// @route   GET /api/goals
// @access  Private
export const getGoals = asyncHandler(async (req, res) => {
    const {
        status = 'all',
        category,
        priority,
        sortBy = 'deadline',
        sortOrder = 'asc',
        page = 1,
        limit = 20
    } = req.query

    // Build query
    const query = {
        user: req.user._id,
        isActive: true
    }

    if (status === 'active') {
        query.isCompleted = false
    } else if (status === 'completed') {
        query.isCompleted = true
    }

    if (category && category !== 'all') {
        query.category = category
    }

    if (priority && priority !== 'all') {
        query.priority = priority
    }

    // Sort options
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const goals = await Goal.find(query)
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(skip)
        .populate('user', 'firstName lastName')

    const total = await Goal.countDocuments(query)

    res.status(200).json(
        new ApiResponse(200, {
            goals,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalGoals: total,
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        }, 'Goals retrieved successfully')
    )
})

// @desc    Get single goal
// @route   GET /api/goals/:id
// @access  Private
export const getGoal = asyncHandler(async (req, res) => {
    const goal = await Goal.findOne({
        _id: req.params.id,
        user: req.user._id
    }).populate('user', 'firstName lastName')

    if (!goal) {
        throw new ApiError(404, 'Goal not found')
    }

    res.status(200).json(
        new ApiResponse(200, { goal }, 'Goal retrieved successfully')
    )
})

// @desc    Update goal
// @route   PUT /api/goals/:id
// @access  Private
export const updateGoal = asyncHandler(async (req, res) => {
    const goal = await Goal.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!goal) {
        throw new ApiError(404, 'Goal not found')
    }

    // Don't allow updating completed goals
    if (goal.isCompleted) {
        throw new ApiError(400, 'Cannot update completed goal')
    }

    const allowedUpdates = [
        'name', 'targetAmount', 'category', 'description',
        'deadline', 'autoSave', 'tags', 'priority'
    ]

    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
            goal[field] = req.body[field]
        }
    })

    // Validate deadline if updated
    if (req.body.deadline && new Date(req.body.deadline) <= new Date()) {
        throw new ApiError(400, 'Deadline must be in the future')
    }

    await goal.save()

    console.log('✅ Goal updated:', { goalId: goal._id, userId: req.user._id })

    res.status(200).json(
        new ApiResponse(200, { goal }, 'Goal updated successfully')
    )
})

// @desc    Delete goal
// @route   DELETE /api/goals/:id
// @access  Private
export const deleteGoal = asyncHandler(async (req, res) => {
    const goal = await Goal.findOne({
        _id: req.params.id,
        user: req.user._id
    })

    if (!goal) {
        throw new ApiError(404, 'Goal not found')
    }

    // Soft delete by setting isActive to false
    goal.isActive = false
    await goal.save()

    console.log('✅ Goal deleted:', { goalId: goal._id, userId: req.user._id })

    res.status(200).json(
        new ApiResponse(200, {}, 'Goal deleted successfully')
    )
})

// @desc    Add contribution to goal
// @route   POST /api/goals/:id/contribute
// @access  Private
export const contributeToGoal = asyncHandler(async (req, res) => {
    const { amount, description } = req.body

    if (!amount || amount <= 0) {
        throw new ApiError(400, 'Valid contribution amount is required')
    }

    const goal = await Goal.findOne({
        _id: req.params.id,
        user: req.user._id,
        isActive: true
    })

    if (!goal) {
        throw new ApiError(404, 'Goal not found')
    }

    if (goal.isCompleted) {
        throw new ApiError(400, 'Goal is already completed')
    }

    const remainingAmount = goal.targetAmount - goal.currentAmount
    if (amount > remainingAmount) {
        throw new ApiError(400, `Contribution amount exceeds remaining target by ${(amount - remainingAmount).toFixed(2)}`)
    }

    await goal.addContribution(amount, description || 'Manual contribution', 'manual')

    console.log('✅ Contribution added:', {
        goalId: goal._id,
        userId: req.user._id,
        amount,
        newTotal: goal.currentAmount
    })

    res.status(200).json(
        new ApiResponse(200, { goal }, 'Contribution added successfully')
    )
})

// @desc    Get goal summary for user
// @route   GET /api/goals/summary
// @access  Private
export const getGoalSummary = asyncHandler(async (req, res) => {
    const summary = await Goal.getUserSummary(req.user._id)

    if (!summary || summary.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, {
                totalGoals: 0,
                activeGoals: 0,
                completedGoals: 0,
                totalTarget: 0,
                totalSaved: 0,
                totalRemaining: 0,
                avgProgress: 0,
                overallProgress: 0
            }, 'No goals found')
        )
    }

    res.status(200).json(
        new ApiResponse(200, summary[0], 'Goal summary retrieved successfully')
    )
})

// @desc    Get goals by category
// @route   GET /api/goals/analytics/by-category
// @access  Private
export const getGoalsByCategory = asyncHandler(async (req, res) => {
    const categoryData = await Goal.getGoalsByCategory(req.user._id)

    res.status(200).json(
        new ApiResponse(200, { categoryData }, 'Goals by category retrieved successfully')
    )
})

// @desc    Get goal insights
// @route   GET /api/goals/insights
// @access  Private
export const getGoalInsights = asyncHandler(async (req, res) => {
    const userId = req.user._id

    // Get all active goals
    const goals = await Goal.find({
        user: userId,
        isActive: true,
        isCompleted: false
    })

    const insights = []

    goals.forEach(goal => {
        const daysRemaining = goal.daysRemaining
        const progressPercentage = goal.progressPercentage
        const monthlySavingsNeeded = goal.monthlySavingsNeeded

        // Urgent deadline warning
        if (daysRemaining <= 30 && progressPercentage < 80) {
            insights.push({
                type: 'warning',
                goalId: goal._id,
                goalName: goal.name,
                message: `${goal.name} deadline is in ${daysRemaining} days but only ${progressPercentage.toFixed(1)}% complete`,
                priority: 'high',
                action: `Save ₹${monthlySavingsNeeded.toFixed(0)} monthly to reach your goal`
            })
        }

        // Low progress warning
        if (progressPercentage < 25 && daysRemaining <= 90) {
            insights.push({
                type: 'warning',
                goalId: goal._id,
                goalName: goal.name,
                message: `${goal.name} needs more attention - only ${progressPercentage.toFixed(1)}% complete`,
                priority: 'medium',
                action: 'Consider increasing your monthly contributions'
            })
        }

        // Success celebration
        if (progressPercentage >= 90) {
            insights.push({
                type: 'success',
                goalId: goal._id,
                goalName: goal.name,
                message: `Almost there! ${goal.name} is ${progressPercentage.toFixed(1)}% complete`,
                priority: 'low',
                action: `Just ₹${goal.remainingAmount.toFixed(0)} more to go!`
            })
        }

        // Auto-save suggestion
        if (!goal.autoSave.enabled && progressPercentage < 50) {
            insights.push({
                type: 'suggestion',
                goalId: goal._id,
                goalName: goal.name,
                message: `Enable auto-save for ${goal.name} to stay on track`,
                priority: 'low',
                action: `Auto-save ₹${(monthlySavingsNeeded / 2).toFixed(0)} monthly`
            })
        }
    })

    // Sort by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    insights.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])

    res.status(200).json(
        new ApiResponse(200, { insights }, 'Goal insights retrieved successfully')
    )
})

// @desc    Process auto-save contributions (for scheduled job)
// @route   POST /api/goals/process-auto-save
// @access  Private (Admin/System)
export const processAutoSave = asyncHandler(async (req, res) => {
    const dueGoals = await Goal.findAutoSaveDue()
    const results = []

    for (const goal of dueGoals) {
        try {
            await goal.addContribution(
                goal.autoSave.amount,
                `Auto-save contribution (${goal.autoSave.frequency})`,
                'auto-save'
            )

            // Set next contribution date
            goal.autoSave.nextContribution = goal.calculateNextContribution()
            await goal.save()

            results.push({
                goalId: goal._id,
                goalName: goal.name,
                amount: goal.autoSave.amount,
                status: 'success'
            })
        } catch (error) {
            results.push({
                goalId: goal._id,
                goalName: goal.name,
                amount: goal.autoSave.amount,
                status: 'failed',
                error: error.message
            })
        }
    }

    console.log('✅ Auto-save processed:', { processedCount: results.length })

    res.status(200).json(
        new ApiResponse(200, { results }, 'Auto-save contributions processed')
    )
})