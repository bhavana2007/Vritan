import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, Activity, AlertCircle, X } from "lucide-react";

const VoiceAssistant = ({ standalone = true, onClose }) => {
  const [state, setState] = useState("IDLE"); // IDLE, LISTENING, THINKING, SPEAKING, ERROR, DISCONNECTED
  const [transcript, setTranscript] = useState("");
  const [agentResponse, setAgentResponse] = useState("Connecting to VRITAN Voice...");
  const [errorMsg, setErrorMsg] = useState("");
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const autoRestartMic = useRef(false);
  const [patientName, setPatientName] = useState("");
  const [authError, setAuthError] = useState(false);
  const [voices, setVoices] = useState([]);
  
  // Use browser SpeechSynthesis and SpeechRecognition for V1
  const synth = window.speechSynthesis;

  useEffect(() => {
    // Handle Chrome's asynchronous voice loading
    const loadVoices = () => {
      if (synth) {
        const availableVoices = synth.getVoices();
        setVoices(availableVoices);
      }
    };
    
    if (synth) {
      loadVoices();
      if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = loadVoices;
      }
    }
    
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const result = event.results[current][0].transcript;
        setTranscript(result);
        
        // Send to backend
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ text: result }));
          setState("THINKING");
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== "no-speech") {
          setState("ERROR");
          setErrorMsg("Speech recognition failed. Please try again.");
          autoRestartMic.current = false;
        }
      };
    } else {
      setState("ERROR");
      setErrorMsg("Your browser does not support Voice Recognition.");
    }

    const token = localStorage.getItem("medilocker_token");
    if (!token) {
      setAuthError(true);
      return;
    }

    // Fetch patient profile
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

    // Connect WebSocket on mount
    connect();

    return () => {
      disconnect();
    };
  }, []);

  const connect = () => {
    try {
      setErrorMsg("");
      const token = localStorage.getItem("medilocker_token");
      if (!token) {
        throw new Error("Not authenticated");
      }
      
      const wsUrl = import.meta.env.VITE_API_URL 
        ? import.meta.env.VITE_API_URL.replace("http", "ws") + `/voice/ws?token=${token}`
        : `ws://localhost:8000/voice/ws?token=${token}`;
        
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setState("IDLE");
        // We do NOT start listening automatically here
        autoRestartMic.current = false;
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "ERROR") {
          setState("ERROR");
          setErrorMsg(data.error || "An error occurred.");
          autoRestartMic.current = false;
          stopListening();
        } else if (data.type === "SPEAKING") {
          // Do not setState to SPEAKING here immediately; let utterance.onstart handle it so it syncs with audio
          if (data.text === "AI_QUOTA_EXCEEDED") {
            const spokenError = "I'm temporarily unable to process AI requests because the AI service quota has been reached. Please try again later.";
            setAgentResponse(spokenError);
            speak(spokenError);
            setErrorMsg("Voice AI is temporarily unavailable because the AI usage limit has been reached. Please try again later.");
          } else if (data.text === "AI_PARSE_ERROR") {
            const spokenError = "I'm sorry, I couldn't understand the AI response. Please try again.";
            setAgentResponse(spokenError);
            speak(spokenError);
          } else if (data.text === "AI_PROVIDER_UNAVAILABLE") {
            const spokenError = "I'm sorry, the AI service is currently unavailable. Please try again later.";
            setAgentResponse(spokenError);
            speak(spokenError);
          } else {
            setAgentResponse(data.text);
            speak(data.text);
          }
        } else if (data.type === "THINKING") {
          setState("THINKING");
        }
      };
      
      wsRef.current.onclose = () => {
        setState("DISCONNECTED");
        autoRestartMic.current = false;
        stopListening();
      };
      
    } catch (err) {
      console.error(err);
      setState("ERROR");
      setErrorMsg("Failed to connect to the voice agent.");
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    stopListening();
    if (synth && synth.speaking) {
      synth.cancel();
    }
    setState("DISCONNECTED");
    autoRestartMic.current = false;
  };

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setState("LISTENING");
      } catch(e) {
        console.error("Could not start recognition", e);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch(e) {}
    }
  };

  const speak = (text) => {
    if (!synth) {
      console.warn("SpeechSynthesis is not supported in this browser.");
      return;
    }

    if (synth.speaking) {
      synth.cancel();
    }
    
    console.log("[VOICE TTS] Available:", !!window.speechSynthesis);
    console.log("[VOICE TTS] Voices:", synth.getVoices());
    console.log("[VOICE TTS] Speaking:", synth.speaking);
    console.log("[VOICE TTS] Response:", text);
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select an available English voice if possible
    const availableVoices = synth.getVoices();
    const englishVoice = availableVoices.find(voice => voice.lang.startsWith("en-"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;
    
    utterance.onstart = () => {
       console.log("[VOICE TTS] Started speaking.");
       setState("SPEAKING");
    };

    utterance.onerror = (e) => {
       console.error("[VOICE TTS] Error:", e);
       setState("IDLE");
    };

    utterance.onend = () => {
      console.log("[VOICE TTS] Finished speaking.");
      // Once agent finishes speaking, go back to listening ONLY if autoRestartMic is true
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (autoRestartMic.current) {
          startListening();
        } else {
          setState("IDLE");
        }
      } else if (state === "SPEAKING") { // Fallback for Test Voice button without WS
          setState("IDLE");
      }
    };
    
    synth.speak(utterance);
  };

  const toggleMute = () => {
    if (state === "DISCONNECTED") {
      connect();
      return;
    }
    
    if (state === "LISTENING") {
      autoRestartMic.current = false;
      stopListening();
      setState("IDLE");
    } else {
      autoRestartMic.current = true;
      // If synth is currently speaking, it will start listening when it finishes.
      // But if it's idle, we start listening immediately.
      if (state !== "SPEAKING") {
        startListening();
      }
    }
  };

  // Render variables based on standalone mode
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
              <Activity className="w-6 h-6 animate-pulse" />
              <h2 className="text-xl font-bold">VRITAN Voice</h2>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs font-medium bg-indigo-500 px-2 py-1 rounded-full uppercase tracking-wider">
                {state}
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
              <p className="text-xs text-indigo-200">Authenticated as {patientName}</p>
            </div>
          )}
        </div>

        {/* Conversation Area */}
        <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto min-h-[300px]">
          
          {errorMsg && (
            <div className="bg-red-50 p-3 rounded-lg flex items-start space-x-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{errorMsg}</p>
            </div>
          )}

          <div className="flex flex-col space-y-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</span>
            <div className="bg-indigo-50 p-4 rounded-2xl rounded-tl-none border border-indigo-100">
              <p className="text-gray-800 text-lg leading-relaxed">{agentResponse}</p>
            </div>
          </div>

          {transcript && (
            <div className="flex flex-col space-y-2 items-end">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">You</span>
              <div className="bg-gray-100 p-4 rounded-2xl rounded-tr-none border border-gray-200 max-w-[85%]">
                <p className="text-gray-700">{transcript}</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gray-50 p-6 border-t border-gray-100 flex items-center justify-center space-x-6 flex-shrink-0 relative">
          {import.meta.env.DEV && (
            <button 
               onClick={() => speak("Hello Bhavana, this is the VRITAN Voice Assistant.")}
               className="absolute left-4 top-1/2 -translate-y-1/2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
            >
               Test Voice
            </button>
          )}
          {authError ? (
             <div className="text-center text-red-600 font-medium">
               Please log in to use VRITAN Voice.
             </div>
          ) : (
            <>
              <button 
                onClick={toggleMute}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  state === "LISTENING" 
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 animate-pulse" 
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {state === "LISTENING" ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
              </button>
              
              <button 
                onClick={disconnect}
                disabled={state === "DISCONNECTED"}
                className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
