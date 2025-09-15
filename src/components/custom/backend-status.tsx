import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, XCircle, ServerCrash } from 'lucide-react';
import { api } from '@/lib/api';
import { aiApi } from '@/lib/aiApi';

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';
type AIStatus = 'checking' | 'connected' | 'error';

export function BackendStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [aiStatus, setAiStatus] = useState<AIStatus>('checking');
  const [message, setMessage] = useState<string>('Checking backend connection...');
  const [modelInfo, setModelInfo] = useState<{name: string, type: string} | null>(null);

  // Check main backend connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await api.checkServerStatus();
        
        if (response.success) {
          setStatus('connected');
          setMessage('Backend server is running');
        } else {
          setStatus('disconnected');
          setMessage(response.error || 'Could not connect to backend server');
        }
      } catch (_error) {
        setStatus('disconnected');
        setMessage('Could not connect to backend server');
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const intervalId = setInterval(checkConnection, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Check AI backend connection
  useEffect(() => {
    const checkAiConnection = async () => {
      try {
        console.log("Checking AI backend connection...");
        const result = await aiApi.checkStatus();
        console.log("AI status result:", result);
        
        if (result.status === "healthy") {
          if (result.model_loaded) {
            console.log("AI model loaded successfully");
            setAiStatus('connected');
            
            // Set model info for Gemini AI
            if (result.model_info) {
              setModelInfo({
                ...result.model_info
              });
            } else {
              setModelInfo(null);
            }
          } else {
            console.warn("AI backend is healthy but model is not loaded");
            setAiStatus('error');
          }
        } else {
          console.warn("AI backend is not healthy");
          setAiStatus('error');
        }
      } catch (error) {
        console.error('Failed to connect to AI backend:', error);
        setAiStatus('error');
      }
    };

    checkAiConnection();
    
    // Check AI connection every 30 seconds
    const intervalId = setInterval(checkAiConnection, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Render the AI status badge
  const getAiStatusBadge = () => {
    switch (aiStatus) {
      case 'checking':
        return (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <ServerCrash className="h-3.5 w-3.5" />
            <span>Checking AI...</span>
          </div>
        );
      case 'connected': {
        const modelTitle = modelInfo
          ? `Google Gemini AI Model: ${modelInfo.name} (${modelInfo.type})`
          : 'Gemini AI Model Connected';

        return (
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"
               title={modelTitle}>
            <ServerCrash className="h-3.5 w-3.5" />
            <span>
              {modelInfo ? 'Gemini AI' : 'Gemini AI Ready'}
              <span className="ml-1 text-xs opacity-70">🔑</span>
            </span>
          </div>
        );
      }
      case 'error':
        return (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <ServerCrash className="h-3.5 w-3.5" />
            <span>Gemini AI Unavailable</span>
            <span className="ml-1 text-xs opacity-70">Fallback Mode</span>
          </div>
        );
    }
  };

  if (status === 'connected') {
    return (
      <div className="flex flex-col gap-1 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1.5 rounded-md">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          <span>{message}</span>
        </div>
        {getAiStatusBadge()}
      </div>
    );
  }
  
  if (status === 'disconnected') {
    return (
      <div className="flex flex-col gap-1 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 rounded-md">
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4" />
          <span>{message}</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 underline text-xs"
          >
            Retry
          </button>
        </div>
        {getAiStatusBadge()}
      </div>
    );
  }
  
  return (
    <div className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5 rounded-md">
      <div className="flex items-center gap-1.5">
        <AlertCircle className="h-4 w-4" />
        <span>Checking connection...</span>
      </div>
      {getAiStatusBadge()}
    </div>
  );
}
