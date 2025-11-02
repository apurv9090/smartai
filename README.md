# SmartAI - AI Chat Application

A modern AI chat application built with React, TypeScript, and Python FastAPI.

## Features

- 🤖 AI-powered chat interface with Google Gemini AI
- 🔐 User authentication
- 🌙 Dark/Light theme toggle
- 📱 Responsive design
- 💬 Real-time messaging
- 📝 Markdown support
- ⚡ FastAPI backend with Gemini AI integration

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Python FastAPI, Google Gemini AI
- **AI**: Google Gemini 2.5 Flash
- **Authentication**: JWT tokens
- **Database**: MongoDB

## Quick Start

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install Python dependencies
pip install fastapi uvicorn google-generativeai python-dotenv
```

### 2. Environment Setup

Create `.env` file in the root directory:

```
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
VITE_API_URL=http://localhost:8501
VITE_APP_NAME=SmartAI
VITE_APP_VERSION=1.0.0
VITE_AI_API_URL=http://localhost:8095
```

### 3. Run the Application

```bash
# Start the Gemini AI backend (in one terminal)
python gemini_server.py

# Start the frontend (in another terminal)
npm run dev

# Start the Express backend (in another terminal)
cd backend
node server.js
```

## API Endpoints

### Gemini AI Backend (Port 8095)
- `POST /chat` - Send chat messages to Gemini AI
- `GET /health` - Check AI backend health
- `GET /test` - Test Gemini AI connection
- `GET /` - Root endpoint

### Express Backend (Port 8501)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/chat/message` - Send chat messages
- `GET /api/chat/history` - Get chat history
- `GET /health` - Health check

## Development

### Frontend Development
```bash
npm run dev
```

### Backend Development
```bash
# Gemini AI Server
python gemini_server.py

# Express Server
cd backend
node server.js
```

## License

This project is licensed under the Apache License 2.0.
