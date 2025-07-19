// src/controllers/authController.js
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'

// Generate JWT token
const generateToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables')
    }

    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '7d'
    })
}

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
export const signup = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, password } = req.body

    // Validation
    if (!firstName || !lastName || !email || !password) {
        throw new ApiError(400, 'First name, last name, email, and password are required')
    }

    if (password.length < 6) {
        throw new ApiError(400, 'Password must be at least 6 characters')
    }

    // Validate phone if provided
    if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone)) {
        throw new ApiError(400, 'Please provide a valid phone number')
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
        throw new ApiError(409, 'User already exists with this email')
    }

    // Check if phone already exists (if provided)
    if (phone) {
        const existingPhone = await User.findOne({ phone })
        if (existingPhone) {
            throw new ApiError(409, 'User already exists with this phone number')
        }
    }

    // Create user
    const user = await User.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim(),
        password
    })

    // Generate token
    const token = generateToken(user._id)

    // Remove password from response
    const userResponse = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        subscription: user.subscription,
        preferences: user.preferences,
        stats: user.stats,
        createdAt: user.createdAt
    }

    console.log('✅ Signup successful:', { userId: user._id, email: user.email })

    res.status(201).json(
        new ApiResponse(201, {
            user: userResponse,
            token: token
        }, 'User registered successfully')
    )
})

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body

    console.log('🔐 Login attempt for:', email)

    // Validation
    if (!email || !password) {
        throw new ApiError(400, 'Email and password are required')
    }

    // Find user and include password for comparison
    const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true
    }).select('+password')

    if (!user) {
        console.log('❌ User not found:', email)
        throw new ApiError(401, 'Invalid email or password')
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
        console.log('❌ Invalid password for:', email)
        throw new ApiError(401, 'Invalid email or password')
    }

    // Generate token
    const token = generateToken(user._id)

    // Remove password from response
    const userResponse = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        subscription: user.subscription,
        preferences: user.preferences,
        stats: user.stats,
        lastLogin: new Date()
    }

    console.log('✅ Login successful:', { userId: user._id, email: user.email })

    // FIXED: Direct nesting - no extra data wrapper
    res.status(200).json(
        new ApiResponse(200, {
            user: userResponse,
            token: token
        }, 'Login successful')
    )
})

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)

    if (!user) {
        throw new ApiError(404, 'User not found')
    }

    console.log('👤 User profile requested:', { userId: user._id, email: user.email })

    res.status(200).json(
        new ApiResponse(200, {
            user: user
        }, 'User profile retrieved')
    )
})

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, phone, preferences, annualIncome } = req.body

    const updateData = {}

    if (firstName) updateData.firstName = firstName.trim()
    if (lastName) updateData.lastName = lastName.trim()

    if (phone !== undefined) {
        if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone)) {
            throw new ApiError(400, 'Please provide a valid phone number')
        }

        // Check if phone already exists for another user
        if (phone) {
            const existingPhone = await User.findOne({
                phone,
                _id: { $ne: req.user._id }
            })
            if (existingPhone) {
                throw new ApiError(409, 'Phone number already in use')
            }
        }

        updateData.phone = phone
    }

    if (preferences) {
        if (preferences.currency) updateData['preferences.currency'] = preferences.currency
        if (preferences.timezone) updateData['preferences.timezone'] = preferences.timezone
        if (preferences.theme) updateData['preferences.theme'] = preferences.theme
    }

    // Update annual income if provided
    if (annualIncome !== undefined) {
        if (annualIncome < 0) {
            throw new ApiError(400, 'Annual income cannot be negative')
        }
        updateData['stats.currentIncome.annual'] = annualIncome
        updateData['stats.currentIncome.monthly'] = annualIncome / 12
        updateData['stats.currentIncome.lastUpdated'] = new Date()
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        updateData,
        { new: true, runValidators: true }
    )

    if (!user) {
        throw new ApiError(404, 'User not found')
    }

    console.log('📝 Profile updated:', { userId: user._id, updates: Object.keys(updateData) })

    res.status(200).json(
        new ApiResponse(200, {
            user: user
        }, 'Profile updated successfully')
    )
})

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Current password and new password are required')
    }

    if (newPassword.length < 6) {
        throw new ApiError(400, 'New password must be at least 6 characters')
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password')

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword)
    if (!isCurrentPasswordValid) {
        throw new ApiError(401, 'Current password is incorrect')
    }

    // Update password
    user.password = newPassword
    await user.save()

    console.log('🔒 Password changed for user:', { userId: user._id, email: user.email })

    res.status(200).json(
        new ApiResponse(200, {}, 'Password changed successfully')
    )
})

// @desc    Soft delete user account
// @route   DELETE /api/auth/account
// @access  Private
export const deleteAccount = asyncHandler(async (req, res) => {
    const { password } = req.body

    if (!password) {
        throw new ApiError(400, 'Password is required to delete account')
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password')

    // Verify password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
        throw new ApiError(401, 'Password is incorrect')
    }

    // Soft delete - set isActive to false
    user.isActive = false
    await user.save()

    console.log('🗑️ Account deleted (soft):', { userId: user._id, email: user.email })

    res.status(200).json(
        new ApiResponse(200, {}, 'Account deleted successfully')
    )
})

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req, res) => {
    // In a JWT implementation, logout is typically handled client-side
    // by removing the token. We can log this action or maintain a blacklist

    console.log('👋 User logged out:', { userId: req.user._id, email: req.user.email })

    res.status(200).json(
        new ApiResponse(200, {}, 'Logout successful')
    )
})

// @desc    Refresh JWT token (optional)
// @route   POST /api/auth/refresh
// @access  Private
export const refreshToken = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)

    if (!user || !user.isActive) {
        throw new ApiError(401, 'User not found or inactive')
    }

    // Generate new token
    const token = generateToken(user._id)

    console.log('🔄 Token refreshed:', { userId: user._id, email: user.email })

    res.status(200).json(
        new ApiResponse(200, {
            token: token,
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                subscription: user.subscription,
                preferences: user.preferences,
                stats: user.stats
            }
        }, 'Token refreshed successfully')
    )
})

// @desc    Request password reset (for future implementation)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body

    if (!email) {
        throw new ApiError(400, 'Email is required')
    }

    const user = await User.findOne({
        email: email.toLowerCase(),
        isActive: true
    })

    if (!user) {
        // Don't reveal if email exists for security
        return res.status(200).json(
            new ApiResponse(200, {}, 'If an account with that email exists, a password reset link has been sent')
        )
    }

    // TODO: Implement email sending logic here
    // Generate reset token, save to database, send email

    console.log('🔐 Password reset requested:', { email })

    res.status(200).json(
        new ApiResponse(200, {}, 'If an account with that email exists, a password reset link has been sent')
    )
})

// @desc    Reset password (for future implementation)
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
        throw new ApiError(400, 'Token and new password are required')
    }

    if (newPassword.length < 6) {
        throw new ApiError(400, 'New password must be at least 6 characters')
    }

    // TODO: Implement password reset logic
    // Verify reset token, update password

    res.status(200).json(
        new ApiResponse(200, {}, 'Password reset successful')
    )
})