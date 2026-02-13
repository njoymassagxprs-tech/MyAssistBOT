/**
 * 🤖 MyAssistBOT - Telegram Bot
 * Bot de Telegram integrado com o orquestrador (i18n)
 */

require('dotenv').config();
const i18n = require('../i18n/i18n');

class TelegramBot {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.apiUrl = `https://api.telegram.org/bot${this.token}`;
    this.offset = 0;
    this.orchestrator = null;
    
    i18n.init();
    this.loadOrchestrator();
  }
  
  t(key, vars, userId) {
    return i18n.t(key, vars, userId);
  }
  
  async loadOrchestrator() {
    try {
      const { handlePrompt } = require('../orchestrator/orchestrator');
      this.orchestrator = handlePrompt;
      console.log('✅ Orquestrador carregado');
    } catch (e) {
      console.log('⚠️  Orquestrador não disponível, usando modo simples');
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // TELEGRAM API
  // ═══════════════════════════════════════════════════════════
  
  async api(method, params = {}) {
    try {
      const url = new URL(`${this.apiUrl}/${method}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      
      const data = await response.json();
      
      if (!data.ok) {
        console.error(`❌ Telegram API error: ${data.description}`);
        return null;
      }
      
      return data.result;
    } catch (error) {
      console.error('❌ Telegram request failed:', error.message);
      return null;
    }
  }
  
  async sendMessage(chatId, text, options = {}) {
    return this.api('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...options
    });
  }
  
  async sendTyping(chatId) {
    return this.api('sendChatAction', {
      chat_id: chatId,
      action: 'typing'
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // POLLING
  // ═══════════════════════════════════════════════════════════
  
  async getUpdates() {
    const updates = await this.api('getUpdates', {
      offset: this.offset,
      timeout: 30,
      allowed_updates: ['message', 'callback_query']
    });
    
    if (updates && updates.length > 0) {
      for (const update of updates) {
        await this.handleUpdate(update);
        this.offset = update.update_id + 1;
      }
    }
    
    return updates;
  }
  
  async startPolling() {
    console.log('🤖 Telegram Bot a iniciar...');
    
    // Verificar token
    if (!this.token) {
      console.error('❌ TELEGRAM_BOT_TOKEN não definido no .env');
      return;
    }
    
    // Verificar conexão
    const me = await this.api('getMe');
    if (!me) {
      console.error('❌ Falha ao conectar com Telegram API');
      return;
    }
    
    console.log(`✅ Bot conectado: @${me.username}`);
    console.log('📩 À espera de mensagens...\n');
    
    // Polling loop
    while (true) {
      try {
        await this.getUpdates();
      } catch (error) {
        console.error('⚠️  Polling error:', error.message);
        await this.sleep(5000);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // MESSAGE HANDLING
  // ═══════════════════════════════════════════════════════════
  
  async handleUpdate(update) {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallback(update.callback_query);
    }
  }
  
  async handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const user = message.from;
    
    console.log(`📩 [${user.first_name}] ${text}`);
    
    // Comandos especiais
    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, user);
      return;
    }
    
    // Mensagem normal - processar com orquestrador
    await this.processMessage(chatId, text, user);
  }
  
  async handleCommand(chatId, text, user) {
    const [command, ...args] = text.split(' ');
    const argText = args.join(' ');
    
    switch (command) {
      case '/start':
        await this.cmdStart(chatId, user);
        break;
      
      case '/help':
        await this.cmdHelp(chatId);
        break;
      
      case '/pdf':
        await this.cmdPdf(chatId, argText);
        break;
      
      case '/code':
        await this.cmdCode(chatId, argText);
        break;
      
      case '/status':
        await this.cmdStatus(chatId);
        break;
      
      default:
        await this.sendMessage(chatId, 
          this.t('bot.unknown_cmd', {}, chatId.toString())
        );
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // COMMANDS
  // ═══════════════════════════════════════════════════════════
  
  async cmdStart(chatId, user) {
    const name = user.first_name || 'amigo';
    await this.sendMessage(chatId, this.t('bot.welcome', { name }, chatId.toString()));
  }
  
  async cmdHelp(chatId) {
    await this.sendMessage(chatId, this.t('bot.help', {}, chatId.toString()));
  }
  
  async cmdPdf(chatId, description) {
    if (!description) {
      await this.sendMessage(chatId, 
        this.t('bot.pdf_usage', {}, chatId.toString())
      );
      return;
    }
    
    await this.sendTyping(chatId);
    
    try {
      const result = await this.orchestrator(`Criar um documento PDF sobre: ${description}`, {
        userId: chatId.toString(),
        platform: 'telegram'
      });
      
      const response = typeof result === 'object' ? (result.text || result.response || JSON.stringify(result)) : (result || this.t('bot.no_response', {}, chatId.toString()));
      await this.sendMessage(chatId, response);
    } catch (e) {
      await this.sendMessage(chatId, this.t('bot.pdf_error', { message: e.message }, chatId.toString()));
    }
  }
  
  async cmdCode(chatId, code) {
    if (!code) {
      await this.sendMessage(chatId, 
        this.t('bot.code_usage', {}, chatId.toString())
      );
      return;
    }
    
    await this.sendTyping(chatId);
    
    try {
      const result = await this.orchestrator(`Executar este código: \`\`\`${code}\`\`\``, {
        userId: chatId.toString(),
        platform: 'telegram'
      });
      
      const response = typeof result === 'object' ? (result.text || result.response || JSON.stringify(result)) : (result || this.t('bot.no_response', {}, chatId.toString()));
      await this.sendMessage(chatId, response);
    } catch (e) {
      await this.sendMessage(chatId, this.t('bot.code_error', { message: e.message }, chatId.toString()));
    }
  }
  
  async cmdStatus(chatId) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    
    await this.sendMessage(chatId, this.t('bot.status', {
      hours, mins,
      model: process.env.MODEL || 'llama-3.3-70b',
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    }, chatId.toString()));
  }
  
  // ═══════════════════════════════════════════════════════════
  // PROCESS MESSAGE
  // ═══════════════════════════════════════════════════════════
  
  async processMessage(chatId, text, user) {
    // Typing indicator
    await this.sendTyping(chatId);
    
    try {
      // Usar orquestrador
      if (this.orchestrator) {
        const result = await this.orchestrator(text, {
          userId: chatId.toString(),
          platform: 'telegram',
          userName: user.first_name
        });
        
        // Extrair texto da resposta (pode ser string ou objeto com .text/.response)
        const response = typeof result === 'object' ? (result.text || result.response || JSON.stringify(result)) : (result || this.t('bot.no_response', {}, chatId.toString()));
        
        // Dividir mensagens longas
        await this.sendLongMessage(chatId, response);
      } else {
        await this.sendMessage(chatId, 
          this.t('bot.orchestrator_unavailable', {}, chatId.toString())
        );
      }
    } catch (error) {
      console.error('❌ Process error:', error);
      await this.sendMessage(chatId, 
        this.t('bot.process_error', {}, chatId.toString())
      );
    }
  }
  
  async sendLongMessage(chatId, text) {
    // Garantir que text é string
    if (typeof text !== 'string') {
      text = typeof text === 'object' ? (text.text || text.response || JSON.stringify(text)) : String(text);
    }
    
    // Telegram limit: 4096 chars
    const MAX_LENGTH = 4000;
    
    if (text.length <= MAX_LENGTH) {
      await this.sendMessage(chatId, text);
      return;
    }
    
    // Dividir por parágrafos/linhas
    const parts = [];
    let current = '';
    
    for (const line of text.split('\n')) {
      if ((current + line).length > MAX_LENGTH) {
        if (current) parts.push(current.trim());
        current = line + '\n';
      } else {
        current += line + '\n';
      }
    }
    if (current) parts.push(current.trim());
    
    // Enviar cada parte
    for (let i = 0; i < parts.length; i++) {
      const part = parts.length > 1 
        ? `(${i + 1}/${parts.length})\n\n${parts[i]}`
        : parts[i];
      await this.sendMessage(chatId, part);
      await this.sleep(500);
    }
  }
  
  async handleCallback(query) {
    // Handle inline button callbacks
    const chatId = query.message.chat.id;
    const data = query.data;
    
    console.log(`🔘 Callback: ${data}`);
    
    // Acknowledge callback
    await this.api('answerCallbackQuery', {
      callback_query_id: query.id
    });
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run bot
if (require.main === module) {
  const bot = new TelegramBot();
  bot.startPolling();
}

module.exports = TelegramBot;
