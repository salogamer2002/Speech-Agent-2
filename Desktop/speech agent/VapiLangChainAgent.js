import React, { useState, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Wifi, WifiOff, Brain, Zap } from 'lucide-react';

// NOTE: You must install Vapi SDK first: npm install @vapi-ai/web
// Then uncomment the next line:


// TEMPORARY: For demo purposes, we'll use CDN loading
// Once you run "npm install @vapi-ai/web", switch to import above

const VapiLangChainAgent = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [conversationLog, setConversationLog] = useState([]);
  const [status, setStatus] = useState('Disconnected');
  const [pipelineStage, setPipelineStage] = useState('idle');
  const [vapiPublicKey, setVapiPublicKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(true);
  const [vapiInitialized, setVapiInitialized] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  const wsRef = useRef(null);
  const vapiRef = useRef(null);
  const scriptRef = useRef(null);

  // Load Vapi SDK via CDN (fallback method)
  const loadVapiSDK = () => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.Vapi) {
        console.log('✅ Vapi SDK already available');
        setSdkLoaded(true);
        resolve(window.Vapi);
        return;
      }

      if (scriptRef.current) {
        console.log('⏳ SDK loading in progress...');
        return;
      }

      console.log('📦 Loading Vapi SDK from unpkg...');
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@vapi-ai/web@latest/dist/vapi.js';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('✅ Vapi SDK script loaded');
        // Give it a moment to initialize
        setTimeout(() => {
          if (window.Vapi) {
            console.log('✅ Vapi constructor available');
            setSdkLoaded(true);
            resolve(window.Vapi);
          } else {
            console.error('❌ Vapi constructor not found after load');
            reject(new Error('Vapi SDK loaded but constructor not available'));
          }
        }, 500);
      };
      
      script.onerror = (error) => {
        console.error('❌ Failed to load Vapi SDK script:', error);
        reject(new Error('Failed to load Vapi SDK from CDN'));
      };

      scriptRef.current = script;
      document.head.appendChild(script);
    });
  };

  // Connect to backend WebSocket
  const connectToBackend = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.onopen = () => {
        console.log('✅ Connected to LangChain backend');
        setIsConnected(true);
        setStatus('🧠 LangChain Backend Ready');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📥 Backend:', data.type);
        
        if (data.type === 'agent_chunk') {
          setPipelineStage('agent');
          setAgentResponse(prev => prev + data.text);
        } 
        else if (data.type === 'agent_complete') {
          setPipelineStage('tts');
          const fullText = data.text;
          setAgentResponse(fullText);
          
          setConversationLog(prev => [...prev, {
            role: 'agent',
            text: fullText,
            time: new Date().toLocaleTimeString()
          }]);

          // Send response back to Vapi
          if (vapiRef.current) {
            console.log('🔊 Sending to Vapi for TTS:', fullText);
            vapiRef.current.send({
              type: 'add-message',
              message: {
                role: 'assistant',
                content: fullText
              }
            });
          }
        }
        else if (data.type === 'error') {
          console.error('❌ Backend error:', data.message);
          setStatus('Error: ' + data.message);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('Connection error');
      };

      ws.onclose = () => {
        console.log('❌ Backend disconnected');
        setIsConnected(false);
        setStatus('Disconnected');
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Connection failed:', error);
      setStatus('Failed to connect');
    }
  };

  const disconnectFromBackend = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  // Initialize Vapi
  const initializeVapi = async () => {
    if (!vapiPublicKey || vapiPublicKey.trim().length === 0) {
      alert('Please enter your Vapi Public Key');
      return;
    }

    try {
      setStatus('Loading Vapi SDK...');
      
      // Load the SDK
      await loadVapiSDK();
      
      if (!window.Vapi) {
        throw new Error('Vapi SDK not available. Please refresh and try again.');
      }

      console.log('✅ Creating Vapi instance...');
      setStatus('Initializing Vapi...');
      
      // Create Vapi instance with the public key
      const vapi = new window.Vapi(vapiPublicKey);
      vapiRef.current = vapi;
      console.log('✅ Vapi instance created');

      // Event listeners
      vapi.on('call-start', () => {
        console.log('📞 Vapi call started');
        setIsCallActive(true);
        setPipelineStage('stt');
        setStatus('🎧 Listening with Vapi...');
      });

      vapi.on('call-end', () => {
        console.log('📞 Vapi call ended');
        setIsCallActive(false);
        setPipelineStage('idle');
        setStatus('Call ended');
        setIsSpeaking(false);
      });

      vapi.on('speech-start', () => {
        console.log('🗣️ Assistant speaking');
        setIsSpeaking(true);
      });

      vapi.on('speech-end', () => {
        console.log('🤫 Assistant stopped speaking');
        setIsSpeaking(false);
        setPipelineStage('stt');
      });

      vapi.on('message', (message) => {
        console.log('📨 Vapi message:', message.type);

        if (message.type === 'transcript' && message.role === 'user') {
          const userText = message.transcript || message.transcriptPartial;
          if (userText) {
            setTranscript(userText);
          }
          
          // Only send final transcripts to backend
          if (!message.transcriptPartial && userText && userText.trim().length > 0) {
            console.log('📤 Sending to LangChain:', userText);
            
            setConversationLog(prev => [...prev, {
              role: 'user',
              text: userText,
              time: new Date().toLocaleTimeString()
            }]);

            // Send to backend for processing
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'transcript',
                text: userText,
                timestamp: Date.now()
              }));
              setPipelineStage('agent');
              setStatus('🤖 Agent thinking...');
            }
          }
        }
      });

      vapi.on('error', (error) => {
        console.error('❌ Vapi error:', error);
        setStatus('Vapi error: ' + (error.message || 'Unknown error'));
      });

      setVapiInitialized(true);
      setShowKeyInput(false);
      setStatus('✅ Vapi initialized - Connect backend next');
      console.log('✅ Vapi initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Vapi:', error);
      setStatus('Failed to initialize: ' + error.message);
      alert('Failed to initialize Vapi:\n\n' + error.message + '\n\nTroubleshooting:\n1. Refresh the page\n2. Check your internet connection\n3. Make sure your API key is correct\n4. Try using Chrome or Edge browser');
    }
  };

  // Start Vapi call
  const startVapiCall = async () => {
    if (!vapiRef.current) {
      alert('Please initialize Vapi first');
      return;
    }

    if (!isConnected) {
      alert('Please connect to backend first');
      return;
    }

    try {
      setStatus('Starting call...');
      
      // Start call with inline assistant config
      await vapiRef.current.start({
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en'
        },
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: 'You are a voice assistant. Keep responses brief and conversational.'
          }]
        },
        voice: {
          provider: '11labs',
          voiceId: 'rachel'
        },
        name: 'LangChain Voice Assistant',
        firstMessage: 'Hello! What can I help you with today?'
      });
      
      setStatus('🎧 Call active - Speak now!');
      setAgentResponse('');
      setTranscript('');
      
    } catch (error) {
      console.error('Failed to start call:', error);
      setStatus('Failed to start call: ' + error.message);
      alert('Failed to start call:\n\n' + error.message + '\n\nPlease check:\n1. You have Vapi credits\n2. Microphone permissions are granted\n3. You are using Chrome or Edge browser');
    }
  };

  // Stop Vapi call
  const stopVapiCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      setIsCallActive(false);
      setPipelineStage('idle');
      setStatus('Call stopped');
    }
  };

  return (
    <div style={styles.container}>
      <style>{keyframes}</style>
      
      <div style={styles.content}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <Zap color="#10b981" size={48} />
            <h1 style={styles.title}>Vapi + LangChain Voice Agent</h1>
          </div>
          <p style={styles.subtitle}>
            🎤 Vapi Professional Voice • 🧠 Kimi K2 AI Agent • ⚡ Production Quality
          </p>
        </div>

        {/* API Key Input */}
        {showKeyInput && (
          <div style={styles.keyInputPanel}>
            <h3 style={styles.keyInputTitle}>🔑 Step 1: Enter Your Vapi Public Key</h3>
            <p style={styles.keyInputSubtitle}>
              Get your key at <a href="https://dashboard.vapi.ai" target="_blank" rel="noreferrer" style={styles.link}>dashboard.vapi.ai</a> (Public API Keys section)
            </p>
            <input
              type="text"
              placeholder="Your Vapi public key (UUID format)..."
              value={vapiPublicKey}
              onChange={(e) => setVapiPublicKey(e.target.value)}
              style={styles.keyInput}
              onKeyPress={(e) => e.key === 'Enter' && initializeVapi()}
            />
            <button onClick={initializeVapi} style={styles.initButton}>
              Initialize Vapi
            </button>
            <p style={styles.helpText}>
              💡 Tip: Use your public key from the dashboard<br/>
              🔧 Install SDK: <code style={styles.codeSnippet}>npm install @vapi-ai/web</code>
            </p>
          </div>
        )}

        {!showKeyInput && (
          <>
            {/* Pipeline Status */}
            <div style={styles.pipelinePanel}>
              <div style={styles.pipelineStages}>
                <div style={{
                  ...styles.pipelineStage,
                  background: pipelineStage === 'stt' 
                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                    : 'rgba(255, 255, 255, 0.1)'
                }}>
                  <Mic size={20} color="white" />
                  <span>Vapi STT</span>
                </div>
                <div style={styles.pipelineArrow}>→</div>
                <div style={{
                  ...styles.pipelineStage,
                  background: pipelineStage === 'agent' 
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                    : 'rgba(255, 255, 255, 0.1)'
                }}>
                  <Brain size={20} color="white" />
                  <span>Kimi K2</span>
                </div>
                <div style={styles.pipelineArrow}>→</div>
                <div style={{
                  ...styles.pipelineStage,
                  background: pipelineStage === 'tts' 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'rgba(255, 255, 255, 0.1)'
                }}>
                  <Volume2 size={20} color="white" />
                  <span>Vapi TTS</span>
                </div>
              </div>
            </div>

            {/* Connection Status */}
            <div style={styles.connectionPanel}>
              <div style={styles.connectionContent}>
                <div style={styles.statusInfo}>
                  {isConnected ? (
                    <Wifi color="#4ade80" size={28} />
                  ) : (
                    <WifiOff color="#f87171" size={28} />
                  )}
                  <div>
                    <p style={styles.statusLabel}>Backend Status</p>
                    <p style={{...styles.statusValue, color: isConnected ? '#86efac' : '#fca5a5'}}>
                      {status}
                    </p>
                  </div>
                </div>
                
                {!isConnected ? (
                  <button onClick={connectToBackend} style={styles.connectBtn} disabled={!vapiInitialized}>
                    {vapiInitialized ? 'Step 2: Connect Backend' : 'Initialize Vapi First'}
                  </button>
                ) : (
                  <button onClick={disconnectFromBackend} style={styles.disconnectBtn}>
                    Disconnect Backend
                  </button>
                )}
              </div>
            </div>

            {/* Control Panel */}
            <div style={styles.controlPanel}>
              <div style={styles.statusIndicators}>
                <div style={{
                  ...styles.statusBadge,
                  background: isCallActive ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#374151',
                  animation: isCallActive ? 'pulse 1.5s infinite' : 'none'
                }}>
                  {isCallActive ? <Mic size={20} color="white" /> : <MicOff size={20} color="white" />}
                  <span style={styles.badgeText}>
                    {isCallActive ? 'Call Active' : 'No Call'}
                  </span>
                </div>
                
                <div style={{
                  ...styles.statusBadge,
                  background: isSpeaking ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#374151',
                  animation: isSpeaking ? 'pulse 1.5s infinite' : 'none'
                }}>
                  {isSpeaking ? <Volume2 size={20} color="white" /> : <VolumeX size={20} color="white" />}
                  <span style={styles.badgeText}>
                    {isSpeaking ? 'AI Speaking' : 'Silent'}
                  </span>
                </div>
              </div>

              <div style={styles.controlButtons}>
                {!isCallActive ? (
                  <button
                    onClick={startVapiCall}
                    disabled={!isConnected}
                    style={{
                      ...styles.mainButton,
                      background: isConnected
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : '#4b5563',
                      cursor: isConnected ? 'pointer' : 'not-allowed',
                      opacity: isConnected ? 1 : 0.5
                    }}
                  >
                    <Zap size={24} color="white" />
                    <span>Step 3: Start Vapi Call</span>
                  </button>
                ) : (
                  <button onClick={stopVapiCall} style={styles.stopButton}>
                    <MicOff size={24} color="white" />
                    <span>End Call</span>
                  </button>
                )}
              </div>

              {transcript && (
                <div style={styles.transcriptBox}>
                  <h3 style={styles.transcriptTitle}>🎤 You said:</h3>
                  <p style={styles.transcriptText}>{transcript}</p>
                </div>
              )}

              {agentResponse && (
                <div style={styles.responseBox}>
                  <h3 style={styles.responseTitle}>🤖 AI Response:</h3>
                  <p style={styles.responseText}>{agentResponse}</p>
                </div>
              )}
            </div>

            {/* Conversation History */}
            <div style={styles.conversationPanel}>
              <h2 style={styles.conversationTitle}>💬 Conversation History</h2>
              
              {conversationLog.length === 0 ? (
                <div style={styles.emptyState}>
                  <p style={styles.emptyText}>Start a call to begin chatting!</p>
                  <p style={styles.emptySubtext}>
                    Vapi handles professional voice I/O
                  </p>
                </div>
              ) : (
                <div style={styles.messageList}>
                  {conversationLog.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...styles.message,
                        background: msg.role === 'user' 
                          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)'
                          : 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(109, 40, 217, 0.3) 100%)',
                        marginLeft: msg.role === 'user' ? '60px' : '0',
                        marginRight: msg.role === 'user' ? '0' : '60px'
                      }}
                    >
                      <div style={styles.messageHeader}>
                        <span style={styles.messageSender}>
                          {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                        </span>
                        <span style={styles.messageTime}>{msg.time}</span>
                      </div>
                      <p style={styles.messageText}>{msg.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div style={styles.infoBox}>
              <p style={styles.infoText}>
                <strong>🎯 Hybrid Architecture:</strong><br />
                • STT: Vapi (Deepgram Nova-2)<br />
                • Agent: Fireworks Kimi K2 (32K context)<br />
                • TTS: Vapi (ElevenLabs)<br />
                <br />
                <strong>✨ Features:</strong><br />
                • Professional voice quality<br />
                • Real-time streaming<br />
                • Low latency pipeline<br />
                • Production-ready<br />
                • Free Vapi tier available
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const keyframes = `
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
`;

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    padding: '20px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '10px'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #8b5cf6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0
  },
  subtitle: {
    color: '#93c5fd',
    fontSize: '1.1rem',
    fontWeight: '500'
  },
  keyInputPanel: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '40px',
    marginBottom: '20px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    textAlign: 'center'
  },
  keyInputTitle: {
    color: 'white',
    fontSize: '1.5rem',
    marginBottom: '10px'
  },
  keyInputSubtitle: {
    color: '#93c5fd',
    marginBottom: '20px'
  },
  link: {
    color: '#10b981',
    textDecoration: 'none',
    fontWeight: 'bold'
  },
  keyInput: {
    width: '100%',
    maxWidth: '500px',
    padding: '15px',
    fontSize: '1rem',
    borderRadius: '10px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    marginBottom: '20px'
  },
  initButton: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    padding: '15px 40px',
    borderRadius: '50px',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    cursor: 'pointer'
  },
  helpText: {
    color: '#9ca3af',
    fontSize: '0.9rem',
    marginTop: '15px',
    lineHeight: '1.6'
  },
  codeSnippet: {
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '2px 8px',
    borderRadius: '4px',
    color: '#10b981',
    fontFamily: 'monospace'
  },
  pipelinePanel: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '25px',
    marginBottom: '20px',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  pipelineStages: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    flexWrap: 'wrap'
  },
  pipelineStage: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '15px 25px',
    borderRadius: '12px',
    fontWeight: 'bold',
    color: 'white',
    transition: 'all 0.3s ease'
  },
  pipelineArrow: {
    color: '#64748b',
    fontSize: '1.5rem',
    fontWeight: 'bold'
  },
  connectionPanel: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '25px',
    marginBottom: '20px',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  connectionContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px'
  },
  statusInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  statusLabel: {
    color: 'white',
    fontWeight: '600',
    fontSize: '1.1rem',
    margin: 0
  },
  statusValue: {
    fontSize: '0.95rem',
    margin: '5px 0 0 0'
  },
  connectBtn: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    padding: '12px 30px',
    borderRadius: '50px',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer'
  },
  disconnectBtn: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    padding: '12px 30px',
    borderRadius: '50px',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer'
  },
  controlPanel: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '25px',
    padding: '35px',
    marginBottom: '20px',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  statusIndicators: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginBottom: '25px',
    flexWrap: 'wrap'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '15px 30px',
    borderRadius: '50px'
  },
  badgeText: {
    color: 'white',
    fontWeight: '600',
    fontSize: '1rem'
  },
  controlButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '25px',
    flexWrap: 'wrap'
  },
  mainButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '18px 35px',
    borderRadius: '50px',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    color: 'white'
  },
  stopButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    padding: '18px 35px',
    borderRadius: '50px',
    border: 'none',
    fontWeight: 'bold',
    fontSize: '1.1rem',
    cursor: 'pointer'
  },
  transcriptBox: {
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid rgba(147, 197, 253, 0.3)'
  },
  transcriptTitle: {
    color: '#93c5fd',
    fontWeight: '600',
    marginBottom: '10px',
    fontSize: '1.1rem'
  },
  transcriptText: {
    color: 'white',
    fontSize: '1.1rem',
    margin: 0
  },
  responseBox: {
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(109, 40, 217, 0.2) 100%)',
    borderRadius: '20px',
    padding: '20px',
    border: '1px solid rgba(196, 181, 253, 0.3)'
  },
  responseTitle: {
    color: '#c4b5fd',
    fontWeight: '600',
    marginBottom: '10px',
    fontSize: '1.1rem'
  },
  responseText: {
    color: 'white',
    fontSize: '1.1rem',
    margin: 0
  },
  conversationPanel: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '25px',
    padding: '30px',
    marginBottom: '20px',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  conversationTitle: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '20px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  emptyText: {
    color: '#93c5fd',
    fontSize: '1.1rem',
    marginBottom: '10px'
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: '0.9rem'
  },
  messageList: {
    maxHeight: '400px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  message: {
    padding: '18px',
    borderRadius: '15px'
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  messageSender: {
    fontWeight: 'bold',
    color: 'white',
    fontSize: '1rem'
  },
  messageTime: {
    fontSize: '0.8rem',
    color: '#d1d5db'
  },
  messageText: {
    color: 'white',
    margin: 0,
    lineHeight: '1.5'
  },
  infoBox: {
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)',
    border: '1px solid rgba(16, 185, 129, 0.5)',
    borderRadius: '15px',
    padding: '20px'
  },
  infoText: {
    color: '#6ee7b7',
    fontSize: '0.95rem',
    margin: 0,
    lineHeight: '1.8'
  }
};

export default VapiLangChainAgent;