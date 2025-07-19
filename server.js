// server.js
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import { config } from 'dotenv'

// Import routes
import authRoutes from './src/routes/auth.js'
import expenseRoutes from './src/routes/expenses.js'
import budgetRoutes from './src/routes/budgets.js'
import incomeRoutes from './src/routes/income.js'

// Import middleware
import { errorHandler, notFound } from './src/middleware/errorHandler.js'

// Load environment variables
config()

const app = express()

// Security & middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}))

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`)
        next()
    })
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'Flux API running ⚡',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/budgets', budgetRoutes)
app.use('/api/income', incomeRoutes)

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Flux Expense Tracker API',
        version: '1.0.0',
        description: 'Smart personal expense tracking with analytics',
        endpoints: {
            auth: '/api/auth',
            expenses: '/api/expenses',
            budgets: '/api/budgets',
            income: '/api/income'
        },
        documentation: 'https://github.com/your-repo/docs'
    })
})

// Error handling middleware
app.use(notFound)
app.use(errorHandler)

// Database connection with retry logic
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Mongoose 7+ doesn't need these options, but keeping for compatibility
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        })

        console.log(`📦 MongoDB connected: ${conn.connection.host}`)

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err)
        })

        mongoose.connection.on('disconnected', () => {
            console.log('📦 MongoDB disconnected')
        })

        return conn
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message)

        // Retry connection after 5 seconds
        setTimeout(connectDB, 5000)
    }
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)

    try {
        await mongoose.connection.close()
        console.log('📦 MongoDB connection closed')
        process.exit(0)
    } catch (error) {
        console.error('❌ Error during shutdown:', error)
        process.exit(1)
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

// Unhandled promise rejection
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err)
    process.exit(1)
})

// Uncaught exception
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err)
    process.exit(1)
})

const PORT = process.env.PORT || 5000

const startServer = async () => {
    await connectDB()

    const server = app.listen(PORT, () => {
        console.log(`🚀 Flux API running on port ${PORT}`)
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
        console.log(`📊 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
        console.log(`🔗 API Docs: http://localhost:${PORT}/api`)
    })

    // Handle server errors
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use`)
            process.exit(1)
        } else {
            console.error('❌ Server error:', error)
        }
    })

    return server
}

startServer().catch((error) => {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
})