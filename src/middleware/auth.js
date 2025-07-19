// src/middleware/auth.js
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'

// Protect routes - verify JWT token
export const protect = asyncHandler(async (req, res, next) => {
    let token

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1]

            if (!token || token === 'null' || token === 'undefined') {
                throw new ApiError(401, 'Access denied. No valid token provided.')
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET)

            if (!decoded || !decoded.userId) {
                throw new ApiError(401, 'Invalid token structure.')
            }

            // Get user from token
            const user = await User.findById(decoded.userId).select('-password')

            if (!user) {
                throw new ApiError(401, 'User not found. Token invalid.')
            }

            if (!user.isActive) {
                throw new ApiError(401, 'Account is deactivated.')
            }

            // Add user to request object
            req.user = user
            next()
        } catch (error) {
            console.error('Auth Error:', error)

            if (error.name === 'JsonWebTokenError') {
                throw new ApiError(401, 'Invalid token format.')
            } else if (error.name === 'TokenExpiredError') {
                throw new ApiError(401, 'Token expired. Please login again.')
            } else if (error instanceof ApiError) {
                throw error
            } else {
                throw new ApiError(401, 'Authentication failed.')
            }
        }
    } else {
        throw new ApiError(401, 'Access denied. Authorization header missing.')
    }
})

// Check if user has premium subscription
export const requirePremium = asyncHandler(async (req, res, next) => {
    if (!req.user.isPremium()) {
        throw new ApiError(403, 'Premium subscription required for this feature.')
    }
    next()
})

// Rate limiting middleware for expense creation (free tier)
export const rateLimitFreeUser = asyncHandler(async (req, res, next) => {
    if (req.user.isPremium()) {
        return next()
    }

    // Import Expense model here to avoid circular dependency
    const { default: Expense } = await import('../models/Expense.js')

    // Check monthly expense limit for free users
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const expenseCount = await Expense.countDocuments({
        user: req.user._id,
        date: { $gte: startOfMonth },
        status: 'completed'
    })

    if (expenseCount >= req.user.stats.monthlyLimit) {
        throw new ApiError(429, 'Monthly expense limit reached. Upgrade to premium for unlimited expenses.')
    }

    next()
})

// Admin only access (for future admin features)
export const adminOnly = asyncHandler(async (req, res, next) => {
    if (req.user.role !== 'admin') {
        throw new ApiError(403, 'Admin access required.')
    }
    next()
})