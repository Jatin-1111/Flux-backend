import express from 'express'
import {
    createIncome,
    getIncomes,
    getIncome,
    updateIncome,
    deleteIncome,
    getIncomeSummary,
    getIncomeByType,
    getUpcomingIncome,
    markIncomeReceived,
    getIncomeVsExpenseAnalysis
} from '../controllers/incomeController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(protect)

// Income CRUD
router.route('/')
    .get(getIncomes)
    .post(createIncome)

router.route('/:id')
    .get(getIncome)
    .put(updateIncome)
    .delete(deleteIncome)

// Income analytics
router.get('/analytics/summary', getIncomeSummary)
router.get('/analytics/by-type', getIncomeByType)
router.get('/analytics/vs-expenses', getIncomeVsExpenseAnalysis)
router.get('/upcoming', getUpcomingIncome)
router.post('/:id/received', markIncomeReceived)

export default router
