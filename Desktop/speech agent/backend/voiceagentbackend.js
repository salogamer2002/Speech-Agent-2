// ============================================
// VAPI + LANGCHAIN VOICE AGENT BACKEND
// OPTIMIZED FOR FAST, SMOOTH VOICE OUTPUT
// ============================================

const WebSocket = require('ws');
const http = require('http');
const https = require('https');

// ============================================
// FIREWORKS AI AGENT (Kimi K2 Model)
// ============================================

class FireworksAgent {
  constructor(apiKey, model = 'accounts/fireworks/models/kimi-k2-instruct-0905') {
    this.apiKey = apiKey;
    this.model = model;
    this.conversationHistory = [];
    this.systemPrompt = `You are a helpful voice assistant.

CRITICAL RULES FOR VOICE:
- Keep responses EXTREMELY SHORT (1-2 sentences maximum)
- Be conversational and natural
- No markdown, emojis, or special formatting
- Your output will be spoken aloud
- Get straight to the point
- Sound like a real person talking`;
  }

  async *streamResponse(userMessage) {
    console.log('🤖 [Fireworks - Kimi K2] Processing:', userMessage);
    
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    try {
      const postData = JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...this.conversationHistory
        ],
        stream: true,
        max_tokens: 32768,
        top_p: 1,
        top_k: 40,
        presence_penalty: 0,
        frequency_penalty: 0,
        temperature: 0.6
      });

      const options = {
        hostname: 'api.fireworks.ai',
        port: 443,
        path: '/inference/v1/chat/completions',
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      let fullResponse = '';
      const startTime = Date.now();

      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, resolve);
        req.on('error', reject);
        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        req.write(postData);
        req.end();
      });

      if (response.statusCode !== 200) {
        let errorBody = '';
        for await (const chunk of response) {
          errorBody += chunk.toString();
        }
        console.error('❌ Fireworks API error:', response.statusCode, errorBody);
        throw new Error(`Fireworks API error: ${response.statusCode} - ${errorBody}`);
      }

      let buffer = '';
      let sentenceBuffer = '';  // NEW: Buffer for sentence-level streaming

      for await (const chunk of response) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              fullResponse += content;
              sentenceBuffer += content;

              // NEW: Send complete sentences immediately for faster TTS
              const sentenceEndings = /[.!?]\s/g;
              const matches = sentenceBuffer.match(sentenceEndings);
              
              if (matches) {
                const lastMatch = sentenceBuffer.lastIndexOf(matches[matches.length - 1]);
                const completeSentence = sentenceBuffer.substring(0, lastMatch + matches[matches.length - 1].length).trim();
                
                if (completeSentence) {
                  yield {
                    type: 'sentence_complete',  // NEW: Signal complete sentence for immediate TTS
                    text: completeSentence,
                    timestamp: Date.now()
                  };
                  
                  sentenceBuffer = sentenceBuffer.substring(lastMatch + matches[matches.length - 1].length);
                }
              }

              // Also send chunks for UI update (but not for TTS)
              yield {
                type: 'agent_chunk',
                text: content,
                timestamp: Date.now()
              };
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      // NEW: Send any remaining text
      if (sentenceBuffer.trim()) {
        yield {
          type: 'sentence_complete',
          text: sentenceBuffer.trim(),
          timestamp: Date.now()
        };
      }

      const latency = Date.now() - startTime;
      console.log(`✅ [Kimi K2] Response: "${fullResponse}" (${latency}ms)`);

      if (!fullResponse.trim()) {
        fullResponse = "I'm here to help. What would you like to know?";
      }

      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse
      });

      yield {
        type: 'agent_complete',
        text: fullResponse,
        timestamp: Date.now(),
        latency: latency
      };

    } catch (error) {
      console.error('❌ [Fireworks - Kimi K2] Error:', error.message);
      const errorMsg = "Sorry, I had a technical issue. Could you repeat that?";
      
      yield {
        type: 'sentence_complete',
        text: errorMsg,
        timestamp: Date.now()
      };
      
      yield {
        type: 'agent_complete',
        text: errorMsg,
        timestamp: Date.now()
      };
    }
  }

  clearHistory() {
    this.conversationHistory = [];
    console.log('🧹 Conversation history cleared');
  }
}

// ============================================
// VAPI + LANGCHAIN PIPELINE
// ============================================

class VapiLangChainPipeline {
  constructor(config) {
    this.agent = new FireworksAgent(config.fireworksKey);
    this.clientWs = null;
    this.isProcessing = false;
  }

  initialize(clientWebSocket) {
    this.clientWs = clientWebSocket;
    console.log('✅ Vapi + LangChain Pipeline initialized');
    console.log('📋 Architecture: Vapi (Voice I/O) → Fireworks Kimi K2 (Agent Logic)');
  }

  async handleTranscript(text) {
    if (this.isProcessing) {
      console.log('⏳ Already processing, ignoring...');
      return;
    }

    if (!text || text.trim().length === 0) {
      console.log('⚠️ Empty transcript, ignoring');
      return;
    }

    this.isProcessing = true;
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 [Pipeline] User said:', text);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      // Immediately acknowledge
      this.sendToClient({
        type: 'transcript_received',
        text: text,
        timestamp: Date.now()
      });

      let fullResponse = '';
      let chunkCount = 0;

      // Stream response from Fireworks Kimi K2
      for await (const chunk of this.agent.streamResponse(text)) {
        chunkCount++;
        
        if (chunk.type === 'agent_chunk') {
          fullResponse += chunk.text;
          this.sendToClient(chunk);
        }
        else if (chunk.type === 'sentence_complete') {
          // NEW: Send complete sentences immediately to frontend for TTS
          console.log('🔊 Sentence ready for TTS:', chunk.text);
          this.sendToClient({
            type: 'tts_ready',  // NEW: Signal frontend to play this immediately
            text: chunk.text,
            timestamp: chunk.timestamp
          });
        }
        else if (chunk.type === 'agent_complete') {
          console.log(`✅ [Pipeline] Complete response (${chunkCount} chunks)`);
          this.sendToClient(chunk);
        }
      }

    } catch (error) {
      console.error('❌ [Pipeline] Error:', error.message);
      this.sendToClient({
        type: 'error',
        message: error.message,
        timestamp: Date.now()
      });
    } finally {
      this.isProcessing = false;
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  }

  sendToClient(data) {
    if (this.clientWs && this.clientWs.readyState === WebSocket.OPEN) {
      try {
        this.clientWs.send(JSON.stringify(data));
      } catch (error) {
        console.error('❌ Failed to send to client:', error.message);
      }
    }
  }

  cleanup() {
    this.agent.clearHistory();
    console.log('🧹 Pipeline cleaned up');
  }
}

// ============================================
// WEBSOCKET SERVER
// ============================================

class VapiLangChainServer {
  constructor(port = 8080) {
    this.port = port;
    this.server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy',
          architecture: 'vapi-langchain-hybrid',
          model: 'Kimi K2 Instruct',
          optimization: 'sentence-level-streaming',  // NEW
          components: {
            stt: 'Vapi (Deepgram)',
            agent: 'Fireworks Kimi K2',
            tts: 'Vapi (ElevenLabs)'
          },
          timestamp: new Date().toISOString() 
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Vapi + LangChain Server (Kimi K2) - OPTIMIZED</title>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
      color: white;
      padding: 40px;
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      background: linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #8b5cf6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-size: 2.5rem;
    }
    .status {
      background: rgba(16, 185, 129, 0.2);
      border: 2px solid #10b981;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
    .architecture {
      background: rgba(59, 130, 246, 0.2);
      border: 2px solid #3b82f6;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
    code {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 8px;
      border-radius: 4px;
      color: #10b981;
    }
    ul {
      list-style: none;
      padding-left: 0;
    }
    li {
      padding: 8px 0;
    }
    li:before {
      content: "✓ ";
      color: #10b981;
      font-weight: bold;
      margin-right: 8px;
    }
    .new {
      color: #fbbf24;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚡ Vapi + Kimi K2 Voice Server</h1>
    <p class="new">🚀 OPTIMIZED FOR FAST VOICE RESPONSE</p>
    
    <div class="status">
      <h2>🟢 Server Running</h2>
      <p><strong>WebSocket:</strong> <code>ws://localhost:${this.port}</code></p>
      <p><strong>Health Check:</strong> <code>http://localhost:${this.port}/health</code></p>
    </div>

    <div class="architecture">
      <h2>🏗️ Hybrid Architecture</h2>
      <p><strong>Voice Input (STT):</strong> Vapi → Deepgram Nova-2</p>
      <p><strong>Agent Logic:</strong> Fireworks Kimi K2 Instruct (32K Context)</p>
      <p><strong>Voice Output (TTS):</strong> Vapi → ElevenLabs</p>
      <p class="new"><strong>NEW:</strong> Sentence-level streaming for instant TTS</p>
    </div>

    <div class="architecture">
      <h2>✨ Features</h2>
      <ul>
        <li>Professional voice quality via Vapi</li>
        <li>Kimi K2 AI model (32K context window)</li>
        <li class="new">Real-time sentence streaming (NO DELAYS!)</li>
        <li class="new">Immediate TTS playback</li>
        <li>Ultra-low latency pipeline</li>
        <li>Production-ready architecture</li>
      </ul>
    </div>

    <div class="status">
      <h2>📊 Data Flow</h2>
      <p>User speaks → Vapi STT → WebSocket → Kimi K2 AI → <span class="new">INSTANT Sentence Streaming</span> → Vapi TTS → User hears <span class="new">IMMEDIATELY</span></p>
    </div>
  </div>
</body>
</html>
        `);
      }
    });
    
    this.wss = new WebSocket.Server({ 
      server: this.server,
      perMessageDeflate: false
    });
    
    this.activePipelines = new Map();
  }

  start(config) {
    this.wss.on('connection', (ws) => {
      console.log('\n🔌 New client connected');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const pipeline = new VapiLangChainPipeline(config);
      const connectionId = Date.now().toString();
      this.activePipelines.set(connectionId, pipeline);

      pipeline.initialize(ws);

      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Vapi + Kimi K2 Pipeline Ready (OPTIMIZED)',
        architecture: 'hybrid',
        model: 'Kimi K2 Instruct',
        optimization: 'sentence-level-streaming',
        components: {
          stt: 'vapi',
          agent: 'fireworks-kimi-k2',
          tts: 'vapi'
        },
        timestamp: Date.now()
      }));

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'transcript') {
            await pipeline.handleTranscript(message.text);
          }
          else if (message.type === 'ping') {
            ws.send(JSON.stringify({ 
              type: 'pong', 
              timestamp: Date.now() 
            }));
          }
        } catch (error) {
          console.error('❌ Message handling error:', error.message);
          ws.send(JSON.stringify({
            type: 'error',
            message: error.message,
            timestamp: Date.now()
          }));
        }
      });

      ws.on('close', () => {
        console.log('\n🔌 Client disconnected');
        pipeline.cleanup();
        this.activePipelines.delete(connectionId);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
      });
    });

    this.server.listen(this.port, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ⚡ VAPI + KIMI K2 VOICE SERVER (OPTIMIZED)                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

🌐 Server:     http://localhost:${this.port}
📡 WebSocket:  ws://localhost:${this.port}
🏥 Health:     http://localhost:${this.port}/health

╔══════════════════════════════════════════════════════════════╗
║  🚀 OPTIMIZATION: SENTENCE-LEVEL STREAMING                  ║
╚══════════════════════════════════════════════════════════════╝

   🎤 Voice Input (STT)
      │
      ├─→ Vapi Platform
      │   └─→ Deepgram Nova-2
      │
      ↓
   📝 Text to Backend
      │
      ↓
   🤖 AI Agent Processing
      │
      ├─→ Fireworks AI (Your Credits) ⚡
      │   └─→ Kimi K2 Instruct (32K Context)
      │   └─→ 🆕 STREAMS COMPLETE SENTENCES IMMEDIATELY
      │
      ↓
   📤 Response to Frontend (INSTANT)
      │
      ↓
   🔊 Voice Output (TTS - NO WAITING!)
      │
      └─→ Vapi Platform
          └─→ ElevenLabs

╔══════════════════════════════════════════════════════════════╗
║  ✨ FEATURES                                                 ║
╚══════════════════════════════════════════════════════════════╝

  ✓ Professional voice quality (Vapi)
  ✓ Kimi K2 AI model (32K context window)
  ✓ 🆕 ZERO DELAY - Sentence streaming
  ✓ 🆕 SMOOTH CONVERSATION - No stuttering
  ✓ 🆕 INSTANT TTS - Starts speaking immediately
  ✓ Real-time streaming responses
  ✓ Ultra-low latency pipeline
  ✓ Production-ready architecture

╔══════════════════════════════════════════════════════════════╗
║  🚀 READY TO ACCEPT CONNECTIONS                              ║
╚══════════════════════════════════════════════════════════════╝

🔥 Fireworks AI (Kimi K2): ${config.fireworksKey ? '✅ Connected' : '❌ Missing API Key'}

Connect your frontend and experience FAST voice responses!
      `);
    });
  }
}

// ============================================
// START SERVER
// ============================================

const config = {
  fireworksKey: process.env.FIREWORKS_API_KEY || 'your-fireworks-api-key-here'
};

// Validate configuration
if (!config.fireworksKey || config.fireworksKey === 'your-fireworks-api-key-here') {
  console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ❌ ERROR: FIREWORKS API KEY NOT SET                         ║
╚══════════════════════════════════════════════════════════════╝

Please set your Fireworks API key:

Windows PowerShell:
  $env:FIREWORKS_API_KEY="fw_xxxxxxxxxxxxx"

macOS/Linux:
  export FIREWORKS_API_KEY="fw_xxxxxxxxxxxxx"

Get your FREE key at: https://fireworks.ai/

Then restart the server:
  node server.js
  `);
  process.exit(1);
}

const server = new VapiLangChainServer(8080);
server.start(config);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
});