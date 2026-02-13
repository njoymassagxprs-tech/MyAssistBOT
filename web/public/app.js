/**
 * 🤖 MyAssistBOT - Web Client
 */

class MyBotApp {
  constructor() {
    this.ws = null;
    this.recognition = null;
    this.isListening = false;
    this.voiceTranscript = '';  // accumulated voice text
    this.ttsEnabled = localStorage.getItem('mybot_tts_enabled') === 'true';
    this.apiUrl = this.getApiUrl();
    this.pendingFile = null;    // ficheiro anexado aguardando envio
    
    this.elements = {
      messages: document.getElementById('messagesArea'),
      chatContainer: document.getElementById('chatContainer'),
      welcome: document.querySelector('.welcome'),
      input: document.getElementById('messageInput'),
      sendBtn: document.getElementById('btnSend'),
      voiceBtn: document.getElementById('btnVoice'),
      micIcon: document.getElementById('micIcon'),
      voiceStatus: document.getElementById('voiceStatus'),
      statusBadge: document.getElementById('statusBadge'),
      btnTTS: document.getElementById('btnTTS'),
      ttsIcon: document.getElementById('ttsIcon'),
      btnUpload: document.getElementById('btnUpload'),
      fileInput: document.getElementById('fileInput'),
      // Attachment preview elements
      attachmentPreview: document.getElementById('attachmentPreview'),
      attachmentIcon: document.getElementById('attachmentIcon'),
      attachmentName: document.getElementById('attachmentName'),
      attachmentSize: document.getElementById('attachmentSize'),
      btnRemoveAttachment: document.getElementById('btnRemoveAttachment'),
    };
    
    this.init();
  }
  
  getApiUrl() {
    // Servidor unificado — usar a mesma origem
    return window.location.origin;
  }
  
  init() {
    this.checkFirstRun();
    this.setupEventListeners();
    this.setupSpeechRecognition();
    this.setupTTS();
    this.setupWebSocket();
    this.loadHistory();
  }
  
  // ═══════════════════════════════════════════════════════════
  // PRIMEIRO ACESSO
  // ═══════════════════════════════════════════════════════════
  
  checkFirstRun() {
    const hasSeenWelcome = localStorage.getItem('mybot_web_welcome');
    
    if (!hasSeenWelcome) {
      this.showWelcomeModal();
      localStorage.setItem('mybot_web_welcome', 'true');
    }
  }
  
  showWelcomeModal() {
    const modal = document.createElement('div');
    modal.id = 'welcomeModal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-icon">🤖</div>
          <h2>Bem-vindo ao MyAssistBOT!</h2>
          <p>O teu assistente IA pessoal</p>
          
          <div class="modal-features">
            <div>🧠 Perguntas</div>
            <div>📄 PDFs</div>
            <div>💻 Código</div>
            <div>🎤 Voz</div>
          </div>
          
          <div class="modal-tip">
            💡 <strong>Dica:</strong> Diz "ajuda" para ver tudo o que posso fazer!
          </div>
          
          <button class="modal-btn" onclick="document.getElementById('welcomeModal').remove()">
            Começar! 🚀
          </button>
        </div>
      </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
      }
      .modal-content {
        background: var(--bg-secondary);
        border-radius: 20px;
        padding: 30px;
        text-align: center;
        max-width: 350px;
        border: 2px solid var(--accent);
      }
      .modal-icon { font-size: 60px; margin-bottom: 15px; }
      .modal-content h2 { color: var(--accent); margin: 0 0 10px; }
      .modal-content p { color: var(--text-secondary); margin-bottom: 20px; }
      .modal-features {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 20px;
      }
      .modal-features div {
        background: rgba(0,217,255,0.15);
        padding: 12px;
        border-radius: 10px;
        font-size: 14px;
      }
      .modal-tip {
        background: rgba(255,165,0,0.15);
        padding: 12px;
        border-radius: 10px;
        font-size: 13px;
        margin-bottom: 20px;
        color: #ffa500;
      }
      .modal-btn {
        background: var(--accent);
        color: var(--bg-primary);
        border: none;
        padding: 14px 35px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(modal);
  }
  
  // ═══════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════
  
  setupEventListeners() {
    // Send message
    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
    this.elements.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Voice button
    this.elements.voiceBtn.addEventListener('click', () => this.toggleVoice());
    
    // TTS toggle button
    if (this.elements.btnTTS) {
      this.elements.btnTTS.addEventListener('click', () => this.toggleTTS());
    }
    
    // File upload button
    if (this.elements.btnUpload) {
      this.elements.btnUpload.addEventListener('click', () => {
        this.elements.fileInput?.click();
      });
    }
    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }
    
    // Remove attachment button
    if (this.elements.btnRemoveAttachment) {
      this.elements.btnRemoveAttachment.addEventListener('click', () => this.removeAttachment());
    }
    
    // Quick actions (chips)
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.textContent;
        this.elements.input.value = text;
        this.sendMessage();
      });
    });
    
    // Online/Offline
    window.addEventListener('online', () => this.updateStatus(true));
    window.addEventListener('offline', () => this.updateStatus(false));
  }
  
  // ═══════════════════════════════════════════════════════════
  // WEBSOCKET
  // ═══════════════════════════════════════════════════════════
  
  setupWebSocket() {
    // WebSocket no root (mesmo server que HTTP)
    const wsUrl = this.apiUrl.replace('http', 'ws');
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        this.updateStatus(true);
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.response) {
            this.hideTyping();
            this.addMessage(data.response, 'bot');
            this.speak(data.speakableText || data.response);
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.updateStatus(false);
        // Reconectar após 3s
        setTimeout(() => this.setupWebSocket(), 3000);
      };
      
      this.ws.onerror = () => {
        this.updateStatus(false);
      };
    } catch (e) {
      console.log('WebSocket not available, using HTTP');
      this.updateStatus(navigator.onLine);
    }
  }
  
  updateStatus(online) {
    if (online) {
      this.elements.statusBadge.textContent = 'Online';
      this.elements.statusBadge.classList.add('online');
    } else {
      this.elements.statusBadge.textContent = 'Offline';
      this.elements.statusBadge.classList.remove('online');
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // UPLOAD DE FICHEIROS (ANEXAR + ENVIAR MANUAL)
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Retorna ícone apropriado para o tipo de ficheiro
   */
  getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const icons = {
      pdf: '📕', doc: '📘', docx: '📘', txt: '📄', md: '📝',
      js: '🟨', ts: '🔷', py: '🐍', html: '🌐', css: '🎨', json: '📋',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🎨',
      mp3: '🎵', wav: '🎵', ogg: '🎵',
      mp4: '🎬', webm: '🎬', mov: '🎬', avi: '🎬',
      csv: '📊', xml: '📰', yaml: '⚙️', yml: '⚙️'
    };
    return icons[ext] || '📎';
  }
  
  /**
   * Formata tamanho de ficheiro
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  /**
   * Anexa ficheiro para preview (não envia automaticamente)
   */
  async handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    event.target.value = '';
    
    if (file.size > 5 * 1024 * 1024) {
      this.addMessage('❌ Ficheiro demasiado grande (máx 5MB)', 'bot');
      return;
    }
    
    this.pendingFile = file;
    this.showAttachmentPreview(file);
    this.elements.input.focus();
  }
  
  /**
   * Mostra preview do ficheiro anexado
   */
  showAttachmentPreview(file) {
    if (!this.elements.attachmentPreview) return;
    
    this.elements.attachmentIcon.textContent = this.getFileIcon(file.name);
    this.elements.attachmentName.textContent = file.name;
    this.elements.attachmentSize.textContent = this.formatFileSize(file.size);
    this.elements.attachmentPreview.style.display = 'flex';
    this.elements.btnUpload?.classList.add('has-attachment');
  }
  
  /**
   * Remove anexo pendente
   */
  removeAttachment() {
    this.pendingFile = null;
    if (this.elements.attachmentPreview) {
      this.elements.attachmentPreview.style.display = 'none';
    }
    this.elements.btnUpload?.classList.remove('has-attachment');
  }
  
  /**
   * Envia ficheiro anexado para o servidor
   */
  async uploadPendingFile() {
    if (!this.pendingFile) return null;
    
    const file = this.pendingFile;
    
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const response = await fetch(`${this.apiUrl}/api/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          data: base64,
          indexForRAG: true
        })
      });
      
      const result = await response.json();
      
      this.pendingFile = null;
      if (this.elements.attachmentPreview) {
        this.elements.attachmentPreview.style.display = 'none';
      }
      this.elements.btnUpload?.classList.remove('has-attachment');
      
      return { success: result.success, file, result };
    } catch (err) {
      return { success: false, file, error: err.message };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════

  async sendMessage() {
    const text = this.elements.input.value.trim();
    const hasFile = !!this.pendingFile;
    
    // Se não há texto nem ficheiro, não fazer nada
    if (!text && !hasFile) return;
    
    // Hide welcome
    this.elements.welcome.classList.add('hidden');
    
    // Limpar input
    this.elements.input.value = '';
    
    // Se há ficheiro pendente, processar primeiro
    if (hasFile) {
      const fileName = this.pendingFile.name;
      const fileSize = this.formatFileSize(this.pendingFile.size);
      const fileIcon = this.getFileIcon(fileName);
      
      const userMsg = text 
        ? `${fileIcon} **Ficheiro:** ${fileName} (${fileSize})\n\n${text}`
        : `${fileIcon} **Ficheiro:** ${fileName} (${fileSize})`;
      this.addMessage(userMsg, 'user');
      this.saveToHistory({ role: 'user', content: userMsg });
      
      this.showTyping();
      
      const uploadResult = await this.uploadPendingFile();
      
      if (uploadResult?.success) {
        let msg = `✅ **${uploadResult.file.name}** carregado com sucesso`;
        if (uploadResult.result?.rag) {
          msg += `\n\n📚 Indexado para contexto — ${uploadResult.result.rag.totalChunks} chunks`;
        }
        
        if (text) {
          msg += `\n\n---\n\n🔄 A processar a tua pergunta...`;
          this.hideTyping();
          this.addMessage(msg, 'bot');
          await this.sendTextOnly(text);
        } else {
          this.hideTyping();
          this.addMessage(msg, 'bot');
        }
      } else {
        this.hideTyping();
        this.addMessage(`❌ Erro ao enviar ficheiro: ${uploadResult?.error || 'Erro desconhecido'}`, 'bot');
      }
      
      return;
    }
    
    // Se só há texto (sem ficheiro)
    this.addMessage(text, 'user');
    this.saveToHistory({ role: 'user', content: text });
    await this.sendTextOnly(text);
  }
  
  /**
   * Envia apenas mensagem de texto
   */
  async sendTextOnly(text) {
    try {
      // Use SSE streaming for direct AI chat
      const streamSupported = !text.startsWith('executa') && !text.startsWith('run:') && !text.startsWith('cria um pdf');
      
      if (streamSupported) {
        await this.sendMessageStream(text);
      } else {
        // Non-streamable commands go through normal route
        this.showTyping();
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ message: text }));
        } else {
          const response = await fetch(`${this.apiUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
          });
          
          const data = await response.json();
          this.hideTyping();
          
          if (data.response) {
            this.addMessage(data.response, 'bot');
            this.saveToHistory({ role: 'assistant', content: data.response });
            this.speak(data.speakableText || data.response);
          }
        }
      }
    } catch (error) {
      this.hideTyping();
      this.addMessage('Erro de conexão. Verifique se o servidor está ativo.', 'bot');
    }
  }
  
  /**
   * Envia mensagem com streaming SSE — tokens aparecem em tempo real
   */
  async sendMessageStream(text) {
    // Create bot message placeholder for streaming
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot';
    
    const time = new Date().toLocaleTimeString('pt-PT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    msgDiv.innerHTML = `
      <div class="message-bubble streaming-bubble">
        <span class="streaming-cursor">▊</span>
      </div>
      <div class="message-time">${time}</div>
    `;
    
    this.elements.chatContainer.appendChild(msgDiv);
    this.scrollToBottom();
    
    const bubble = msgDiv.querySelector('.message-bubble');
    let fullText = '';
    
    try {
      const response = await fetch(`${this.apiUrl}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      
      // Verificar se é JSON (intent handler) ou SSE (stream)
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // Intent específico (não 'chat') — resposta JSON normal
        msgDiv.remove(); // Remover placeholder de streaming
        const data = await response.json();
        this.addMessage(data.text || data.response || 'Sem resposta', 'bot');
        this.speak(data.speakableText || data.text || '');
        return;
      }
      
      // SSE streaming normal
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(trimmed.slice(6));
            
            if (data.type === 'token') {
              fullText += data.token;
              bubble.innerHTML = this.processContent(fullText) + '<span class="streaming-cursor">▊</span>';
              this.scrollToBottom();
            } else if (data.type === 'done') {
              // Final render with full markdown
              bubble.classList.remove('streaming-bubble');
              bubble.innerHTML = this.processContent(fullText);
              this.addCopyButtons(bubble);
              this.saveToHistory({ role: 'assistant', content: fullText });
              this.speak(fullText);
            } else if (data.type === 'error') {
              bubble.innerHTML = `❌ ${data.message}`;
            }
          } catch {}
        }
      }
      
      // Ensure final render if stream ended without done event
      if (fullText && bubble.querySelector('.streaming-cursor')) {
        bubble.classList.remove('streaming-bubble');
        bubble.innerHTML = this.processContent(fullText);
        this.addCopyButtons(bubble);
        this.saveToHistory({ role: 'assistant', content: fullText });
      }
      
    } catch (error) {
      bubble.innerHTML = `❌ Erro de streaming: ${error.message}`;
    }
  }
  
  addMessage(content, type) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    
    const time = new Date().toLocaleTimeString('pt-PT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Processar markdown completo para mensagens bot
    const processed = type === 'bot' ? this.processContent(content) : this.escapeHtml(content).replace(/\n/g, '<br>');
    
    div.innerHTML = `
      <div class="message-bubble">${processed}</div>
      <div class="message-meta">
        <span class="message-time">${time}</span>
        <button class="copy-msg-btn" title="Copiar mensagem">📋</button>
      </div>
    `;
    
    // Copy message button
    div.querySelector('.copy-msg-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        const btn = div.querySelector('.copy-msg-btn');
        btn.textContent = '✅';
        setTimeout(() => { btn.textContent = '📋'; }, 1500);
      });
    });
    
    // Add copy buttons to code blocks
    if (type === 'bot') {
      this.addCopyButtons(div.querySelector('.message-bubble'));
    }
    
    this.elements.chatContainer.appendChild(div);
    this.scrollToBottom();
  }
  
  /**
   * Adiciona botões de copiar a cada bloco de código
   */
  addCopyButtons(container) {
    if (!container) return;
    container.querySelectorAll('pre').forEach(pre => {
      if (pre.querySelector('.code-copy-btn')) return; // já tem
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = 'Copiar';
      btn.addEventListener('click', () => {
        const code = pre.querySelector('code')?.textContent || pre.textContent;
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = '✅ Copiado';
          setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
        });
      });
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }
  
  escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  
  processContent(text) {
    if (!text) return '';
    
    // Se marked.js está disponível, usar markdown completo
    if (typeof marked !== 'undefined') {
      try {
        // Configurar marked com highlight.js
        marked.setOptions({
          highlight: function(code, lang) {
            if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
              return hljs.highlight(code, { language: lang }).value;
            }
            if (typeof hljs !== 'undefined') {
              return hljs.highlightAuto(code).value;
            }
            return code;
          },
          breaks: true,
          gfm: true
        });
        return marked.parse(text);
      } catch (e) {
        console.warn('Marked error, fallback:', e);
      }
    }
    
    // Fallback: markdown básico manual
    let processed = this.escapeHtml(text);
    processed = processed.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/\n/g, '<br>');
    return processed;
  }
  
  showTyping() {
    const div = document.createElement('div');
    div.className = 'message bot typing';
    div.innerHTML = `
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    this.elements.chatContainer.appendChild(div);
    this.scrollToBottom();
  }
  
  hideTyping() {
    const typing = this.elements.chatContainer.querySelector('.typing');
    if (typing) typing.remove();
  }
  
  scrollToBottom() {
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
  }
  
  // ═══════════════════════════════════════════════════════════
  // SPEECH RECOGNITION
  // ═══════════════════════════════════════════════════════════
  
  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.log('Speech Recognition não suportado');
      this.elements.voiceBtn.style.opacity = '0.5';
      this.elements.voiceBtn.title = 'Voz não suportada neste browser';
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'pt-PT';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    
    this.recognition.onstart = () => {
      this.isListening = true;
      this.elements.voiceBtn.classList.add('listening');
      this.elements.voiceStatus.textContent = '🎤 A ouvir... fala agora (clica 🎤 para parar)';
    };
    
    this.recognition.onresult = (event) => {
      let sessionFinal = '';
      let interim = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          sessionFinal += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      if (sessionFinal) {
        this.voiceTranscript += sessionFinal;
      }
      
      const displayText = this.voiceTranscript + interim;
      this.elements.input.value = displayText;
      this.elements.voiceStatus.textContent = displayText
        ? `🎤 ${displayText}`
        : '🎤 A ouvir... fala agora';
    };
    
    this.recognition.onend = () => {
      // If still supposed to be listening, auto-restart
      if (this.isListening) {
        this._restartRecognition();
        return;
      }
      
      // User explicitly stopped — do NOT auto-send
      this.elements.voiceBtn.classList.remove('listening');
      
      const text = this.elements.input.value.trim();
      if (text) {
        this.elements.voiceStatus.textContent = '✅ Texto capturado — clica ➤ ou Enter para enviar';
        setTimeout(() => {
          if (this.elements.voiceStatus.textContent.startsWith('✅')) {
            this.elements.voiceStatus.textContent = '';
          }
        }, 5000);
      } else {
        this.elements.voiceStatus.textContent = '';
      }
    };
    
    this.recognition.onerror = (event) => {
      console.log('Speech error:', event.error);
      
      if (event.error === 'no-speech') {
        this.elements.voiceStatus.textContent = '🎤 Não ouvi nada... continua a falar';
        return;
      }
      if (event.error === 'aborted' || event.error === 'network') {
        return; // onend will handle restart
      }
      
      // Fatal error
      this.isListening = false;
      this.elements.voiceBtn.classList.remove('listening');
      
      if (event.error === 'not-allowed') {
        this.elements.voiceStatus.textContent = '❌ Microfone bloqueado — permite o acesso';
      } else {
        this.elements.voiceStatus.textContent = `❌ Erro: ${event.error}`;
      }
      setTimeout(() => { this.elements.voiceStatus.textContent = ''; }, 4000);
    };
  }
  
  _restartRecognition(attempt = 0) {
    if (!this.isListening) return;
    
    const delay = attempt === 0 ? 100 : 500;
    setTimeout(() => {
      if (!this.isListening) return;
      try {
        this.recognition.start();
      } catch (e) {
        if (attempt < 3) {
          this._restartRecognition(attempt + 1);
        } else {
          this.isListening = false;
          this.elements.voiceBtn.classList.remove('listening');
          this.elements.voiceStatus.textContent = '❌ Microfone parou — clica 🎤 para tentar de novo';
          setTimeout(() => { this.elements.voiceStatus.textContent = ''; }, 4000);
        }
      }
    }, delay);
  }
  
  toggleVoice() {
    if (!this.recognition) {
      alert('Reconhecimento de voz não suportado neste browser');
      return;
    }
    
    if (this.isListening) {
      // Stop — text stays in input
      this.isListening = false;
      try { this.recognition.stop(); } catch (e) {}
    } else {
      // Start — clear previous transcript
      this.voiceTranscript = '';
      this.elements.input.value = '';
      this.elements.voiceStatus.textContent = '';
      try {
        this.recognition.start();
      } catch (e) {
        this.elements.voiceStatus.textContent = '❌ Não foi possível iniciar o microfone';
        setTimeout(() => { this.elements.voiceStatus.textContent = ''; }, 3000);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // TEXT-TO-SPEECH (TTS)
  // ═══════════════════════════════════════════════════════════
  
  setupTTS() {
    this.updateTTSButton();
  }
  
  toggleTTS() {
    this.ttsEnabled = !this.ttsEnabled;
    localStorage.setItem('mybot_tts_enabled', this.ttsEnabled.toString());
    this.updateTTSButton();
    
    if (!this.ttsEnabled) {
      window.speechSynthesis?.cancel();
    }
  }
  
  updateTTSButton() {
    if (!this.elements.ttsIcon) return;
    if (this.ttsEnabled) {
      this.elements.ttsIcon.textContent = '🔊';
      this.elements.btnTTS.classList.add('active');
      this.elements.btnTTS.title = 'Desativar voz de resposta';
    } else {
      this.elements.ttsIcon.textContent = '🔇';
      this.elements.btnTTS.classList.remove('active');
      this.elements.btnTTS.title = 'Ativar voz de resposta';
    }
  }
  
  /**
   * Limpa texto para TTS - remove emojis, código, paths, caracteres especiais
   */
  cleanTextForTTS(text) {
    if (!text) return '';
    
    let cleaned = text;
    
    // Remover emojis
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/[\u{FE00}-\u{FE0F}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F900}-\u{1F9FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{200D}\u{20E3}\u{FE0F}]/gu, '');
    
    // Remover blocos de código inteiros
    cleaned = cleaned.replace(/```[\s\S]*?```/g, ' bloco de código ');
    
    // Remover código inline
    cleaned = cleaned.replace(/`[^`]+`/g, '');
    
    // Remover caminhos de ficheiros
    cleaned = cleaned.replace(/(?:[A-Z]:)?(?:[\\\/][\w.\-@]+)+\.\w+/gi, '');
    cleaned = cleaned.replace(/(?:[A-Z]:)?(?:[\\\/][\w.\-@]+){2,}/gi, '');
    
    // Remover nomes de ficheiros com extensões comuns
    cleaned = cleaned.replace(/\b[\w\-]+\.(?:js|ts|py|html|css|json|pdf|txt|md|jpg|png|gif|svg|xml|yaml|yml|log|csv|sh|bat|exe|zip|tar|gz|doc|docx|xls|xlsx|mp3|mp4|wav)\b/gi, '');
    
    // Remover URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remover formatação markdown
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/#{1,6}\s/g, '');
    cleaned = cleaned.replace(/^\s*[-*]\s/gm, '');
    cleaned = cleaned.replace(/^\s*\d+\.\s/gm, '');
    
    // Remover linhas técnicas
    cleaned = cleaned.replace(/^.*(?:Localização|Tamanho|Formato|Extensão|Caminho|Path|Size|Location)\s*:.*$/gim, '');
    
    // Remover números longos e tamanhos
    cleaned = cleaned.replace(/\b\d{5,}\b/g, '');
    cleaned = cleaned.replace(/\b\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB|bytes)\b/gi, '');
    
    // Limpar espaços
    cleaned = cleaned.replace(/\n\s*\n/g, '\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.trim();
    
    return cleaned;
  }
  
  speak(text) {
    if (!('speechSynthesis' in window)) return;
    if (!this.ttsEnabled) return;
    if (!text) return;
    
    // Usar limpeza avançada
    const clean = this.cleanTextForTTS(text);
    if (!clean) return;
    
    // Limitar comprimento para TTS
    let finalText = clean;
    if (finalText.length > 500) {
      finalText = finalText.substring(0, 500) + '... fim da leitura.';
    }
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(finalText);
    utterance.lang = 'pt-PT';
    utterance.rate = 1;
    utterance.pitch = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;
    
    window.speechSynthesis.speak(utterance);
  }
  
  // ═══════════════════════════════════════════════════════════
  // LOCAL STORAGE
  // ═══════════════════════════════════════════════════════════
  
  saveToHistory(message) {
    try {
      const history = JSON.parse(localStorage.getItem('mybot_history') || '[]');
      history.push({ ...message, time: Date.now() });
      
      // Keep last 50 messages
      if (history.length > 50) history.shift();
      
      localStorage.setItem('mybot_history', JSON.stringify(history));
    } catch (e) {
      console.log('Storage error:', e);
    }
  }
  
  loadHistory() {
    try {
      const history = JSON.parse(localStorage.getItem('mybot_history') || '[]');
      
      if (history.length > 0) {
        this.elements.welcome.classList.add('hidden');
        
        // Last 10 messages
        history.slice(-10).forEach(msg => {
          this.addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot');
        });
      }
    } catch (e) {
      console.log('Load history error:', e);
    }
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new MyBotApp();
});
