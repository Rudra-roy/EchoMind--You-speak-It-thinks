# EchoMind Admin Web Dashboard

A simple, clean web interface for EchoMind administration.

## Features

- 🔐 **Secure Admin Login**: JWT-based authentication
- 📊 **Dashboard Overview**: Real-time statistics and metrics
- 👥 **User Management**: Add, delete, activate/deactivate users
- 🔍 **Search & Filter**: Find users by name, email, or status
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile

## Quick Start

### Option 1: Simple HTTP Server

```bash
cd admin-web
npm install
npm start
```

This will start the server on http://localhost:3000

### Option 2: Python HTTP Server (No Dependencies)

```bash
cd admin-web
python3 -m http.server 3000
```

### Option 3: Live Server (Auto-reload)

```bash
cd admin-web
npm install
npm run dev
```

## Default Admin Credentials

- **Email**: admin@echomind.com
- **Password**: admin123

## API Configuration

The dashboard connects to the EchoMind API server running on `http://localhost:8000`

Make sure your EchoMind server is running before accessing the admin dashboard.

## Server Requirements

- EchoMind API server running on port 8000
- Admin endpoints enabled (`/api/admin/*`)
- CORS configured to allow requests from the admin dashboard

## Usage

1. Start your EchoMind server
2. Start the admin web dashboard
3. Navigate to http://localhost:3000
4. Login with admin credentials
5. Manage users and view statistics

## Features Overview

### Dashboard Statistics
- Total registered users
- Active users count
- Total conversations
- New users in the last 30 days

### User Management
- View all users in a clean table format
- Search users by name or email
- Filter by status (All/Active/Inactive)
- Add new users with role selection
- Delete users (with confirmation)
- Activate/deactivate user accounts
- Admin users are protected from deletion

### Security
- JWT token authentication
- Admin-only access
- Protected API endpoints
- Secure credential handling

## Browser Compatibility

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Troubleshooting

**Can't connect to API**: Make sure the EchoMind server is running on port 8000

**CORS errors**: Ensure the server has CORS enabled for the admin dashboard URL

**Login fails**: Verify admin credentials and server connection

**Styles not loading**: Check that all files are in the same directory
