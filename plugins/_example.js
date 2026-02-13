/**
 * 📦 Plugin de Exemplo — Modelo/Template para criar plugins
 * 
 * COMO CRIAR UM PLUGIN:
 * 1. Copia este ficheiro e renomeia (ex: meu-plugin.js)
 * 2. Define os intents (padrões regex + handler)
 * 3. Move para a pasta plugins/
 * 4. Reinicia o MyAssistBOT — o plugin é carregado automaticamente!
 * 
 * NOTA: Ficheiros que começam com _ (como este) são ignorados.
 */

module.exports = {
  // === Metadados ===
  name: 'exemplo',
  description: 'Plugin de exemplo — mostra como criar plugins',
  version: '1.0.0',

  // === Intents ===
  // Cada intent tem: patterns (regex), extract (extrai entidades), handler (executa)
  intents: {
    // Intent 1: Cumprimentar
    'greeting': {
      patterns: [
        /^(?:olá|oi|hey|hello|boas)\s+plugin/i,
        /plugin\s+(?:olá|oi|hello)/i
      ],
      extract: (text) => {
        const nameMatch = text.match(/(?:eu\s+sou|sou\s+o|my\s+name\s+is)\s+(\w+)/i);
        return { name: nameMatch?.[1] || 'amigo' };
      },
      handler: async (entities, context) => {
        return {
          success: true,
          response: `👋 Olá ${entities.name}! Este é o plugin de exemplo a funcionar!\n🔌 Prova que o sistema de plugins está ativo.`
        };
      }
    },

    // Intent 2: Gerar número aleatório  
    'random_number': {
      patterns: [
        /(?:número|numero)\s+(?:aleatório|aleatorio|random)/i,
        /random\s+number/i,
        /dá-me\s+um\s+número/i
      ],
      extract: (text) => {
        const match = text.match(/(?:entre|from)\s+(\d+)\s+(?:e|and|to)\s+(\d+)/i);
        return {
          min: match ? parseInt(match[1]) : 1,
          max: match ? parseInt(match[2]) : 100
        };
      },
      handler: async (entities) => {
        const { min, max } = entities;
        const number = Math.floor(Math.random() * (max - min + 1)) + min;
        return {
          success: true,
          response: `🎲 Número aleatório (${min}-${max}): **${number}**`
        };
      }
    }
  },

  // === Lifecycle Hooks (opcionais) ===
  onLoad: () => {
    console.log('    📦 Plugin de exemplo carregado!');
  },

  onUnload: () => {
    console.log('    📦 Plugin de exemplo descarregado.');
  }
};
