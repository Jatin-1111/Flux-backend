## API Endpoints

### Authentication
```
POST   /api/auth/register        # User signup
POST# Personal Expense Tracker API

## Overview

RESTful API server for a comprehensive personal expense tracking application. Built with Node.js, Express, and MongoDB to handle individual user financial data with smart features like recurring detection, expense splitting, and financial insights.

---

## Technology Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT with bcrypt
- **Currency Conversion:** External API (exchangerate-api.io)
- **Payment Processing:** Stripe (for premium subscriptions)
- **Deployment:** Railway/Render/Vercel

---

## Project Structure

```
expense-tracker-backend/
├── src/
│   ├── models/
│   │   ├── User.js              # User accounts & preferences
│   │   ├── Expense.js           # Expense records
│   │   ├── Category.js          # Expense categories
│   │   ├── Budget.js            # Budget management
│   │   ├── Goal.js              # Savings goals
│   │   ├── Income.js            # Income tracking
│   │   ├── RecurringExpense.js  # Recurring expense templates
│   │   └── SplitExpense.js      # Shared expense tracking
│   ├── routes/
│   │   ├── auth.js              # Authentication endpoints
│   │   ├── expenses.js          # Expense CRUD operations
│   │   ├── categories.js        # Category management
│   │   ├── budgets.js           # Budget operations
│   │   ├── goals.js             # Savings goals
│   │   ├── income.js            # Income tracking
│   │   ├── analytics.js         # Financial insights
│   │   ├── recurring.js         # Recurring expenses
│   │   └── split.js             # Expense splitting
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   ├── validation.js        # Request validation
│   │   └── rateLimiting.js      # API rate limiting
│   ├── controllers/
│   │   ├── authController.js    # Auth business logic
│   │   ├── expenseController.js # Expense operations
│   │   ├── analyticsController.js # Insights generation
│   │   └── recurringController.js # Recurring logic
│   ├── utils/
│   │   ├── currency.js          # Currency conversion
│   │   ├── insights.js          # Financial insights generation
│   │   ├── email.js             # Email notifications
│   │   └── recurring.js         # Recurring expense logic
│   └── config/
│       ├── database.js          # MongoDB connection
│       └── constants.js         # App constants
├── .env
├── server.js
└── package.json
```

---

## Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/expense_tracker

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Currency Conversion
CURRENCY_API_KEY=your-currency-api-key
CURRENCY_API_URL=https://api.exchangerate-api.io/v4/latest

# Stripe (Premium Subscriptions)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email Service (Optional - for expense splitting notifications)
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@expensetracker.com
```

---

## Database Schema

### Personal Finance Architecture
All data belongs to individual users - no complex multi-tenancy needed.

### Core Models

#### User Model
```javascript
{
  _id: ObjectId,
  email: String (unique),
  password: String (hashed),
  profile: {
    firstName: String,
    lastName: String,
    currency: String (default: 'USD'),
    timezone: String
  },
  subscription: {
    tier: ['free', 'premium'],
    status: ['active', 'cancelled'],
    stripeCustomerId: String
  },
  settings: {
    budgetAlerts: Boolean,
    weeklyReports: Boolean,
    defaultCategory: String
  },
  createdAt: Date,
  lastLogin: Date
}
```

#### Expense Model
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  amount: Number,
  currency: String,
  category: String,
  description: String,
  tags: [String],
  location: String,
  date: Date,
  isRecurring: Boolean,
  recurringId: ObjectId (ref: RecurringExpense),
  splitData: {
    isSplit: Boolean,
    totalAmount: Number,
    splitWith: [{ email: String, amount: Number, paid: Boolean }]
  },
  receipt: {
    hasReceipt: Boolean,
    imageUrl: String,
    notes: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Budget Model
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  category: String,
  monthlyLimit: Number,
  currentSpent: Number,
  alertThresholds: [Number], // [75, 90, 100]
  rolloverUnused: Boolean,
  month: Number,
  year: Number,
  createdAt: Date
}
```

#### Goal Model
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  name: String,
  targetAmount: Number,
  currentAmount: Number,
  deadline: Date,
  category: String, // 'emergency', 'vacation', 'gadget', etc.
  autoSave: {
    enabled: Boolean,
    amount: Number,
    frequency: String // 'weekly', 'monthly'
  },
  isCompleted: Boolean,
  createdAt: Date
}
```

#### Income Model
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  amount: Number,
  source: String, // 'salary', 'freelance', 'investment', etc.
  frequency: String, // 'one-time', 'weekly', 'monthly', 'yearly'
  isRecurring: Boolean,
  nextDate: Date,
  description: String,
  date: Date,
  createdAt: Date
}
```

---

## API Endpoints

### Authentication
```
POST   /api/auth/register        # User signup
POST   /api/auth/login           # User login
POST   /api/auth/refresh         # Refresh JWT token
POST   /api/auth/forgot-password # Password reset
PUT    /api/auth/profile         # Update user profile
```

### Expenses
```
GET    /api/expenses             # List expenses (with filters)
POST   /api/expenses             # Create new expense
GET    /api/expenses/:id         # Get expense details
PUT    /api/expenses/:id         # Update expense
DELETE /api/expenses/:id         # Delete expense
GET    /api/expenses/search      # Search expenses by description
POST   /api/expenses/bulk        # Bulk operations
```

### Categories & Budgets
```
GET    /api/categories           # List categories
POST   /api/categories           # Create custom category
PUT    /api/categories/:id       # Update category
DELETE /api/categories/:id       # Delete category
GET    /api/budgets              # Get budget status
POST   /api/budgets              # Set/update budget
PUT    /api/budgets/:id          # Update specific budget
```

### Goals & Savings
```
GET    /api/goals                # List savings goals
POST   /api/goals                # Create new goal
PUT    /api/goals/:id            # Update goal
DELETE /api/goals/:id            # Delete goal
POST   /api/goals/:id/contribute # Add money to goal
```

### Income Tracking
```
GET    /api/income               # List income sources
POST   /api/income               # Add income
PUT    /api/income/:id           # Update income
DELETE /api/income/:id           # Delete income
```

### Recurring Expenses
```
GET    /api/recurring            # List recurring templates
POST   /api/recurring            # Create recurring expense
PUT    /api/recurring/:id        # Update recurring template
DELETE /api/recurring/:id        # Delete recurring template
POST   /api/recurring/:id/process # Manually trigger creation
```

### Expense Splitting
```
POST   /api/split/create         # Create split expense
GET    /api/split/:id            # Get split details
PUT    /api/split/:id/pay        # Mark portion as paid
GET    /api/split/pending        # Get pending splits
POST   /api/split/:id/remind     # Send payment reminder
```

### Analytics & Insights
```
GET    /api/analytics/dashboard  # Dashboard overview
GET    /api/analytics/trends     # Spending trends
GET    /api/analytics/insights   # AI-generated insights
GET    /api/analytics/monthly    # Monthly breakdown
GET    /api/analytics/categories # Category analysis
GET    /api/analytics/export     # Export data (CSV, PDF)
```

### Currency & Utilities
```
GET    /api/currency/rates       # Get exchange rates
POST   /api/currency/convert     # Convert between currencies
GET    /api/utils/suggestions    # Category suggestions
```

---

## Middleware Stack

### Authentication Middleware
```javascript
// Verify JWT token and attach user to request
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Access denied' })
  
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET)
    req.user = verified
    next()
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' })
  }
}
```

### Premium Feature Middleware
```javascript
// Check if user has premium subscription
const requirePremium = (req, res, next) => {
  if (req.user.subscription?.tier !== 'premium') {
    return res.status(403).json({ 
      error: 'Premium subscription required',
      upgrade: true 
    })
  }
  next()
}
```

### Rate Limiting Middleware
```javascript
// Prevent API abuse
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
})
```

---

## Key Features Implementation

### Recurring Expense Detection
```javascript
// utils/recurring.js
export const detectRecurringPattern = async (userId, newExpense) => {
  const similarExpenses = await Expense.find({
    userId,
    description: { $regex: new RegExp(newExpense.description, 'i') },
    amount: { $gte: newExpense.amount - 5, $lte: newExpense.amount + 5 }
  }).sort({ date: -1 }).limit(10)

  if (similarExpenses.length >= 3) {
    const intervals = calculateIntervals(similarExpenses)
    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length
    
    if (avgInterval >= 25 && avgInterval <= 35) { // ~monthly
      return {
        isRecurring: true,
        frequency: 'monthly',
        confidence: calculateConfidence(intervals)
      }
    }
  }
  
  return { isRecurring: false }
}
```

### Currency Conversion
```javascript
// utils/currency.js
import axios from 'axios'

let exchangeRates = {}
let lastUpdated = null

export const getExchangeRates = async (baseCurrency = 'USD') => {
  const now = new Date()
  if (!lastUpdated || (now - lastUpdated) > 3600000) { // 1 hour cache
    const response = await axios.get(
      `${process.env.CURRENCY_API_URL}/${baseCurrency}?access_key=${process.env.CURRENCY_API_KEY}`
    )
    exchangeRates = response.data.rates
    lastUpdated = now
  }
  return exchangeRates
}

export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return amount
  
  const rates = await getExchangeRates(fromCurrency)
  return amount * rates[toCurrency]
}
```

### Smart Insights Generation
```javascript
// utils/insights.js
export const generateSpendingInsights = async (userId) => {
  const thisMonth = await getMonthlyExpenses(userId, new Date())
  const lastMonth = await getMonthlyExpenses(userId, getPreviousMonth())
  
  const insights = []
  
  // Spending trend analysis
  const totalChange = ((thisMonth.total - lastMonth.total) / lastMonth.total) * 100
  if (totalChange > 20) {
    insights.push({
      type: 'warning',
      message: `Spending increased ${totalChange.toFixed(1)}% compared to last month`,
      impact: 'high'
    })
  }
  
  // Category analysis
  const categoryChanges = analyzeCategoryChanges(thisMonth, lastMonth)
  categoryChanges.forEach(change => {
    if (change.percentChange > 50) {
      insights.push({
        type: 'info',
        message: `${change.category} spending ${change.percentChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(change.percentChange).toFixed(1)}%`,
        impact: 'medium'
      })
    }
  })
  
  return insights
}
```

### Expense Splitting Logic
```javascript
// controllers/splitController.js
export const createSplitExpense = async (req, res) => {
  const { totalAmount, description, splitWith, splitType } = req.body
  
  let splits = []
  
  if (splitType === 'equal') {
    const amountPerPerson = totalAmount / (splitWith.length + 1) // +1 for current user
    splits = splitWith.map(email => ({ email, amount: amountPerPerson, paid: false }))
  } else if (splitType === 'custom') {
    splits = req.body.customSplits
  }
  
  const splitExpense = new SplitExpense({
    createdBy: req.user.id,
    totalAmount,
    description,
    splits,
    status: 'pending'
  })
  
  await splitExpense.save()
  
  // Send notifications to split participants
  await sendSplitNotifications(splitExpense)
  
  res.json(splitExpense)
}
```

---

## Development Workflow

### Setup & Installation
```bash
# Clone repository
git clone <repo-url>
cd flux-backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Start development server
npm run dev
```

### Database Management
```bash
# Connect to MongoDB (if running locally)
mongosh "mongodb://localhost:27017/flux_dev"

# Or use MongoDB Compass for GUI
```

### Testing
```bash
# Run tests
npm test

# Test specific endpoint
curl -X GET http://localhost:5000/api/health
```

---

## Security Considerations

### Data Protection
- All passwords hashed with bcrypt
- JWT tokens with configurable expiration
- Input validation on all endpoints  
- Rate limiting on auth endpoints
- MongoDB injection prevention (using Mongoose)

### API Security
- CORS configured for frontend domain only
- Helmet.js for security headers
- Request size limits
- Premium feature access control

### User Data Privacy
- User data completely isolated by userId
- Secure password reset flows
- Optional data export for users
- Account deletion with data cleanup

---

## Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Setup
1. **Database:** MongoDB Atlas cluster
2. **File Storage:** AWS S3 bucket
3. **OCR Service:** Google Cloud Platform project
4. **Payment Processing:** Stripe account
5. **Hosting:** Railway, Render, or AWS

### Deployment Checklist
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Currency API credentials set up
- [ ] Stripe webhooks configured (for premium subscriptions)
- [ ] CORS origins updated for production domain
- [ ] Email service configured (for expense splitting)
- [ ] Rate limiting configured appropriately

---

## Monitoring & Maintenance

### Logging
- Request/response logging
- Error tracking and monitoring
- User activity logs (expense creation, goal updates)
- Performance monitoring

### Backup Strategy
- Automated database backups
- User data export capabilities
- Configuration backup

### Performance Optimization
- Database indexing on frequently queried fields
- Query optimization for expense filtering
- Caching for currency exchange rates
- Response compression