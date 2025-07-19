import express from 'express'
import {
    createExpense,
    getExpenses,
    getExpense,
    updateExpense,
    deleteExpense,
    getExpenseAnalytics,
    getExpenseInsights
} from '../controllers/expenseController.js'
import { protect, rateLimitFreeUser } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(protect)

// Expense CRUD
router.route('/')
    .get(getExpenses)
    .post(rateLimitFreeUser, createExpense)

router.route('/:id')
    .get(getExpense)
    .put(updateExpense)
    .delete(deleteExpense)

// Analytics and insights
router.get('/analytics/stats', getExpenseAnalytics)
router.get('/analytics/insights', getExpenseInsights)

export default router
