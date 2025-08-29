# Admin API Documentation

This document describes the admin API endpoints for EchoMind.

## Authentication

All admin endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Admin Login
**POST** `/api/admin/login`

Login as an admin user.

**Request Body:**
```json
{
  "email": "admin@echomind.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "Admin User",
    "email": "admin@echomind.com",
    "role": "admin"
  }
}
```

### Get Dashboard Statistics
**GET** `/api/admin/dashboard`

Get overview statistics for the admin dashboard.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 10,
    "activeUsers": 8,
    "totalConversations": 156,
    "recentUsers": 3,
    "recentActivity": 12,
    "messageTypes": {
      "text": 89,
      "image": 34,
      "voice": 23
    }
  }
}
```

### Get All Users
**GET** `/api/admin/users`

Get a paginated list of all users with optional search and filtering.

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10): Number of users per page
- `search` (string): Search by name or email
- `status` (string): Filter by status ('active' or 'inactive')

**Response:**
```json
{
  "success": true,
  "count": 10,
  "total": 25,
  "currentPage": 1,
  "totalPages": 3,
  "users": [
    {
      "_id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "role": "user",
      "isActive": true,
      "createdAt": "2025-08-29T10:00:00.000Z",
      "updatedAt": "2025-08-29T10:00:00.000Z"
    }
  ]
}
```

### Get User by ID
**GET** `/api/admin/users/:id`

Get detailed information about a specific user.

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-08-29T10:00:00.000Z",
    "updatedAt": "2025-08-29T10:00:00.000Z",
    "conversationCount": 5
  }
}
```

### Add New User
**POST** `/api/admin/users`

Create a new user account.

**Request Body:**
```json
{
  "name": "New User",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "user"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "new_user_id",
    "name": "New User",
    "email": "newuser@example.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-08-29T10:00:00.000Z"
  }
}
```

### Delete User
**DELETE** `/api/admin/users/:id`

Delete a user and all associated data (conversations, messages).

**Response:**
```json
{
  "success": true,
  "message": "User and all associated data deleted successfully"
}
```

### Toggle User Status
**PUT** `/api/admin/users/:id/toggle-status`

Activate or deactivate a user account.

**Response:**
```json
{
  "success": true,
  "message": "User activated successfully",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "isActive": true
  }
}
```

### Get User Conversations
**GET** `/api/admin/users/:id/conversations`

Get a paginated list of conversations for a specific user.

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10): Number of conversations per page

**Response:**
```json
{
  "success": true,
  "count": 5,
  "total": 12,
  "currentPage": 1,
  "totalPages": 2,
  "conversations": [
    {
      "_id": "conversation_id",
      "userId": "user_id",
      "title": "Conversation Title",
      "lastActivity": "2025-08-29T10:00:00.000Z",
      "createdAt": "2025-08-29T09:00:00.000Z"
    }
  ]
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common error status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (not admin user)
- `404`: Not Found (user not found)
- `500`: Internal Server Error

## Security Notes

1. Admin endpoints are protected by JWT authentication
2. Only users with `role: "admin"` can access these endpoints
3. Admin users cannot be deleted or have their status toggled
4. User deletion is cascading (removes all associated conversations and messages)
5. Password validation requires minimum 6 characters
6. Email validation ensures proper format and uniqueness
