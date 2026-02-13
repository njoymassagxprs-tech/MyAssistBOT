/**
 * 🤖 MyAssistBOT - Discord Bot
 * Bot de Discord com comandos slash (i18n)
 */

require('dotenv').config();
const i18n = require('../i18n/i18n');

class DiscordBot {
  constructor() {
    this.token = process.env.DISCORD_BOT_TOKEN;
    this.applicationId = process.env.DISCORD_APP_ID || '';
    this.apiBase = 'https://discord.com/api/v10';
    this.orchestrator = null;
    this.ws = null;
    this.heartbeatInterval = null;
    this.sessionId = null;
    this.resumeUrl = null;
    this.sequence = null;
    
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
      console.log('⚠️  Orquestrador não disponível');
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // DISCORD API
  // ═══════════════════════════════════════════════════════════
  
  async api(method, endpoint, body = null) {
    try {
      const options = {
        method,
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json'
        }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(`${this.apiBase}${endpoint}`, options);
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Discord API error: ${response.status} - ${error}`);
        return null;
      }
      
      if (response.status === 204) return {};
      return response.json();
    } catch (error) {
      console.error('❌ Discord request failed:', error.message);
      return null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // GATEWAY WEBSOCKET
  // ═══════════════════════════════════════════════════════════
  
  async connect() {
    console.log('🎮 Discord Bot a iniciar...');
    
    if (!this.token) {
      console.error('❌ DISCORD_BOT_TOKEN não definido no .env');
      return;
    }
    
    // Get gateway URL
    const gateway = await this.api('GET', '/gateway/bot');
    if (!gateway) {
      console.error('❌ Falha ao obter gateway URL');
      return;
    }
    
    const wsUrl = `${gateway.url}?v=10&encoding=json`;
    console.log('🔌 Conectando ao gateway...');
    
    this.ws = new (require('ws'))(wsUrl);
    
    this.ws.on('open', () => {
      console.log('✅ Gateway conectado');
    });
    
    this.ws.on('message', (data) => {
      this.handleGatewayMessage(JSON.parse(data.toString()));
    });
    
    this.ws.on('close', (code) => {
      console.log(`⚠️  Gateway desconectado: ${code}`);
      clearInterval(this.heartbeatInterval);
      
      // Reconectar
      setTimeout(() => this.connect(), 5000);
    });
    
    this.ws.on('error', (error) => {
      console.error('❌ Gateway error:', error.message);
    });
  }
  
  handleGatewayMessage(payload) {
    const { op, t, s, d } = payload;
    
    if (s) this.sequence = s;
    
    switch (op) {
      case 10: // Hello
        this.startHeartbeat(d.heartbeat_interval);
        this.identify();
        break;
      
      case 11: // Heartbeat ACK
        break;
      
      case 0: // Dispatch
        this.handleDispatch(t, d);
        break;
      
      case 7: // Reconnect
        this.ws.close();
        break;
      
      case 9: // Invalid Session
        setTimeout(() => this.identify(), 5000);
        break;
    }
  }
  
  startHeartbeat(interval) {
    this.heartbeatInterval = setInterval(() => {
      this.ws.send(JSON.stringify({
        op: 1,
        d: this.sequence
      }));
    }, interval);
  }
  
  identify() {
    this.ws.send(JSON.stringify({
      op: 2,
      d: {
        token: this.token,
        intents: 513 | 32768, // Guilds + Message Content
        properties: {
          os: 'linux',
          browser: 'mybot',
          device: 'mybot'
        }
      }
    }));
  }
  
  // ═══════════════════════════════════════════════════════════
  // EVENT DISPATCH
  // ═══════════════════════════════════════════════════════════
  
  handleDispatch(event, data) {
    switch (event) {
      case 'READY':
        this.sessionId = data.session_id;
        this.resumeUrl = data.resume_gateway_url;
        console.log(`✅ Bot online: ${data.user.username}#${data.user.discriminator}`);
        console.log(`📊 Em ${data.guilds.length} servidores`);
        this.registerCommands();
        break;
      
      case 'MESSAGE_CREATE':
        this.handleMessage(data);
        break;
      
      case 'INTERACTION_CREATE':
        this.handleInteraction(data);
        break;
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // SLASH COMMANDS
  // ═══════════════════════════════════════════════════════════
  
  async registerCommands() {
    const commands = [
      {
        name: 'ask',
        description: this.t('bot.ask_question'),
        options: [{
          name: 'question',
          description: this.t('bot.your_question'),
          type: 3,
          required: true
        }]
      },
      {
        name: 'pdf',
        description: this.t('bot.create_pdf'),
        options: [{
          name: 'description',
          description: this.t('bot.doc_description'),
          type: 3,
          required: true
        }]
      },
      {
        name: 'code',
        description: this.t('bot.run_code'),
        options: [{
          name: 'code',
          description: this.t('bot.code_to_run'),
          type: 3,
          required: true
        }]
      },
      {
        name: 'status',
        description: this.t('bot.view_status')
      },
      {
        name: 'help',
        description: this.t('bot.view_help')
      }
    ];
    
    // Register global commands
    const me = await this.api('GET', '/users/@me');
    if (!me) return;
    
    const result = await this.api('PUT', `/applications/${me.id}/commands`, commands);
    
    if (result) {
      console.log(`✅ ${commands.length} comandos registados`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // MESSAGE HANDLING
  // ═══════════════════════════════════════════════════════════
  
  async handleMessage(message) {
    // Ignorar bots
    if (message.author.bot) return;
    
    // Verificar menção
    const botMention = `<@${this.applicationId}>`;
    const isMentioned = message.content.includes(botMention) || 
                        message.content.startsWith('!mybot');
    
    if (!isMentioned) return;
    
    // Limpar menção
    const text = message.content
      .replace(/<@!?\d+>/g, '')
      .replace(/^!mybot\s*/i, '')
      .trim();
    
    if (!text) return;
    
    console.log(`📩 [${message.author.username}] ${text}`);
    
    // Typing indicator
    await this.api('POST', `/channels/${message.channel_id}/typing`);
    
    // Processar
    await this.processMessage(message.channel_id, text, message.author);
  }
  
  // ═══════════════════════════════════════════════════════════
  // INTERACTION HANDLING
  // ═══════════════════════════════════════════════════════════
  
  async handleInteraction(interaction) {
    if (interaction.type !== 2) return; // APPLICATION_COMMAND
    
    const { name, options } = interaction.data;
    const userId = interaction.member?.user?.id || interaction.user?.id;
    const userName = interaction.member?.user?.username || interaction.user?.username;
    
    console.log(`🔧 Comando: /${name} por ${userName}`);
    
    // Defer response (thinking...)
    await this.interactionRespond(interaction.id, interaction.token, {
      type: 5 // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });
    
    let response;
    
    switch (name) {
      case 'ask':
        response = await this.cmdAsk(options[0].value, userId, userName);
        break;
      
      case 'pdf':
        response = await this.cmdPdf(options[0].value);
        break;
      
      case 'code':
        response = await this.cmdCode(options[0].value);
        break;
      
      case 'status':
        response = this.cmdStatus();
        break;
      
      case 'help':
        response = this.cmdHelp();
        break;
      
      default:
        response = this.t('bot.unknown_cmd', {}, userId);
    }
    
    // Edit deferred response
    await this.editInteraction(interaction.token, response);
  }
  
  async interactionRespond(id, token, data) {
    await this.api('POST', `/interactions/${id}/${token}/callback`, data);
  }
  
  async editInteraction(token, content) {
    // Garantir que content é string
    if (typeof content !== 'string') {
      content = typeof content === 'object' ? (content.text || content.response || JSON.stringify(content)) : String(content);
    }
    
    // Truncar se muito longo
    if (content.length > 2000) {
      content = content.substring(0, 1997) + '...';
    }
    
    await this.api('PATCH', `/webhooks/${this.applicationId}/${token}/messages/@original`, {
      content
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // COMMANDS
  // ═══════════════════════════════════════════════════════════
  
  async cmdAsk(question, userId, userName) {
    try {
      if (this.orchestrator) {
        const result = await this.orchestrator(question, {
          userId,
          platform: 'discord',
          userName
        });
        return typeof result === 'object' ? (result.text || result.response || JSON.stringify(result)) : (result || this.t('bot.no_response', {}, userId));
      }
      return this.t('bot.orchestrator_unavailable', {}, userId);
    } catch (e) {
      return this.t('bot.code_error', { message: e.message }, userId);
    }
  }
  
  async cmdPdf(description) {
    try {
      if (this.orchestrator) {
        const result = await this.orchestrator(`Criar um documento PDF sobre: ${description}`, {
          platform: 'discord'
        });
        return typeof result === 'object' ? (result.text || result.response || JSON.stringify(result)) : (result || this.t('bot.no_response'));
      }
      return this.t('bot.orchestrator_unavailable');
    } catch (e) {
      return this.t('bot.pdf_error', { message: e.message });
    }
  }
  
  async cmdCode(code) {
    try {
      if (this.orchestrator) {
        const result = await this.orchestrator(`Executar código: \`\`\`js\n${code}\n\`\`\``, {
          platform: 'discord'
        });
        return typeof result === 'object' ? (result.text || result.response || JSON.stringify(result)) : (result || this.t('bot.no_response'));
      }
      return this.t('bot.orchestrator_unavailable');
    } catch (e) {
      return this.t('bot.code_error', { message: e.message });
    }
  }
  
  cmdStatus() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    
    return this.t('bot.status', {
      hours, mins,
      model: process.env.MODEL || 'llama-3.3-70b',
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    });
  }
  
  cmdHelp() {
    return this.t('bot.discord_help');
  }
  
  // ═══════════════════════════════════════════════════════════
  // PROCESS MESSAGE
  // ═══════════════════════════════════════════════════════════
  
  async processMessage(channelId, text, author) {
    try {
      let response;
      
      if (this.orchestrator) {
        const result = await this.orchestrator(text, {
          userId: author.id,
          platform: 'discord',
          userName: author.username
        });
        response = typeof result === 'object' ? (result.text || result.response || JSON.stringify(result)) : (result || this.t('bot.no_response', {}, author.id));
      } else {
        response = this.t('bot.orchestrator_unavailable', {}, author.id);
      }
      
      // Truncar se muito longo
      if (response.length > 2000) {
        response = response.substring(0, 1997) + '...';
      }
      
      await this.api('POST', `/channels/${channelId}/messages`, {
        content: response
      });
    } catch (error) {
      console.error('❌ Process error:', error);
      await this.api('POST', `/channels/${channelId}/messages`, {
        content: this.t('bot.process_error', {}, author.id)
      });
    }
  }
}

// Run bot
if (require.main === module) {
  const bot = new DiscordBot();
  bot.connect();
}

module.exports = DiscordBot;
