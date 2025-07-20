import express from 'express'
import {
    createGoal,
    getGoals,
    getGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal,
    getGoalSummary,
    getGoalsByCategory,
    getGoalInsights,
    processAutoSave
} from '../controllers/goalController.js'
import { protect, requirePremium } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(protect)

// Goal CRUD
router.route('/')
    .get(getGoals)
    .post(createGoal)

router.route('/:id')
    .get(getGoal)
    .put(updateGoal)
    .delete(deleteGoal)

// Goal actions
router.post('/:id/contribute', contributeToGoal)

// Analytics and insights
router.get('/analytics/summary', getGoalSummary)
router.get('/analytics/by-category', getGoalsByCategory)
router.get('/analytics/insights', getGoalInsights)

// Auto-save processing (for scheduled jobs)
router.post('/process-auto-save', processAutoSave)

export default router
