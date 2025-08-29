const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastActivity: {
    type: Date
  },
  sessionToken: {
    type: String
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash password if it's been modified (or new)
  if (!this.isModified('password')) return next();
  
  // Hash password with salt of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to check if user is currently online (active within last 5 minutes)
userSchema.methods.isCurrentlyOnline = function() {
  if (!this.lastActivity) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastActivity > fiveMinutesAgo;
};

// Instance method to update activity
userSchema.methods.updateActivity = async function() {
  this.lastActivity = new Date();
  this.isOnline = true;
  await this.save();
};

// Static method to create admin user
userSchema.statics.createAdminUser = async function() {
  const adminExists = await this.findOne({ role: 'admin' });
  
  if (!adminExists) {
    await this.create({
      name: 'Admin User',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin'
    });
    console.log('✅ Admin user created');
  }
};

module.exports = mongoose.model('User', userSchema);
