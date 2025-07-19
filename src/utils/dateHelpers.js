export const getDateRange = (period) => {
    const now = new Date()
    let startDate, endDate

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
            break
        case 'week':
            const dayOfWeek = now.getDay()
            startDate = new Date(now)
            startDate.setDate(now.getDate() - dayOfWeek)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(startDate)
            endDate.setDate(startDate.getDate() + 6)
            endDate.setHours(23, 59, 59, 999)
            break
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
            break
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
            break
        case 'last30days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            endDate = now
            break
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    }

    return { startDate, endDate }
}

export const formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency
    }).format(amount)
}

export const getMonthName = (monthIndex) => {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[monthIndex]
}