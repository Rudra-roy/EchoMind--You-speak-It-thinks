const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const aiRoutes = require('./routes/aiRoutes');
const errorHandler = require('./middleware/errorHandler');

// Import models
const User = require('./models/User');

const app = express();

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Configure CORS to allow admin dashboard
app.use(cors({
  origin: [
    'http://localhost:3000', // Admin web dashboard
    'http://127.0.0.1:3000', // Alternative localhost
    'http://192.168.0.111:3000', // Admin dashboard on network IP
    'http://localhost:3001', // Backup port
    'http://127.0.0.1:3001', // Alternative localhost backup
    'http://192.168.0.111:8000', // Mobile client same network
    'http://localhost:8000' // Same origin
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Serve static files (for uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: 'EchoMind API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/prompt-templates', require('./routes/promptTemplateRoutes'));

// Error handler middleware (must be after routes)
app.use(errorHandler);

// Handle 404 routes - Express 5.x compatible
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    
    // Create admin user if it doesn't exist
    await User.createAdminUser();
  })
  .catch((err) => console.error('❌ MongoDB error:', err));

// Start server
const PORT = process.env.PORT || 8000;
const HOST = '0.0.0.0'; // Listen on all network interfaces
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Mobile API: http://192.168.0.111:${PORT}/api/auth`);
  console.log(`⚙️  Admin API: http://localhost:${PORT}/api/admin`);
});
