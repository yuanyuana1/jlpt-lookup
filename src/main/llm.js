/**
 * 大模型 API 模块 - 用于句子级语法分析
 * 
 * 支持：
 * - Azure OpenAI (GPT-4.1)
 * - DeepSeek
 * - OpenAI (GPT-4o-mini)
 * - Ollama（本地模型）
 */

const fs = require('fs');
const path = require('path');
const { getUserDataPath } = require('./paths');

// 配置文件路径
const CONFIG_PATH = getUserDataPath('llm-config.json');
const CACHE_PATH = getUserDataPath('llm-cache.json');

// LLM 结果缓存
const MAX_CACHE_SIZE = 500;
let llmCache = new Map();

// 默认配置 - 每个提供商独立保存自己的配置
const DEFAULT_CONFIG = {
  provider: 'azure',
  enabled: false,
  providers: {
    azure: {
      apiKey: '',
      model: 'gpt-4o-mini',
      baseUrl: 'https://openai-nec-as-ai-br-rag.openai.azure.com',
      azureDeployment: 'gpt-4o-mini',
      azureApiVersion: '2025-01-01-preview'
    },
    deepseek: {
      apiKey: '',
      model: 'deepseek-v4-flash',
      baseUrl: 'https://api.deepseek.com',
      thinking: false
    },
    openai: {
      apiKey: '',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1'
    },
    ollama: {
      apiKey: '',
      model: 'qwen2.5:7b',
      baseUrl: 'http://localhost:11434/v1'
    }
  }
};

// 各提供商的默认设置
const PROVIDER_DEFAULTS = {
  azure: {
    baseUrl: 'https://openai-nec-as-ai-br-rag.openai.azure.com',
    model: 'gpt-4.1',
    deployment: 'gpt-4.1',
    apiVersion: '2025-01-01-preview'
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini'
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b'
  }
};

let config = null;
let openaiClient = null;

/**
 * 加载缓存
 */
function loadCache() {
  if (fs.existsSync(CACHE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
      llmCache = new Map(data);
      console.log(`LLM cache loaded: ${llmCache.size} entries`);
    } catch (e) {
      llmCache = new Map();
    }
  }
}

/**
 * 保存缓存到文件
 */
function saveCache() {
  try {
    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // 转换 Map 为数组存储
    const data = Array.from(llmCache.entries());
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data), 'utf-8');
  } catch (e) {
    console.error('Failed to save cache:', e.message);
  }
}

/**
 * 获取缓存
 */
function getFromCache(text) {
  return llmCache.get(text) || null;
}

/**
 * 添加到缓存
 */
function addToCache(text, result) {
  // 超出上限时删除最旧的条目
  if (llmCache.size >= MAX_CACHE_SIZE) {
    const firstKey = llmCache.keys().next().value;
    llmCache.delete(firstKey);
  }
  
  llmCache.set(text, result);
  
  // 异步保存，不阻塞主流程
  setImmediate(saveCache);
}

/**
 * 清空缓存
 */
function clearCache() {
  llmCache.clear();
  if (fs.existsSync(CACHE_PATH)) {
    fs.unlinkSync(CACHE_PATH);
  }
  console.log('LLM cache cleared');
}

/**
 * 加载配置
 */
function loadConfig() {
  // 同时加载缓存
  loadCache();
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      // 合并默认配置（确保新增的提供商不丢失）
      config = { ...DEFAULT_CONFIG, ...saved };
      config.providers = { ...DEFAULT_CONFIG.providers, ...saved.providers };
    } catch (e) {
      config = { ...DEFAULT_CONFIG };
    }
  } else {
    config = { ...DEFAULT_CONFIG };
  }
  openaiClient = null;
  return config;
}

/**
 * 保存配置
 */
function saveConfig(newConfig) {
  config = { ...config, ...newConfig };
  if (newConfig.providers) {
    config.providers = { ...config.providers, ...newConfig.providers };
  }
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  openaiClient = null;
  return config;
}

/**
 * 获取当前配置（返回扁平化的当前提供商信息，方便 UI 使用）
 */
function getConfig() {
  if (!config) loadConfig();
  const p = config.providers[config.provider] || {};
  return {
    provider: config.provider,
    enabled: config.enabled,
    apiKey: p.apiKey || '',
    model: p.model || '',
    baseUrl: p.baseUrl || '',
    azureDeployment: p.azureDeployment || '',
    azureApiVersion: p.azureApiVersion || '',
    providers: config.providers
  };
}

/**
 * 获取当前活跃提供商的配置
 */
function getActiveProviderConfig() {
  if (!config) loadConfig();
  return config.providers[config.provider] || {};
}

/**
 * 检查 LLM 是否可用
 */
function isLLMEnabled() {
  if (!config) loadConfig();
  if (!config.enabled) return false;
  const p = config.providers[config.provider] || {};
  if (config.provider === 'ollama') return true;
  return !!p.apiKey;
}

/**
 * 获取或创建 OpenAI client
 */
function getClient() {
  if (openaiClient) return openaiClient;
  
  if (!config) loadConfig();
  
  const OpenAI = require('openai');
  const { AzureOpenAI } = require('openai');
  const p = getActiveProviderConfig();
  
  if (config.provider === 'azure') {
    const endpoint = p.baseUrl || PROVIDER_DEFAULTS.azure.baseUrl;
    const apiVersion = p.azureApiVersion || PROVIDER_DEFAULTS.azure.apiVersion;
    
    openaiClient = new AzureOpenAI({
      endpoint: endpoint,
      apiKey: p.apiKey,
      apiVersion: apiVersion,
      timeout: 30000,
      maxRetries: 0
    });
  } else {
    const defaults = PROVIDER_DEFAULTS[config.provider] || PROVIDER_DEFAULTS.deepseek;
    const baseURL = p.baseUrl || defaults.baseUrl;
    const apiKey = p.apiKey || 'ollama';

    openaiClient = new OpenAI({
      baseURL: baseURL,
      apiKey: apiKey,
      timeout: 30000,
      maxRetries: 0
    });
  }

  return openaiClient;
}

/**
 * 构建日语分析的 system prompt（根据文本长度动态调整）
 */
function buildSystemPrompt(text) {
  // 短文本（单词/短语）：简洁分析
  if (text.length <= 10) {
    return `你是日语语法专家。分析日语文本，返回JSON（不要其他文字）：
{"translation":"中文翻译","grammar":[{"pattern":"语法名","jlpt":"N?","explanation":"简短解释"}],"conjugation":[{"surface":"表层形","base":"原形","form":"变形名称（如：ます形、て形、た形、ない形、意志形等）"}]}
conjugation：有变形的词才列，form填写该词在句中的变形名称。`;
  }

  // 长文本（句子）：完整分析
  return `你是日语语法专家。仔细分析日语文本，返回JSON（不要其他文字）：
{
  "translation": "自然流畅的中文翻译",
  "words": [
    {"word":"词形","reading":"假名","meaning":"中文释义","jlpt":"N?","pos":"词性标注（动1/动2/动3/い形/な形/名/副/接/感）"}
  ],
  "grammar": [
    {"pattern":"语法/句型名称","jlpt":"N?","explanation":"详细解释该语法的含义和用法","usage":"在本句中的具体用法"}
  ],
  "conjugation": [
    {"surface":"句中出现的形式","base":"原形（辞书形）","form":"变形名称（如：ます形、て形、た形、ない形、意志形、命令形、条件形等）"}
  ]
}

分析要求（严格执行）：
1. words：列出句中所有实词（名词、动词、形容词、副词），包括外来语、复合词，不要遗漏
2. grammar：列出所有值得注意的语法点，包括：
   - 助词的特殊用法（如〜に、〜を、〜が的语法功能）
   - 接续表达（〜ている、〜ておる、〜ております等）
   - 敬语表达（丁寧語、謙譲語、尊敬語）
   - 句型结构（〜の方々、〜に送付する等）
   - 任何N5-N1的语法点，宁多勿少
3. conjugation：有活用变形的词才列，surface填句中实际形式，base填原形，form填变形名称
4. pos：动词填动1（五段）/动2（一段）/动3（する/くる），形容词填い形/な形，其他填名/副/接/感，不确定填null
5. jlpt：不确定时填null，不要乱猜`;
}

/**
 * 调用 LLM API 分析日语文本
 */
async function analyzeSentence(text) {
  if (!isLLMEnabled()) {
    return null;
  }

  // 检查缓存
  const cached = getFromCache(text);
  if (cached) {
    console.log(`LLM cache hit: "${text.substring(0, 20)}..."`);
    return cached;
  }

  const defaults = PROVIDER_DEFAULTS[config.provider] || PROVIDER_DEFAULTS.deepseek;
  const p = getActiveProviderConfig();
  
  // Azure 使用 deployment name，其他使用 model
  let model;
  if (config.provider === 'azure') {
    model = p.azureDeployment || p.model || defaults.deployment || defaults.model;
  } else {
    model = p.model || defaults.model;
  }

  try {
    const client = getClient();
    
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: buildSystemPrompt(text) },
            { role: 'user', content: text }
          ],
          temperature: 0.2,
          max_tokens: text.length <= 10 ? 1000 : 4000,
          stream: false,
          // DeepSeek thinking 模式控制
          ...(config.provider === 'deepseek' ? {
            thinking: { type: p.thinking ? 'enabled' : 'disabled' }
          } : {})
        });

        // 检查是否因 token 不足被截断
        const finishReason = completion.choices[0].finish_reason;
        if (finishReason === 'length') {
          console.warn(`LLM response truncated (finish_reason=length), text: "${text.substring(0, 30)}"`);
        }

        const content = completion.choices[0].message.content;
        const result = parseResponse(content);
        
        // 成功则存入缓存
        if (result) {
          addToCache(text, result);
        }
        
        return result;
      } catch (err) {
        lastError = err;
        const status = err.status || err.statusCode;
        
        if (status === 500 || status === 503 || status === 429) {
          console.log(`API busy, ${attempt < 2 ? 'retrying...' : 'giving up'} (${status})`);
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
        }
        break;
      }
    }
    
    const errMsg = lastError?.message || '未知错误';
    const status = lastError?.status || lastError?.statusCode || '';
    console.error(`LLM API failed (${config.provider}): ${status} ${errMsg}`);
    return null;
  } catch (err) {
    console.error(`LLM API failed (${config.provider}):`, err.message);
    return null;
  }
}

/**
 * 解析 LLM 返回的 JSON
 */
function parseResponse(responseText) {
  let jsonStr = responseText.trim();

  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  const startIdx = jsonStr.indexOf('{');
  const endIdx = jsonStr.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1) {
    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON parse failed:', e.message);
    console.error('Raw response:', responseText.substring(0, 500));

    // 降级：JSON 被截断时，尝试只提取 translation 字段
    const translationMatch = responseText.match(/"translation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (translationMatch) {
      console.log('Partial parse: extracted translation only');
      return { translation: translationMatch[1], _partial: true };
    }

    return null;
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  isLLMEnabled,
  analyzeSentence,
  clearCache,
  getFromCache,
  PROVIDER_DEFAULTS
};
