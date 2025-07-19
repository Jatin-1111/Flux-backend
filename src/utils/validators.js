export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

export const validatePassword = (password) => {
    const errors = []

    if (password.length < 6) {
        errors.push('Password must be at least 6 characters')
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain lowercase letter')
    }

    if (!/\d/.test(password)) {
        errors.push('Password must contain number')
    }

    return {
        isValid: errors.length === 0,
        errors
    }
}

export const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input

    return input
        .trim()
        .replace(/[<>]/g, '') // Basic XSS protection
        .slice(0, 1000) // Limit input length
}