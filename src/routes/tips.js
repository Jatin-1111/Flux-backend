import express from 'express';
import { getTodaysTip } from '../controllers/tipController.js';

const router = express.Router();

// Route for the Next.js frontend to fetch the daily tip.
// GET /api/tips/today
router.get('/today', getTodaysTip);

export default router;