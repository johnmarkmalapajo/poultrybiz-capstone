const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const connectDB = require('./config/db')

dotenv.config()
connectDB()

const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
]

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

app.use(express.json())

const VERSION = process.env.API_VERSION || 'v1'
const BASE    = `/api/${VERSION}`

app.use(`${BASE}/auth`, require('./routes/auth'))

app.get('/', (req, res) => {
  res.json({
    message: 'PoultyBiz API is running!',
    version: VERSION,
    baseUrl: `/api/${BASE}`,
  })
})

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`API Base URL: http://localhost:${PORT}${BASE}`)
})