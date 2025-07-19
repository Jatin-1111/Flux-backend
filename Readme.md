# Flux Backend API

## Overview

RESTful API server for Flux - the B2B financial operations platform. Built with Node.js, Express, and MongoDB to handle multi-tenant business financial data securely and efficiently.

---

## Technology Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT with bcrypt
- **File Storage:** AWS S3
- **OCR Service:** Google Cloud Vision API
- **Payment Processing:** Stripe
- **Deployment:** Railway/Render

---

## Project Structure

```
flux-backend/
├── src/
│   ├── models/
│   │   ├── Tenant.js           # Company/organization data
│   │   ├── User.js             # User accounts & roles
│   │   ├── Expense.js          # Expense records
│   │   ├── Invoice.js          # Invoice data
│   │   ├── Client.js           # Client management
│   │   └── Category.js         # Expense categories
│   ├── routes/
│   │   ├── auth.js             # Authentication endpoints
│   │   ├── expenses.js         # Expense CRUD operations
│   │   ├── invoices.js         # Invoice management
│   │   ├── clients.js          # Client management
│   │   ├── reports.js          # Financial reporting
│   │   └── admin.js            # Admin operations
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── tenant.js           # Multi-tenant isolation
│   │   ├── validation.js       # Request validation
│   │   └── upload.js           # File upload handling
│   ├── controllers/
│   │   ├── authController.js   # Auth business logic
│   │   ├── expenseController.js # Expense operations
│   │   ├── invoiceController.js # Invoice operations
│   │   └── reportController.js # Report generation
│   ├── utils/
│   │   ├── ocr.js              # Google Vision OCR
│   │   ├── s3.js               # AWS S3 operations
│   │   ├── email.js            # Email notifications
│   │   └── pdf.js              # PDF generation
│   └── config/
│       ├── database.js         # MongoDB connection
│       └── constants.js        # App constants
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
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/flux

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# AWS S3 (File Storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=flux-documents

# Google Cloud Vision (OCR)
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project
GOOGLE_CLOUD_VISION_KEY_FILE=path/to/service-account.json

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email Service (Optional)
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@flux.com
```

---

## Database Schema

### Multi-Tenant Architecture
All data is isolated by `tenantId` to ensure complete data separation between companies.

### Core Models

#### Tenant Model
```javascript
{
  _id: ObjectId,
  companyName: String,
  domain: String (unique),
  subscription: {
    tier: ['business', 'enterprise'],
    status: ['active', 'cancelled', 'past_due'],
    stripeCustomerId: String,
    stripeSubscriptionId: String
  },
  settings: {
    currency: String,
    timezone: String,
    expenseApprovalRequired: Boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### User Model
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId (ref: Tenant),
  email: String (unique),
  password: String (hashed),
  role: ['admin', 'manager', 'employee'],
  profile: {
    firstName: String,
    lastName: String,
    department: String
  },
  isActive: Boolean,
  lastLogin: Date,
  createdAt: Date
}
```

#### Expense Model
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId (ref: Tenant),
  userId: ObjectId (ref: User),
  amount: Number,
  currency: String,
  category: String,
  description: String,
  receiptUrl: String,
  status: ['pending', 'approved', 'rejected', 'reimbursed'],
  approvedBy: ObjectId (ref: User),
  approvalDate: Date,
  expenseDate: Date,
  createdAt: Date
}
```

#### Invoice Model
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId (ref: Tenant),
  clientId: ObjectId (ref: Client),
  invoiceNumber: String,
  lineItems: [{
    description: String,
    quantity: Number,
    rate: Number,
    amount: Number
  }],
  subtotal: Number,
  tax: Number,
  total: Number,
  status: ['draft', 'sent', 'paid', 'overdue'],
  dueDate: Date,
  paidDate: Date,
  createdAt: Date
}
```

---

## API Endpoints

### Authentication
```
POST   /api/auth/register        # Company signup
POST   /api/auth/login           # User login
POST   /api/auth/refresh         # Refresh JWT token
POST   /api/auth/forgot-password # Password reset
POST   /api/auth/invite-user     # Invite team member
```

### Expenses
```
GET    /api/expenses             # List expenses (with filters)
POST   /api/expenses             # Create new expense
GET    /api/expenses/:id         # Get expense details
PUT    /api/expenses/:id         # Update expense
DELETE /api/expenses/:id         # Delete expense
POST   /api/expenses/:id/approve # Approve expense
POST   /api/expenses/upload      # Upload receipt with OCR
```

### Invoices
```
GET    /api/invoices             # List invoices
POST   /api/invoices             # Create invoice
GET    /api/invoices/:id         # Get invoice
PUT    /api/invoices/:id         # Update invoice
DELETE /api/invoices/:id         # Delete invoice
POST   /api/invoices/:id/send    # Email invoice to client
GET    /api/invoices/:id/pdf     # Generate PDF
```

### Clients
```
GET    /api/clients              # List clients
POST   /api/clients              # Create client
GET    /api/clients/:id          # Get client
PUT    /api/clients/:id          # Update client
DELETE /api/clients/:id          # Delete client
```

### Reports
```
GET    /api/reports/dashboard    # Dashboard metrics
GET    /api/reports/expenses     # Expense reports
GET    /api/reports/revenue      # Revenue reports
GET    /api/reports/cashflow     # Cash flow analysis
```

### Admin
```
GET    /api/admin/users          # Manage team members
POST   /api/admin/users/invite   # Invite new user
PUT    /api/admin/users/:id      # Update user role
GET    /api/admin/settings       # Company settings
PUT    /api/admin/settings       # Update settings
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

### Tenant Isolation Middleware
```javascript
// Ensure all queries are scoped to user's tenant
const tenantScope = (req, res, next) => {
  req.tenantId = req.user.tenantId
  next()
}
```

### Role-Based Access Control
```javascript
const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }
  next()
}
```

---

## Key Features Implementation

### Receipt OCR Processing
```javascript
// utils/ocr.js
import vision from '@google-cloud/vision'

const client = new vision.ImageAnnotatorClient()

export const extractReceiptData = async (imageBuffer) => {
  const [result] = await client.textDetection({
    image: { content: imageBuffer }
  })
  
  const text = result.fullTextAnnotation?.text || ''
  
  return {
    amount: extractAmount(text),
    date: extractDate(text),
    vendor: extractVendor(text),
    rawText: text
  }
}
```

### Multi-Tenant Data Queries
```javascript
// All database queries automatically scoped to tenant
const getExpenses = async (req, res) => {
  const expenses = await Expense.find({ 
    tenantId: req.tenantId,
    userId: req.query.userId || undefined
  })
  res.json(expenses)
}
```

### File Upload to S3
```javascript
// utils/s3.js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({ region: process.env.AWS_REGION })

export const uploadFile = async (file, folder) => {
  const key = `${folder}/${Date.now()}-${file.originalname}`
  
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  }))
  
  return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`
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
- JWT tokens with short expiration
- Tenant data completely isolated
- Input validation on all endpoints
- Rate limiting on auth endpoints

### File Security
- Secure S3 bucket configuration
- File type validation
- Size limits on uploads
- Signed URLs for private files

### API Security
- CORS configured for frontend domain only
- Helmet.js for security headers
- Request size limits
- SQL injection prevention (using Mongoose)

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
- [ ] S3 bucket permissions set
- [ ] Google Cloud credentials uploaded
- [ ] Stripe webhooks configured
- [ ] CORS origins updated for production domain

---

## Monitoring & Maintenance

### Logging
- Request/response logging
- Error tracking
- Performance monitoring
- User activity logs

### Backup Strategy
- Automated database backups
- S3 file redundancy
- Configuration backup

### Performance Optimization
- Database indexing
- Query optimization
- Caching strategies
- Image compression