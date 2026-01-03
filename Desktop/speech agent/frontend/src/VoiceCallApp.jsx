import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';

const VoiceCallApp = () => {
  const [vapi, setVapi] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('Ready to call');

  // 👇 PASTE YOUR KEYS HERE
  const PUBLIC_KEY = "94773849-1326-483c-8611-6e69a9fe7b4f"; // Get from dashboard.vapi.ai
  const ASSISTANT_ID = "4647b127-4a4e-4b2e-9f34-1f4caba277af"; // From setup tool

  useEffect(() => {
    // Initialize Vapi
    const vapiInstance = new window.Vapi(PUBLIC_KEY);
    
    // Set up event listeners
    vapiInstance.on('call-start', () => {
      setIsCallActive(true);
      setCallStatus('Call connected!');
    });

    vapiInstance.on('call-end', () => {
      setIsCallActive(false);
      setCallStatus('Call ended');
    });

    vapiInstance.on('speech-start', () => {
      setCallStatus('Listening...');
    });

    vapiInstance.on('speech-end', () => {
      setCallStatus('Processing...');
    });

    vapiInstance.on('error', (error) => {
      console.error('Vapi error:', error);
      setCallStatus('Error: ' + error.message);
      setIsCallActive(false);
    });

    setVapi(vapiInstance);

    return () => {
      vapiInstance.stop();
    };
  }, []);

  const startCall = async () => {
    if (!vapi) return;
    
    try {
      setCallStatus('Connecting...');
      await vapi.start(ASSISTANT_ID);
    } catch (error) {
      console.error('Failed to start call:', error);
      setCallStatus('Failed to connect');
    }
  };

  const endCall = () => {
    if (vapi) {
      vapi.stop();
      setCallStatus('Ready to call');
    }
  };

  const toggleMute = () => {
    if (vapi) {
      vapi.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <Phone size={48} color="#10b981" />
          <h1 style={styles.title}>Voice Assistant</h1>
          <p style={styles.subtitle}>Powered by Vapi + Fireworks</p>
        </div>

        <div style={styles.statusBadge}>
          <div style={{
            ...styles.statusDot,
            background: isCallActive ? '#10b981' : '#64748b'
          }} />
          <span style={styles.statusText}>{callStatus}</span>
        </div>

        <div style={styles.buttonContainer}>
          {!isCallActive ? (
            <button
              onClick={startCall}
              style={styles.callButton}
              disabled={!vapi}
            >
              <Phone size={24} />
              <span>Start Call</span>
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                style={{
                  ...styles.muteButton,
                  background: isMuted ? '#ef4444' : '#64748b'
                }}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              
              <button
                onClick={endCall}
                style={styles.endButton}
              >
                <PhoneOff size={24} />
                <span>End Call</span>
              </button>
            </>
          )}
        </div>

        <div style={styles.instructions}>
          <h3 style={styles.instructionsTitle}>Setup Instructions:</h3>
          <ol style={styles.instructionsList}>
            <li>Get your <strong>Public Key</strong> (pk_...) from <a href="https://dashboard.vapi.ai" target="_blank" rel="noreferrer" style={styles.link}>dashboard.vapi.ai</a></li>
            <li>Copy your <strong>Assistant ID</strong> from the setup tool</li>
            <li>Replace the placeholders in the code above (lines 12-13)</li>
            <li>Run: <code style={styles.code}>npm install @vapi-ai/web</code></li>
            <li>Add this script to your HTML: <code style={styles.code}>&lt;script src="https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest"&gt;&lt;/script&gt;</code></li>
          </ol>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: 'white',
    margin: '15px 0 5px 0'
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '1rem'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '12px 20px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '12px',
    marginBottom: '30px'
  },
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    animation: 'pulse 2s infinite'
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: '1rem'
  },
  buttonContainer: {
    display: 'flex',
    gap: '15px',
    marginBottom: '30px'
  },
  callButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  muteButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  endButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  instructions: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    padding: '20px',
    color: '#93c5fd'
  },
  instructionsTitle: {
    color: 'white',
    fontSize: '1.1rem',
    marginTop: 0,
    marginBottom: '15px'
  },
  instructionsList: {
    margin: 0,
    paddingLeft: '20px',
    lineHeight: '1.8'
  },
  link: {
    color: '#10b981',
    textDecoration: 'none',
    fontWeight: 'bold'
  },
  code: {
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#10b981',
    fontSize: '0.9rem'
  }
};

export default VoiceCallApp;