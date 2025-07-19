export const EXPENSE_CATEGORIES = {
    food: { name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B' },
    transport: { name: 'Transportation', icon: '🚗', color: '#4ECDC4' },
    entertainment: { name: 'Entertainment', icon: '🎬', color: '#45B7D1' },
    shopping: { name: 'Shopping', icon: '🛍️', color: '#96CEB4' },
    bills: { name: 'Bills & Utilities', icon: '⚡', color: '#FFEAA7' },
    healthcare: { name: 'Healthcare', icon: '🏥', color: '#DDA0DD' },
    education: { name: 'Education', icon: '📚', color: '#98D8C8' },
    travel: { name: 'Travel', icon: '✈️', color: '#74B9FF' },
    groceries: { name: 'Groceries', icon: '🛒', color: '#55A3FF' },
    business: { name: 'Business', icon: '💼', color: '#FD79A8' },
    personal: { name: 'Personal Care', icon: '🧴', color: '#FDCB6E' },
    other: { name: 'Other', icon: '📂', color: '#6C5CE7' }
}

export const getCategoryInfo = (category) => {
    return EXPENSE_CATEGORIES[category] || EXPENSE_CATEGORIES.other
}

export const getAllCategories = () => {
    return Object.keys(EXPENSE_CATEGORIES)
}