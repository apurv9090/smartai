# SmartAI Backend

A robust Node.js/Express backend for the SmartAI chat application with AI integration.

## Features

- 🔐 **Authentication**: JWT-based user authentication with secure password hashing
- 💬 **Chat Management**: Create and manage chat conversations
- 🤖 **AI Integration**: Google Gemini AI for intelligent responses
- 🛡️ **Security**: Helmet, CORS, rate limiting, and input validation
- 📊 **Database**: MongoDB with Mongoose ODM
- 🔧 **Error Handling**: Comprehensive error handling and logging

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **AI Service**: Google Gemini AI (gemini-1.5-flash)
- **Security**: Helmet, CORS, express-rate-limit
- **Validation**: express-validator

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile

### Chat
- `POST /api/chat` - Create new chat
- `GET /api/chat` - Get user's chats (paginated)
- `GET /api/chat/:chatId` - Get chat with messages
- `POST /api/chat/:chatId/message` - Send message to chat

### AI
- `GET /api/ai/status` - Get AI service status

### Health
- `GET /health` - Server health check

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Google Gemini API key

### Installation

1. **Clone and navigate to backend directory:**
   ```bash
   cd backend_new
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Copy `.env` file and update the values:
   ```bash
   cp .env .env.local
   ```

   Update the following variables in `.env`:
   ```env
   PORT=8501
   MONGODB_URI=mongodb://localhost:27017/smartai
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   GEMINI_API_KEY=your-gemini-api-key-here
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start MongoDB:**
   Make sure MongoDB is running on your system.

5. **Start the server:**
   ```bash
   # Development mode (with auto-restart)
   npm run dev

   # Production mode
   npm start
   ```

The server will start on `http://localhost:8501`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8501` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/smartai` |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_EXPIRE` | JWT expiration time | `7d` |
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `FRONTEND_URL` | Frontend application URL | `http://localhost:5173` |

## Database Models

### User
- `name`: String (required, 2-50 chars)
- `email`: String (required, unique, email format)
- `password`: String (required, hashed, min 6 chars)
- `isActive`: Boolean (default: true)
- `createdAt`: Date
- `updatedAt`: Date

### Chat
- `userId`: ObjectId (ref: User)
- `title`: String (required, 1-200 chars)
- `messageCount`: Number (default: 0)
- `lastMessageAt`: Date
- `isActive`: Boolean (default: true)
- `createdAt`: Date
- `updatedAt`: Date

### Message
- `chatId`: ObjectId (ref: Chat)
- `userId`: ObjectId (ref: User)
- `role`: String (enum: user, assistant, system)
- `content`: String (required)
- `tokens`: Number (default: 0)
- `isEdited`: Boolean (default: false)
- `createdAt`: Date
- `updatedAt`: Date

## Security Features

- **Password Hashing**: bcrypt with salt rounds of 12
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Comprehensive validation using express-validator
- **CORS**: Configured for frontend origin
- **Helmet**: Security headers
- **Error Handling**: Prevents information leakage

## Error Handling

The API returns consistent error responses:
```json
{
  "success": false,
  "error": "Error message description"
}
```

Success responses:
```json
{
  "success": true,
  "data": { ... }
}
```

## Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (when implemented)

### Project Structure
```
backend_new/
├── models/           # Database models
│   ├── User.js
│   ├── Chat.js
│   └── Message.js
├── routes/           # API routes
│   ├── authRoutes.js
│   ├── chatRoutes.js
│   └── aiRoutes.js
├── services/         # Business logic services
│   └── aiService.js
├── middleware/       # Express middleware
│   └── auth.js
├── server.js         # Main server file
├── package.json      # Dependencies and scripts
├── .env              # Environment variables
└── README.md         # This file
```

## API Testing

You can test the API endpoints using tools like:
- Postman
- Insomnia
- curl commands

Example curl for health check:
```bash
curl http://localhost:8501/health
```

## Deployment

For production deployment:
1. Set `NODE_ENV=production`
2. Use a production MongoDB instance
3. Set strong `JWT_SECRET`
4. Configure proper CORS origins
5. Use a process manager like PM2
6. Set up SSL/TLS certificates

## Contributing

1. Follow the existing code style
2. Add proper error handling
3. Write clear commit messages
4. Test your changes thoroughly
5. Update documentation as needed

## License

This project is licensed under the ISC License.
