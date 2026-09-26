import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Activity, AlertCircle, X } from "lucide-react";

// Helper to check if string contains wake word
const containsWakeWord = (text) => {
  if (!text) return false;
  const normalized = text.toLowerCase().trim().replace(/[.,!?;:]/g, '');
  return normalized.includes("hello vritan") || 
         normalized.includes("hello vritaan") || 
         normalized.includes("hey vritan") || 
         normalized.includes("hey vritaan");
};

const VoiceAssistant = ({ standalone = true, onClose, isOpen, onOpen }) => {
  const [state, setState] = useState("WAKE_LISTENING"); // WAKE_LISTENING, LISTENING, THINKING, SPEAKING, ERROR, PERMISSION_REQUIRED, IDLE
  const [messages, setMessages] = useState([]); // { id, role: "user" | "assistant", text, timestamp, source }
  const [errorMsg, setErrorMsg] = useState("");
  const [patientName, setPatientName] = useState("");
  const [authError, setAuthError] = useState(false);
  
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const messagesEndRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, state]);

  // Handle Authentication and Profile Fetch
  useEffect(() => {
    const token = localStorage.getItem("medilocker_token");
    if (!token) {
      setAuthError(true);
      return;
    }

    const fetchProfile = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/patient/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPatientName(data.full_name || data.first_name || "Patient");
        } else {
          setAuthError(true);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, []);

  const addMessage = (role, text) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random().toString(),
      role,
      text,
      timestamp: new Date().toISOString(),
      source: "voice"
    }]);
  };

  const startRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
         // Already started
      }
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  // Connect WebSocket
  useEffect(() => {
    if (authError) return;
    
    const connect = () => {
      try {
        const token = localStorage.getItem("medilocker_token");
        if (!token) return;
        
        const wsUrl = import.meta.env.VITE_API_URL 
          ? import.meta.env.VITE_API_URL.replace("http", "ws") + `/voice/ws?token=${token}`
          : `ws://localhost:8000/voice/ws?token=${token}`;
          
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === "ERROR") {
            setState("ERROR");
            setErrorMsg(data.error || "An error occurred.");
            setTimeout(() => {
                setState("WAKE_LISTENING");
                setErrorMsg("");
                startRecognition();
            }, 3000);
          } else if (data.type === "SPEAKING") {
            let responseText = data.text;
            if (data.text === "AI_QUOTA_EXCEEDED") {
              responseText = "I'm temporarily unable to process AI requests because the AI service quota has been reached.";
            } else if (data.text === "AI_PARSE_ERROR") {
              responseText = "I'm sorry, I couldn't understand the AI response. Please try again.";
            } else if (data.text === "AI_PROVIDER_UNAVAILABLE") {
              responseText = "I'm sorry, the AI service is currently unavailable. Please try again later.";
            }
            
            // Add message FIRST so it renders immediately
            addMessage("assistant", responseText);
            
            // Then speak
            speak(responseText);
          }
        };
        
        wsRef.current.onclose = () => {
          // Attempt to reconnect if needed, but for now do nothing to avoid loop
        };
        
      } catch (err) {
        console.error(err);
      }
    };
    
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [authError]);

  const speak = (text) => {
    const synth = synthRef.current;
    if (!synth) {
       setState("WAKE_LISTENING");
       startRecognition();
       return;
    }

    if (synth.speaking) {
      synth.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select an available English female voice if possible
    const availableVoices = synth.getVoices();
    const femaleEnglishVoices = availableVoices.filter(v => 
        v.lang.startsWith("en-") && 
        (v.name.toLowerCase().includes("female") || 
         v.name.toLowerCase().includes("zira") || 
         v.name.toLowerCase().includes("samantha") ||
         v.name.toLowerCase().includes("google us english") || 
         v.name.toLowerCase().includes("victoria"))
    );
    const englishVoices = availableVoices.filter(v => v.lang.startsWith("en-"));
    
    if (femaleEnglishVoices.length > 0) {
      utterance.voice = femaleEnglishVoices[0];
    } else if (englishVoices.length > 0) {
      utterance.voice = englishVoices[0];
    }
    
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;
    
    utterance.onstart = () => {
       setState("SPEAKING");
    };

    utterance.onerror = (e) => {
       setState("WAKE_LISTENING");
       startRecognition();
    };

    utterance.onend = () => {
       setState("WAKE_LISTENING");
       startRecognition();
    };
    
    synth.speak(utterance);
  };

  const initRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setState("ERROR");
      setErrorMsg("Your browser does not support Voice Recognition.");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // Use interim results for faster wake-word detection
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const fullTranscript = (finalTranscript || interimTranscript).trim();

      if (!fullTranscript) return;

      setState(currentState => {
        if (currentState === "WAKE_LISTENING") {
          if (containsWakeWord(fullTranscript)) {
            // Wake word detected!
            if (onOpen) onOpen();
            
            // Abort current recognition to clear interim results, and restart in LISTENING mode
            recognition.abort();
            
            setTimeout(() => {
                setState("LISTENING");
                startRecognition();
            }, 200);
            
            return "LISTENING";
          }
          return currentState;
        } 
        
        if (currentState === "LISTENING") {
          if (finalTranscript) {
             addMessage("user", finalTranscript);
             if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ text: finalTranscript }));
                return "THINKING";
             } else {
                setErrorMsg("Backend connection not ready.");
                return "ERROR";
             }
          }
          return currentState;
        }

        // If speaking and user starts talking (barge-in)
        if (currentState === "SPEAKING") {
             if (synthRef.current && synthRef.current.speaking) {
                synthRef.current.cancel(); // Stop TTS
             }
             if (finalTranscript) {
                 addMessage("user", finalTranscript);
                 if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ text: finalTranscript }));
                    return "THINKING";
                 }
             }
             return "LISTENING";
        }

        return currentState;
      });
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      if (event.error === "not-allowed") {
        setState("PERMISSION_REQUIRED");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
         // Silently restart for other errors if we want continuous listening
         setTimeout(startRecognition, 1000);
      }
    };

    recognition.onend = () => {
      // Automatic restart if we are still supposed to be listening
      setState(currentState => {
          if (currentState === "WAKE_LISTENING" || currentState === "LISTENING") {
             setTimeout(startRecognition, 100);
          }
          return currentState;
      });
    };

    return recognition;
  };

  // Setup initial recognition
  useEffect(() => {
      recognitionRef.current = initRecognition();
      startRecognition();
      
      return () => {
          stopRecognition();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMicClick = () => {
     if (state === "PERMISSION_REQUIRED") {
        // Prompt for permission again
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
            setState("WAKE_LISTENING");
            startRecognition();
        }).catch(() => {
            setState("PERMISSION_REQUIRED");
        });
        return;
     }

     if (state === "LISTENING" || state === "WAKE_LISTENING") {
         setState("IDLE");
         stopRecognition();
     } else {
         if (synthRef.current && synthRef.current.speaking) {
             synthRef.current.cancel();
         }
         setState("LISTENING");
         startRecognition();
     }
  };

  // Render helpers
  const getStatusDisplay = () => {
      switch (state) {
          case "WAKE_LISTENING": return "Listening for 'Hello Vritan'...";
          case "LISTENING": return "Listening...";
          case "THINKING": return "Thinking...";
          case "SPEAKING": return "Speaking...";
          case "ERROR": return "Error";
          case "PERMISSION_REQUIRED": return "Mic Disabled";
          case "IDLE": return "Paused";
          default: return "";
      }
  };

  const containerClass = standalone 
    ? "flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6" 
    : "flex flex-col h-full w-full bg-white shadow-xl";
    
  const cardClass = standalone
    ? "w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col border border-gray-100"
    : "w-full h-full flex flex-col";

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        
        {/* Header */}
        <div className="bg-indigo-600 p-4 text-white flex flex-col space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className={`w-6 h-6 ${state === 'LISTENING' || state === 'SPEAKING' ? 'animate-pulse' : ''}`} />
              <h2 className="text-xl font-bold">VRITAN Voice</h2>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`text-xs font-medium px-2 py-1 rounded-full uppercase tracking-wider ${
                  state === "ERROR" || state === "PERMISSION_REQUIRED" ? "bg-red-500" :
                  state === "LISTENING" ? "bg-green-500" :
                  state === "IDLE" ? "bg-gray-500" :
                  "bg-indigo-500"
              }`}>
                {getStatusDisplay()}
              </span>
              {!standalone && onClose && (
                <button onClick={onClose} className="p-1 hover:bg-indigo-500 rounded-full transition-colors" aria-label="Close Assistant">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          {patientName && (
            <div>
              <p className="text-lg font-medium">Hello, {patientName} 👋</p>
            </div>
          )}
        </div>

        {/* Conversation Area */}
        <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto min-h-[300px]">
          
          {state === "PERMISSION_REQUIRED" && (
             <div className="bg-orange-50 p-4 rounded-lg flex flex-col space-y-2 border border-orange-200">
               <div className="flex items-start space-x-2 text-orange-800">
                 <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                 <p className="text-sm font-medium">Microphone access is required for the VRITAN voice assistant.</p>
               </div>
               <button onClick={handleMicClick} className="self-start text-sm bg-orange-100 hover:bg-orange-200 text-orange-900 px-3 py-1.5 rounded-md transition-colors">
                  Enable Microphone
               </button>
             </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 p-3 rounded-lg flex items-start space-x-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{errorMsg}</p>
            </div>
          )}

          {messages.length === 0 && state === "WAKE_LISTENING" && (
             <div className="flex-1 flex items-center justify-center">
                 <p className="text-gray-400 text-center text-sm">
                     Say <span className="font-semibold">"Hello Vritan"</span> to start<br/>or tap the microphone.
                 </p>
             </div>
          )}

          {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mx-1">
                      {msg.role === 'user' ? 'You' : 'VRITAN'}
                  </span>
                  <div className={`p-3.5 rounded-2xl max-w-[85%] ${
                      msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-sm shadow-sm' 
                      : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm'
                  }`}>
                      <p className={`text-[15px] leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-gray-700'}`}>
                          {msg.text}
                      </p>
                  </div>
              </div>
          ))}
          
          {(state === "LISTENING" || state === "THINKING") && (
             <div className={`flex space-x-1 items-center py-2 px-1 ${state === "LISTENING" ? "opacity-50" : "opacity-100"}`}>
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
             </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Controls */}
        <div className="bg-white p-6 border-t border-gray-50 flex items-center justify-center shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] flex-shrink-0 relative">
          {!authError && (
              <button 
                onClick={handleMicClick}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  state === "LISTENING" || state === "WAKE_LISTENING"
                    ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
                aria-label="Toggle Microphone"
              >
                {state === "LISTENING" || state === "WAKE_LISTENING" ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
