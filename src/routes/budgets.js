import express from 'express'
import {
    createBudget,
    getBudgets,
    getBudget,
    updateBudget,
    deleteBudget,
    getBudgetSummary,
    getBudgetAlerts,
    recalculateBudget,
    duplicateBudget
} from '../controllers/budgetController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(protect)

// Budget CRUD
router.route('/')
    .get(getBudgets)
    .post(createBudget)

router.route('/:id')
    .get(getBudget)
    .put(updateBudget)
    .delete(deleteBudget)

// Budget utilities
router.get('/analytics/summary', getBudgetSummary)
router.get('/analytics/alerts', getBudgetAlerts)
router.post('/:id/recalculate', recalculateBudget)
router.post('/:id/duplicate', duplicateBudget)

export default router