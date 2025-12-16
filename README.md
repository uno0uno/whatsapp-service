# WhatsApp Service API

REST API service for sending WhatsApp messages with JWT authentication, PostgreSQL, and Docker support.

## Features

- ✅ JWT authentication with PostgreSQL database
- ✅ User system with roles (admin/user)
- ✅ New user registration
- ✅ Individual message sending
- ✅ Bulk message sending
- ✅ Message audit logging
- ✅ Containerized with Docker
- ✅ QR Code for WhatsApp authentication
- ✅ WhatsApp session management

## Requirements

- Node.js 18+ (for local development)
- PostgreSQL 12+
- Docker and Docker Compose (optional)

## Installation

### 1. Clone or access the directory:
```bash
cd whatsapp-service
```

### 2. Install dependencies:
```bash
npm install
```

### 3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your_super_secure_secret

# Database
DB_HOST=64.23.134.78
DB_PORT=5432
DB_USER=saifer
DB_PASSWORD=96&Gd'2H+zjR
DB_NAME=whatsapp-service

# Admin User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
ADMIN_EMAIL=admin@whatsapp-service.com
```

### 4. Configure Database

The database **is already created** (`whatsapp-service`) with the following tables:

- **users** - System users
- **refresh_tokens** - JWT refresh tokens
- **whatsapp_sessions** - WhatsApp sessions
- **whatsapp_messages** - Message audit logs

### 5. Create admin user:
```bash
npm run create:admin
```

### 6. Start the server:
```bash
npm run dev
```

## Database Structure

### `users` Table
```sql
- id (SERIAL PRIMARY KEY)
- username (VARCHAR UNIQUE)
- email (VARCHAR UNIQUE)
- password_hash (VARCHAR)
- full_name (VARCHAR)
- is_active (BOOLEAN)
- role (VARCHAR) -- 'admin' or 'user'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_login (TIMESTAMP)
```

### `whatsapp_messages` Table
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER FK)
- phone_number (VARCHAR)
- message (TEXT)
- message_id (VARCHAR)
- status (VARCHAR) -- 'sent', 'delivered', 'failed'
- error_message (TEXT)
- sent_at (TIMESTAMP)
```

## API Usage

### 1. User Registration (Optional)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user1",
    "email": "user1@example.com",
    "password": "password123",
    "fullName": "User One"
  }'
```

### 2. Login (Get JWT Token)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin2024!"
  }'
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@whatsapp-service.com",
    "fullName": "Administrator",
    "role": "admin"
  }
}
```

### 3. Get QR Code for WhatsApp

```bash
curl -X GET http://localhost:3000/api/auth/qr \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

The QR Code comes in base64 format. You can display it in a browser or convert it to an image.

### 4. Check WhatsApp Status

```bash
curl -X GET http://localhost:3000/api/auth/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. Send Individual Message

```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "573001234567",
    "message": "Hello, this is a test message"
  }'
```

**NOTE:** All messages are automatically saved to the database for auditing.

### 6. Send Bulk Messages

```bash
curl -X POST http://localhost:3000/api/whatsapp/send-bulk \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "number": "573001234567",
        "message": "Hello user 1"
      },
      {
        "number": "573009876543",
        "message": "Hello user 2"
      }
    ]
  }'
```

### 7. Logout from WhatsApp

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Available Endpoints

| Method | Endpoint | Authentication | Description |
|--------|----------|----------------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Get JWT token |
| GET | `/api/auth/qr` | Yes | Get WhatsApp QR code |
| GET | `/api/auth/status` | Yes | WhatsApp status |
| POST | `/api/auth/logout` | Yes | Logout from WhatsApp |
| POST | `/api/whatsapp/send` | Yes | Send individual message |
| POST | `/api/whatsapp/send-bulk` | Yes | Send bulk messages |
| GET | `/api/health` | No | Service health check |

## Authentication System

### Complete Flow

1. **Register/Login** → Get JWT token
2. **Token in Header** → `Authorization: Bearer TOKEN`
3. **Token includes:**
   - User ID
   - Username
   - Role (admin/user)
4. **Expiration:** Configurable in `.env` (default: 24h)

### User Roles

- **admin**: Full access
- **user**: Regular user (can send messages)

## Phone Number Format

Phone numbers must include the country code without the + symbol. Examples:

- Colombia: `573001234567`
- Mexico: `525512345678`
- Spain: `34612345678`

## Complete Workflow

1. **Install dependencies:** `npm install`
2. **Create .env file** with credentials
3. **Create admin user:** `npm run create:admin`
4. **Start service:** `npm run dev`
5. **Login** to get JWT token
6. **Get QR Code** with the token
7. **Scan QR** with WhatsApp on your phone
8. **Check status** until `isReady` is `true`
9. **Send messages** using the token

## Default Credentials

Admin user created:
- **Username:** `admin`
- **Password:** `Admin2024!`
- **Email:** `admin@whatsapp-service.com`

⚠️ **IMPORTANT:** Change these credentials in production.

## Available Scripts

```bash
npm run dev              # Start in development mode
npm run start            # Start in production
npm run create:admin     # Create admin user
npm run docker:build     # Build Docker image
npm run docker:run       # Run with Docker Compose
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Runtime environment | `development` |
| `JWT_SECRET` | Secret for JWT | (required) |
| `JWT_EXPIRES_IN` | Token expiration time | `24h` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | PostgreSQL user | (required) |
| `DB_PASSWORD` | PostgreSQL password | (required) |
| `DB_NAME` | Database name | `whatsapp-service` |
| `ADMIN_USERNAME` | Admin username | `admin` |
| `ADMIN_PASSWORD` | Admin password | (required) |
| `WHATSAPP_SESSION_PATH` | WhatsApp session path | `./whatsapp-session` |

## Message Auditing

All sent messages are automatically saved to the `whatsapp_messages` table with:
- Sending user
- Recipient number
- Message content
- WhatsApp message ID
- Status (sent/failed)
- Timestamp

## Security

- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ JWT for stateless authentication
- ✅ User roles
- ✅ Active user validation
- ✅ Protected endpoints
- ✅ Action auditing

## Troubleshooting

### PostgreSQL connection error
- Verify credentials in `.env`
- Verify that PostgreSQL is running
- Verify that the `whatsapp-service` database exists

### QR code doesn't appear
- Wait a few seconds and call the endpoint again
- Check server logs

### Error "WhatsApp client is not ready"
- You must first scan the QR code
- Check status with `/api/auth/status`

### Authentication error
- Verify that the JWT token is valid
- Verify the header: `Authorization: Bearer TOKEN`
- Token expires according to `JWT_EXPIRES_IN`

## Docker

To run with Docker:

```bash
docker-compose up -d
```

The container includes:
- Node.js service
- Persistent volume for WhatsApp session
- Health checks

## Development

Project structure:
```
whatsapp-service/
├── database/
│   └── schema.sql
├── scripts/
│   └── createAdmin.js
├── src/
│   ├── config/
│   │   ├── env.js
│   │   └── database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── whatsappController.js
│   ├── middlewares/
│   │   └── auth.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── auth.routes.js
│   │   └── whatsapp.routes.js
│   ├── services/
│   │   ├── whatsappService.js
│   │   ├── userService.js
│   │   └── messageService.js
│   └── index.js
├── .env
├── .env.example
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## License

MIT
