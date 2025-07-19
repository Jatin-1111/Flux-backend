export const getQueryOptions = (page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc') => {
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 }

    return {
        skip: Math.max(0, skip),
        limit: Math.min(100, parseInt(limit)), // Max 100 items per page
        sort
    }
}

export const buildSearchQuery = (searchTerm, fields = []) => {
    if (!searchTerm) return {}

    const searchRegex = new RegExp(searchTerm, 'i')

    return {
        $or: fields.map(field => ({
            [field]: searchRegex
        }))
    }
}