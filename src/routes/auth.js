import express from 'express'
import {
    signup,
    login,
    getMe,
    updateProfile,
    changePassword,
    deleteAccount,
    logout
} from '../controllers/authController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// Public routes
router.post('/signup', signup)
router.post('/login', login)

// Protected routes
router.use(protect) // All routes below require authentication

router.get('/me', getMe)
router.put('/profile', updateProfile)
router.put('/change-password', changePassword)
router.delete('/account', deleteAccount)
router.post('/logout', logout)

export default router
