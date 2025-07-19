import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import { config } from 'dotenv'

// Load environment variables
config()

const app = express()

// Security & middleware
app.use(helmet())
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'Flux API running ⚡',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    })
})

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log('📦 MongoDB connected successfully')
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message)
        process.exit(1)
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Flux API...')
    await mongoose.connection.close()
    process.exit(0)
})

const PORT = process.env.PORT || 5000

const startServer = async () => {
    await connectDB()

    app.listen(PORT, () => {
        console.log(`🚀 Flux API running on port ${PORT}`)
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
}

startServer()