from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import time
import json
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from multiple likely locations (without changing any keys)
env_paths = [
    Path(__file__).parent / '.env',
    Path(__file__).parent / 'backend_new' / '.env',
    Path(__file__).parent / 'backend' / '.env',
]
for p in env_paths:
    try:
        if p.exists():
            load_dotenv(p)
    except Exception:
        # Best-effort load; continue if any file fails
        pass

app = FastAPI()

# Allow calls from your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # Cache preflight requests for 24 hours
)

# Initialize Gemini API with your API key (support both env var names)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
MODEL_NAME = "gemini-2.5-flash"  # Latest Gemini model

# Configure the generative AI library
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print(f"✅ Gemini API initialized with API key")
    print(f"Using model: {MODEL_NAME}")
else:
    print("❌ No GEMINI_API_KEY found in environment variables")

# Model configuration
generation_config = {
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 0,
    "max_output_tokens": 1024,
}

# Safety settings
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

@app.post("/chat")
async def chat_endpoint(request: Request):
    """Process chat requests and get responses from Gemini"""
    try:
        start_time = time.time()
        data = await request.json()
        user_input = data.get("message", "")
        
        if not user_input.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        
        print(f"Processing chat request: '{user_input[:50]}...' (if longer)")
        
        try:
            # Initialize the model
            model = genai.GenerativeModel(
                model_name=MODEL_NAME,
                generation_config=generation_config,
                safety_settings=safety_settings
            )
            
            # Generate content
            response = model.generate_content(user_input)
            
            if not response.candidates:
                raise HTTPException(status_code=500, detail="No response generated from Gemini")
            
            # Check if response has parts and text content
            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                text_response = response.candidates[0].content.parts[0].text
            else:
                # Handle case where response doesn't have valid text parts
                # This often happens when safety filters are triggered
                finish_reason = response.candidates[0].finish_reason if response.candidates else "UNKNOWN"
                print(f"No valid response text, finish reason: {finish_reason}")
                text_response = "I'm unable to provide a response to that request due to content safety policies."
                
            print(f"Generated response in {time.time() - start_time:.2f} seconds")
            
            # Check if this was a safety filtered response
            is_filtered = False
            if response.candidates and hasattr(response.candidates[0], 'finish_reason'):
                if response.candidates[0].finish_reason == 2:  # Safety filter triggered
                    is_filtered = True
            
            return {
                "response": text_response,
                "model": MODEL_NAME,
                "filtered": is_filtered
            }
            
        except Exception as model_error:
            print(f"Error during Gemini model inference: {model_error}")
            # Return a proper response instead of throwing an error
            return {
                "response": "I'm sorry, but I encountered an issue processing your request. This may be due to content safety policies or technical limitations.",
                "model": MODEL_NAME,
                "error": str(model_error)
            }
        
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        # Return a graceful error response instead of throwing a 500
        return {
            "response": "I apologize, but I'm having technical difficulties processing your request. Please try again with a different query.",
            "model": MODEL_NAME,
            "error": str(e)
        }

@app.get("/health")
async def health_check():
    """Health check endpoint that provides model status"""
    model_loaded = bool(GEMINI_API_KEY)
    model_info = {
        "name": MODEL_NAME,
        "type": "text"
    } if model_loaded else None
    
    return {
        "status": "healthy", 
        "model_loaded": model_loaded,
        "model_info": model_info
    }

@app.get("/test")
async def test_endpoint():
    """Test the Gemini connection with a simple prompt"""
    if not GEMINI_API_KEY:
        return {
            "success": False,
            "error": "Gemini API key not configured"
        }
    
    try:
        # Initialize the model
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        
        # Test with a simple prompt
        response = model.generate_content("Hello, are you working properly?")
        
        # Safely extract text
        text_response = ""
        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            text_response = response.candidates[0].content.parts[0].text
        else:
            text_response = "I'm functioning correctly, but this test response was filtered."
        
        return {
            "success": True,
            "model": MODEL_NAME,
            "response": text_response
        }
    except Exception as e:
        print(f"Error testing Gemini connection: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/")
async def root():
    """Root endpoint for basic health checks"""
    return {
        "status": "running",
        "provider": "Google Gemini AI",
        "model": MODEL_NAME,
        "endpoints": ["/health", "/chat", "/test"]
    }

if __name__ == "__main__":
    # Try to use port 8095, but fall back to alternative ports if busy
    port = 8095
    max_retries = 5
    
    for attempt in range(max_retries):
        try:
            print(f"Starting Gemini AI Server on port {port}...")
            uvicorn.run(app, host="0.0.0.0", port=port)
            break
        except OSError as e:
            if "address already in use" in str(e).lower() and attempt < max_retries - 1:
                port += 1
                print(f"Port {port-1} is busy, trying port {port}...")
            else:
                print(f"Failed to start server after {attempt+1} attempts: {e}")
                raise
