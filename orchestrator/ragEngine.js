/**
 * 🧠 RAG Engine - Retrieval Augmented Generation
 * Indexação e pesquisa vetorial de documentos para contexto enriquecido
 * 
 * Suporta: .txt, .md, .json, .js, .html, .css, .pdf (com pdf-parse)
 * Embeddings: TF-IDF local (zero APIs) + opção @xenova/transformers
 * Storage: Ficheiros JSON locais
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INDEX_DIR = path.join(PROJECT_ROOT, 'memory', 'rag_index');
const CHUNKS_FILE = path.join(INDEX_DIR, 'chunks.json');
const VOCAB_FILE = path.join(INDEX_DIR, 'vocab.json');

// Extensões suportadas para indexação
const SUPPORTED_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.js', '.ts', '.html', '.css',
  '.py', '.yaml', '.yml', '.csv', '.xml', '.env', '.log',
  '.pdf', '.docx'
]);

// Diretórios a ignorar
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.cache',
  'rag_index', '.next', '__pycache__'
]);

// Configuração de chunking
const CHUNK_SIZE = 512;         // tokens aprox por chunk
const CHUNK_OVERLAP = 64;       // overlap entre chunks
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max por ficheiro

class RAGEngine {
  constructor() {
    this.chunks = [];           // { id, text, source, metadata, vector }
    this.vocabulary = {};       // { word: idf_score }
    this.docFrequency = {};     // { word: num_docs_containing }
    this.totalDocs = 0;
    this.initialized = false;
    this.pdfParser = null;
    this.mammoth = null;
    
    // Tentar carregar parsers opcionais
    try { this.pdfParser = require('pdf-parse'); } catch {}
    try { this.mammoth = require('mammoth'); } catch {}
    
    fs.ensureDirSync(INDEX_DIR);
    console.log('[RAG] Engine criada');
  }
  
  /**
   * Inicializa o engine e carrega índice existente
   */
  async init() {
    if (this.initialized) return;
    
    try {
      if (await fs.pathExists(CHUNKS_FILE)) {
        const data = await fs.readJson(CHUNKS_FILE);
        this.chunks = data.chunks || [];
        this.totalDocs = data.totalDocs || 0;
        console.log(`[RAG] Indice carregado: ${this.chunks.length} chunks`);
      }
      
      if (await fs.pathExists(VOCAB_FILE)) {
        const vocabData = await fs.readJson(VOCAB_FILE);
        this.vocabulary = vocabData.vocabulary || {};
        this.docFrequency = vocabData.docFrequency || {};
      }
    } catch (err) {
      console.error('[RAG] Erro ao carregar indice:', err.message);
      this.chunks = [];
      this.vocabulary = {};
      this.docFrequency = {};
    }
    
    this.initialized = true;
  }
  
  /**
   * Salva índice para disco
   */
  async saveIndex() {
    try {
      await fs.writeJson(CHUNKS_FILE, {
        chunks: this.chunks,
        totalDocs: this.totalDocs,
        updatedAt: Date.now()
      });
      
      await fs.writeJson(VOCAB_FILE, {
        vocabulary: this.vocabulary,
        docFrequency: this.docFrequency
      });
    } catch (err) {
      console.error('[RAG] Erro ao salvar indice:', err.message);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // INDEXAÇÃO DE DOCUMENTOS
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Indexa um diretório recursivamente
   * @param {string} dirPath - Caminho do diretório
   * @param {Object} options - { extensions, maxDepth }
   * @returns {{ indexed: number, skipped: number, errors: string[] }}
   */
  async indexDirectory(dirPath, options = {}) {
    await this.init();
    
    const targetDir = path.resolve(dirPath || path.join(PROJECT_ROOT, 'Documentos'));
    const maxDepth = options.maxDepth || 5;
    const result = { indexed: 0, skipped: 0, errors: [] };
    
    async function* walkDir(dir, depth = 0) {
      if (depth > maxDepth) return;
      
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name)) {
            yield* walkDir(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          yield fullPath;
        }
      }
    }
    
    for await (const filePath of walkDir(targetDir)) {
      try {
        const ext = path.extname(filePath).toLowerCase();
        
        if (!SUPPORTED_EXTENSIONS.has(ext)) {
          result.skipped++;
          continue;
        }
        
        const stats = await fs.stat(filePath);
        if (stats.size > MAX_FILE_SIZE) {
          result.skipped++;
          continue;
        }
        
        await this.indexFile(filePath);
        result.indexed++;
      } catch (err) {
        result.errors.push(`${filePath}: ${err.message}`);
      }
    }
    
    // Recalcular IDF e vetores
    this._computeIDF();
    this._recomputeVectors();
    await this.saveIndex();
    
    console.log(`[RAG] Diretorio indexado: ${result.indexed} ficheiros, ${this.chunks.length} chunks`);
    return result;
  }
  
  /**
   * Indexa um único ficheiro
   * @param {string} filePath - Caminho absoluto do ficheiro
   * @param {Object} metadata - Metadata adicional
   */
  async indexFile(filePath, metadata = {}) {
    await this.init();
    
    const absPath = path.resolve(filePath);
    const ext = path.extname(absPath).toLowerCase();
    
    // Remover chunks antigos deste ficheiro
    this.chunks = this.chunks.filter(c => c.source !== absPath);
    
    // Extrair texto
    let text = '';
    
    if (ext === '.pdf' && this.pdfParser) {
      try {
        const buffer = await fs.readFile(absPath);
        const data = await this.pdfParser(buffer);
        text = data.text;
      } catch (err) {
        text = `[Erro ao ler PDF: ${err.message}]`;
      }
    } else if (ext === '.docx' && this.mammoth) {
      try {
        const result = await this.mammoth.extractRawText({ path: absPath });
        text = result.value;
      } catch (err) {
        text = `[Erro ao ler DOCX: ${err.message}]`;
      }
    } else {
      text = await fs.readFile(absPath, 'utf8');
    }
    
    if (!text || text.trim().length < 10) return;
    
    // Criar chunks
    const fileChunks = this._createChunks(text, absPath, metadata);
    
    // Adicionar ao índice
    this.chunks.push(...fileChunks);
    this.totalDocs++;
    
    // Atualizar document frequency
    for (const chunk of fileChunks) {
      const words = new Set(this._tokenize(chunk.text));
      for (const word of words) {
        this.docFrequency[word] = (this.docFrequency[word] || 0) + 1;
      }
    }
  }
  
  /**
   * Indexa texto puro (não de ficheiro)
   * @param {string} text - Texto a indexar
   * @param {string} source - Identificador da fonte
   * @param {Object} metadata - Metadata adicional
   */
  async indexText(text, source = 'user_input', metadata = {}) {
    await this.init();
    
    if (!text || text.trim().length < 10) return;
    
    const chunks = this._createChunks(text, source, metadata);
    this.chunks.push(...chunks);
    this.totalDocs++;
    
    for (const chunk of chunks) {
      const words = new Set(this._tokenize(chunk.text));
      for (const word of words) {
        this.docFrequency[word] = (this.docFrequency[word] || 0) + 1;
      }
    }
    
    this._computeIDF();
    this._recomputeVectors();
    await this.saveIndex();
  }
  
  // ═══════════════════════════════════════════════════════════
  // PESQUISA
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Pesquisa os chunks mais relevantes para uma query
   * @param {string} query - Texto de pesquisa
   * @param {Object} options - { topK, minScore, sourceFilter }
   * @returns {Array<{ text, source, score, metadata }>}
   */
  async search(query, options = {}) {
    await this.init();
    
    if (!this.chunks.length) return [];
    
    const topK = options.topK || 5;
    const minScore = options.minScore || 0.05;
    const sourceFilter = options.sourceFilter || null;
    
    // Vetorizar a query
    const queryVector = this._vectorize(query);
    
    // Calcular similaridade cosseno com todos os chunks
    let results = this.chunks
      .filter(c => !sourceFilter || c.source.includes(sourceFilter))
      .map(chunk => ({
        text: chunk.text,
        source: chunk.source,
        metadata: chunk.metadata,
        score: this._cosineSimilarity(queryVector, chunk.vector || {})
      }))
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    return results;
  }
  
  /**
   * Pesquisa e formata como contexto para o LLM
   * @param {string} query - Pergunta do utilizador
   * @param {Object} options - { topK, minScore }
   * @returns {string} Contexto formatado para injetar no prompt
   */
  async getContext(query, options = {}) {
    const results = await this.search(query, options);
    
    if (!results.length) return '';
    
    let context = '--- CONTEXTO DOS DOCUMENTOS ---\n\n';
    
    for (const r of results) {
      const sourceName = path.basename(r.source);
      context += `[Fonte: ${sourceName} | Relevancia: ${(r.score * 100).toFixed(0)}%]\n`;
      context += r.text.trim() + '\n\n';
    }
    
    context += '--- FIM DO CONTEXTO ---\n';
    return context;
  }
  
  // ═══════════════════════════════════════════════════════════
  // GESTÃO DO ÍNDICE
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Remove um ficheiro do índice
   */
  async removeFile(filePath) {
    await this.init();
    const absPath = path.resolve(filePath);
    const before = this.chunks.length;
    this.chunks = this.chunks.filter(c => c.source !== absPath);
    
    if (this.chunks.length < before) {
      this._computeIDF();
      this._recomputeVectors();
      await this.saveIndex();
      return true;
    }
    return false;
  }
  
  /**
   * Limpa todo o índice
   */
  async clearIndex() {
    this.chunks = [];
    this.vocabulary = {};
    this.docFrequency = {};
    this.totalDocs = 0;
    await this.saveIndex();
    console.log('[RAG] Indice limpo');
  }
  
  /**
   * Retorna estatísticas do índice
   */
  getStats() {
    const sources = new Set(this.chunks.map(c => c.source));
    return {
      totalChunks: this.chunks.length,
      totalSources: sources.size,
      totalDocs: this.totalDocs,
      vocabularySize: Object.keys(this.vocabulary).length,
      sources: [...sources].map(s => path.basename(s))
    };
  }
  
  // ═══════════════════════════════════════════════════════════
  // MÉTODOS INTERNOS
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Divide texto em chunks com overlap
   */
  _createChunks(text, source, metadata = {}) {
    const words = text.split(/\s+/);
    const chunks = [];
    
    // Se texto é pequeno, um único chunk
    if (words.length <= CHUNK_SIZE) {
      chunks.push({
        id: this._generateId(text, 0),
        text: text.trim(),
        source,
        metadata: { ...metadata, chunkIndex: 0 },
        vector: {}
      });
      return chunks;
    }
    
    // Chunking com overlap
    let start = 0;
    let chunkIndex = 0;
    
    while (start < words.length) {
      const end = Math.min(start + CHUNK_SIZE, words.length);
      const chunkText = words.slice(start, end).join(' ');
      
      chunks.push({
        id: this._generateId(chunkText, chunkIndex),
        text: chunkText.trim(),
        source,
        metadata: { ...metadata, chunkIndex },
        vector: {}
      });
      
      // Se chegámos ao final, terminar
      if (end >= words.length) break;
      
      chunkIndex++;
      const nextStart = end - CHUNK_OVERLAP;
      
      // Evitar chunks muito pequenos ou loops infinitos
      if (nextStart <= start || words.length - nextStart < CHUNK_OVERLAP) break;
      start = nextStart;
    }
    
    return chunks;
  }
  
  /**
   * Tokeniza texto em palavras normalizadas
   */
  _tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\sàáâãéèêíìóòôõúùûçñ]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !this._isStopWord(w));
  }
  
  /**
   * Verifica se é stop word (PT + EN)
   */
  _isStopWord(word) {
    const stopWords = new Set([
      // PT
      'de', 'da', 'do', 'em', 'um', 'uma', 'que', 'para', 'com',
      'por', 'se', 'na', 'no', 'ao', 'ou', 'os', 'as', 'dos',
      'das', 'mais', 'mas', 'como', 'nos', 'nas', 'seu', 'sua',
      'foi', 'ser', 'ter', 'tem', 'era', 'este', 'esta', 'isso',
      'ele', 'ela', 'eles', 'elas', 'meu', 'minha', 'teu', 'tua',
      // EN  
      'the', 'is', 'at', 'which', 'on', 'and', 'or', 'an', 'be',
      'to', 'of', 'in', 'it', 'for', 'not', 'are', 'but', 'was',
      'has', 'had', 'have', 'this', 'that', 'with', 'from', 'they',
      'his', 'her', 'its', 'you', 'we', 'our', 'can', 'will',
      // Code
      'var', 'let', 'const', 'function', 'return', 'true', 'false',
      'null', 'undefined', 'new', 'class', 'if', 'else'
    ]);
    return stopWords.has(word);
  }
  
  /**
   * Vetoriza texto usando TF-IDF
   */
  _vectorize(text) {
    const tokens = this._tokenize(text);
    const tf = {};
    const vector = {};
    
    // Term Frequency
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }
    
    // TF-IDF = TF * IDF
    const maxTF = Math.max(...Object.values(tf), 1);
    
    for (const [term, count] of Object.entries(tf)) {
      const normalizedTF = 0.5 + 0.5 * (count / maxTF);
      const idf = this.vocabulary[term] || Math.log(this.totalDocs + 1);
      vector[term] = normalizedTF * idf;
    }
    
    return vector;
  }
  
  /**
   * Calcula IDF para todo o vocabulário
   */
  _computeIDF() {
    const totalDocs = Math.max(this.chunks.length, 1);
    
    for (const [word, docCount] of Object.entries(this.docFrequency)) {
      this.vocabulary[word] = Math.log(totalDocs / (1 + docCount)) + 1;
    }
  }
  
  /**
   * Recalcula vetores de todos os chunks
   */
  _recomputeVectors() {
    for (const chunk of this.chunks) {
      chunk.vector = this._vectorize(chunk.text);
    }
  }
  
  /**
   * Similaridade cosseno entre dois vetores esparsos
   */
  _cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    // Dot product (apenas termos comuns)
    for (const [term, valueA] of Object.entries(vecA)) {
      if (vecB[term]) {
        dotProduct += valueA * vecB[term];
      }
      normA += valueA * valueA;
    }
    
    for (const value of Object.values(vecB)) {
      normB += value * value;
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }
  
  /**
   * Gera ID único para um chunk
   */
  _generateId(text, index) {
    const hash = crypto.createHash('md5')
      .update(text.substring(0, 100) + index)
      .digest('hex')
      .substring(0, 12);
    return `chunk_${hash}`;
  }
}

// Singleton
const ragEngine = new RAGEngine();

module.exports = ragEngine;
