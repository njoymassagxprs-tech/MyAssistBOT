/**
 * 🔀 Router - Ponto de entrada para todos os canais
 * 
 * Encaminha prompts para o orchestrator principal
 */

const orchestrator = require('./orchestrator');

module.exports = {
  handlePrompt: orchestrator.handlePrompt,
  getSystemInfo: orchestrator.getSystemInfo,
  getAgentsList: orchestrator.getAgentsList,
  getHelpMessage: orchestrator.getHelpMessage
};
