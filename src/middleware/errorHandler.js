// src/middleware/errorHandler.js
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'

// Global error handler
export const errorHandler = (err, req, res, next) => {
    let error = { ...err }
    error.message = err.message

    // Log error
    console.error('Error:', err)

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found'
        error = new ApiError(404, message)
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0]
        const message = `${field} already exists`
        error = new ApiError(409, message)
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ')
        error = new ApiError(400, message)
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token'
        error = new ApiError(401, message)
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired'
        error = new ApiError(401, message)
    }

    // Default to 500 server error
    if (!(error instanceof ApiError)) {
        error = new ApiError(500, 'Internal server error')
    }

    res.status(error.statusCode || 500).json(
        new ApiResponse(
            error.statusCode || 500,
            null,
            error.message || 'Internal server error'
        )
    )
}

// Handle 404 not found
export const notFound = (req, res, next) => {
    const error = new ApiError(404, `Route ${req.originalUrl} not found`)
    next(error)
}

// Rate limiting error handler
export const rateLimitHandler = (req, res) => {
    res.status(429).json(
        new ApiResponse(429, null, 'Too many requests. Please try again later.')
    )
}