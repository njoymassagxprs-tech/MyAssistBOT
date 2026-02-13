/**
 * ⚙️ MyAssistBOT Setup Wizard
 * Configuração interativa de API keys e preferências
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

class SetupWizard {
  constructor() {
    this.envPath = path.join(__dirname, '.env');
    this.config = {};
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  
  async run() {
    this.clear();
    this.banner();
    
    console.log('\n🔧 Vamos configurar o MyAssistBOT!\n');
    console.log('━'.repeat(50));
    
    // Verificar se já existe .env
    if (fs.existsSync(this.envPath)) {
      const overwrite = await this.ask('\n⚠️  Ficheiro .env já existe. Substituir? (s/n)', 'n');
      if (overwrite.toLowerCase() !== 's') {
        console.log('\n✅ Configuração mantida. A sair...');
        this.rl.close();
        return;
      }
    }
    
    console.log('\n📝 Responde às perguntas seguintes.\n');
    console.log('   (Enter para usar valor default)\n');
    
    // 1. Groq API Key
    console.log('━'.repeat(50));
    console.log('1️⃣  GROQ API (IA Principal - Gratuito)');
    console.log('   Obtém em: https://console.groq.com/keys');
    console.log('━'.repeat(50));
    this.config.GROQ_API_KEY = await this.ask('   GROQ_API_KEY:', '');
    
    if (!this.config.GROQ_API_KEY) {
      console.log('\n   ⚠️  Sem GROQ_API_KEY, o bot não funcionará.');
    }
    
    // 2. Model
    console.log('\n━'.repeat(50));
    console.log('2️⃣  MODELO DE IA');
    console.log('   Recomendado: llama-3.3-70b-versatile (mais inteligente)');
    console.log('   Alternativa: mixtral-8x7b-32768 (backup rápido)');
    console.log('━'.repeat(50));
    this.config.MODEL = await this.ask('   MODEL:', 'llama-3.3-70b-versatile');
    
    // 3. Telegram (Opcional)
    console.log('\n━'.repeat(50));
    console.log('3️⃣  TELEGRAM BOT (Opcional)');
    console.log('   Obtém via @BotFather no Telegram');
    console.log('━'.repeat(50));
    const useTelegram = await this.ask('   Configurar Telegram? (s/n):', 'n');
    
    if (useTelegram.toLowerCase() === 's') {
      this.config.TELEGRAM_BOT_TOKEN = await this.ask('   TELEGRAM_BOT_TOKEN:', '');
    }
    
    // 4. Discord (Opcional)
    console.log('\n━'.repeat(50));
    console.log('4️⃣  DISCORD BOT (Opcional)');
    console.log('   Obtém em: https://discord.com/developers/applications');
    console.log('━'.repeat(50));
    const useDiscord = await this.ask('   Configurar Discord? (s/n):', 'n');
    
    if (useDiscord.toLowerCase() === 's') {
      this.config.DISCORD_BOT_TOKEN = await this.ask('   DISCORD_BOT_TOKEN:', '');
    }
    
    // 5. Portas
    console.log('\n━'.repeat(50));
    console.log('5️⃣  CONFIGURAÇÃO DE PORTAS');
    console.log('━'.repeat(50));
    this.config.PORT = await this.ask('   PORT (Servidor principal):', '7777');
    this.config.WEBHOOK_PORT = await this.ask('   WEBHOOK_PORT (Dev webhooks):', '3002');
    
    // 6. Idioma
    console.log('\n' + '━'.repeat(50));
    console.log('6️⃣  IDIOMA / LANGUAGE');
    console.log('   pt = Português | en = English | es = Español | fr = Français');
    console.log('━'.repeat(50));
    this.config.LANGUAGE = await this.ask('   LANGUAGE:', 'pt');
    
    // 7. Provedores IA adicionais
    console.log('\n' + '━'.repeat(50));
    console.log('7️⃣  PROVEDORES IA ADICIONAIS (Opcional)');
    console.log('   Fallback automático se Groq falhar');
    console.log('━'.repeat(50));
    const useExtra = await this.ask('   Configurar provedores extra? (s/n):', 'n');
    
    if (useExtra.toLowerCase() === 's') {
      this.config.CEREBRAS_API_KEY = await this.ask('   CEREBRAS_API_KEY:', '');
      this.config.GEMINI_API_KEY = await this.ask('   GEMINI_API_KEY:', '');
      this.config.HF_API_KEY = await this.ask('   HF_API_KEY:', '');
      this.config.OLLAMA_URL = await this.ask('   OLLAMA_URL:', '');
    }
    
    // 8. Segurança
    console.log('\n' + '━'.repeat(50));
    console.log('8️⃣  SEGURANÇA');
    console.log('━'.repeat(50));
    this.config.JWT_SECRET = await this.ask('   JWT_SECRET:', this.generateSecret());
    
    // Gerar ficheiro .env
    this.saveEnv();
    
    // Resumo
    this.showSummary();
    
    this.rl.close();
  }
  
  ask(question, defaultValue) {
    return new Promise(resolve => {
      const prompt = defaultValue ? `${question} [${defaultValue}] ` : `${question} `;
      this.rl.question(prompt, answer => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }
  
  generateSecret() {
    return 'mybot_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  saveEnv() {
    const lines = [
      '# ═══════════════════════════════════════════════════════════',
      '# 🤖 MyAssistBOT Configuration',
      '# Gerado pelo Setup Wizard em ' + new Date().toISOString(),
      '# ═══════════════════════════════════════════════════════════',
      '',
      '# ── AI Provider ──',
      `GROQ_API_KEY=${this.config.GROQ_API_KEY || ''}`,
      `MODEL=${this.config.MODEL}`,
      '',
      '# ── Idioma ──',
      `LANGUAGE=${this.config.LANGUAGE || 'pt'}`,
      '',
      '# ── Portas ──',
      `PORT=${this.config.PORT}`,
      `WEBHOOK_PORT=${this.config.WEBHOOK_PORT}`,
      '',
      '# ── Segurança ──',
      `JWT_SECRET=${this.config.JWT_SECRET}`,
      ''
    ];
    
    if (this.config.TELEGRAM_BOT_TOKEN) {
      lines.push('# ── Telegram ──');
      lines.push(`TELEGRAM_BOT_TOKEN=${this.config.TELEGRAM_BOT_TOKEN}`);
      lines.push('');
    }
    
    if (this.config.DISCORD_BOT_TOKEN) {
      lines.push('# ── Discord ──');
      lines.push(`DISCORD_BOT_TOKEN=${this.config.DISCORD_BOT_TOKEN}`);
      lines.push('');
    }
    
    // Provedores adicionais
    const extraProviders = [];
    if (this.config.CEREBRAS_API_KEY) extraProviders.push(`CEREBRAS_API_KEY=${this.config.CEREBRAS_API_KEY}`);
    if (this.config.GEMINI_API_KEY) extraProviders.push(`GEMINI_API_KEY=${this.config.GEMINI_API_KEY}`);
    if (this.config.HF_API_KEY) extraProviders.push(`HF_API_KEY=${this.config.HF_API_KEY}`);
    if (this.config.OLLAMA_URL) extraProviders.push(`OLLAMA_URL=${this.config.OLLAMA_URL}`);
    
    if (extraProviders.length > 0) {
      lines.push('# ── Provedores IA Adicionais ──');
      extraProviders.forEach(p => lines.push(p));
      lines.push('');
    }
    
    fs.writeFileSync(this.envPath, lines.join('\n'));
    console.log('\n✅ Ficheiro .env criado com sucesso!');
  }
  
  showSummary() {
    console.log('\n');
    console.log('╔' + '═'.repeat(48) + '╗');
    console.log('║' + ' '.repeat(15) + '📋 RESUMO' + ' '.repeat(24) + '║');
    console.log('╠' + '═'.repeat(48) + '╣');
    
    const features = [];
    if (this.config.GROQ_API_KEY) features.push('✅ IA (Groq)');
    else features.push('❌ IA (falta API key)');
    
    if (this.config.TELEGRAM_BOT_TOKEN) features.push('✅ Telegram Bot');
    else features.push('⏸️  Telegram (não configurado)');
    
    if (this.config.DISCORD_BOT_TOKEN) features.push('✅ Discord Bot');
    else features.push('⏸️  Discord (não configurado)');
    
    features.push(`🌐 Idioma: ${this.config.LANGUAGE || 'pt'}`);
    
    features.forEach(f => {
      console.log('║  ' + f.padEnd(46) + '║');
    });
    
    console.log('╠' + '═'.repeat(48) + '╣');
    console.log('║' + ' '.repeat(10) + '🚀 PRÓXIMOS PASSOS' + ' '.repeat(20) + '║');
    console.log('╠' + '═'.repeat(48) + '╣');
    console.log('║  1. npm install                                ║');
    console.log('║  2. npm run dev (todas as plataformas)         ║');
    console.log('║     ou npm run desktop (só desktop)            ║');
    console.log('║     ou npm run core (servidor web + API)       ║');
    console.log('╚' + '═'.repeat(48) + '╝');
    console.log('');
  }
  
  clear() {
    console.clear();
  }
  
  banner() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║    ███╗   ███╗██╗   ██╗██████╗  ██████╗ ████████╗         ║
║    ████╗ ████║╚██╗ ██╔╝██╔══██╗██╔═══██╗╚══██╔══╝         ║
║    ██╔████╔██║ ╚████╔╝ ██████╔╝██║   ██║   ██║            ║
║    ██║╚██╔╝██║  ╚██╔╝  ██╔══██╗██║   ██║   ██║            ║
║    ██║ ╚═╝ ██║   ██║   ██████╔╝╚██████╔╝   ██║            ║
║    ╚═╝     ╚═╝   ╚═╝   ╚═════╝  ╚═════╝    ╚═╝            ║
║                                                           ║
║              🔧 SETUP WIZARD v2.0.0 🔧                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  }
}

// Run
const wizard = new SetupWizard();
wizard.run().catch(console.error);
