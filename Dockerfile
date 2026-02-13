FROM node:20-slim

LABEL maintainer="MyAssistBOT Team"
LABEL description="MyAssistBOT — Assistente IA Multi-Plataforma"

WORKDIR /app

# Instalar dependências do sistema (para puppeteer/screenshots futuros)
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copiar package files primeiro (cache de layers)
COPY package.json package-lock.json* ./

# Instalar dependências (sem devDependencies em produção)
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Copiar código
COPY . .

# Criar pastas necessárias
RUN mkdir -p outputs temp logs user_data Documentos plugins outputs/projects

# Porta Servidor (API + Web unificado)
EXPOSE 7777
# Porta Webhooks
EXPOSE 3002

# Vari\u00e1veis de ambiente com defaults
ENV PORT=7777
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:7777/api/status', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Usar dumb-init para signal handling correto
ENTRYPOINT ["dumb-init", "--"]

# Default: inicia API server
CMD ["node", "orchestrator/api-server.js"]
