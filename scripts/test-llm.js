/**
 * 测试 LLM 模块
 * 
 * 使用方法:
 *   测试配置: node scripts/test-llm.js config
 *   测试调用: node scripts/test-llm.js call "食べられない"
 *   设置 DeepSeek: node scripts/test-llm.js setup deepseek YOUR_API_KEY
 *   设置 Ollama: node scripts/test-llm.js setup ollama
 */

const { loadConfig, saveConfig, getConfig, isLLMEnabled, analyzeSentence, PROVIDER_DEFAULTS } = require('../src/main/llm');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'config';

  loadConfig();

  switch (command) {
    case 'config':
      showConfig();
      break;

    case 'setup':
      await setupProvider(args[1], args[2]);
      break;

    case 'call':
      await testCall(args[1] || '食べられない');
      break;

    case 'test':
      await runTest();
      break;

    default:
      console.log('用法:');
      console.log('  node scripts/test-llm.js config              - 查看当前配置');
      console.log('  node scripts/test-llm.js setup deepseek KEY  - 配置 DeepSeek');
      console.log('  node scripts/test-llm.js setup openai KEY    - 配置 OpenAI');
      console.log('  node scripts/test-llm.js setup ollama        - 配置 Ollama');
      console.log('  node scripts/test-llm.js call "日语文本"      - 测试分析');
  }
}

function showConfig() {
  const config = getConfig();
  console.log('=== 当前 LLM 配置 ===\n');
  console.log(`提供商: ${config.provider}`);
  console.log(`API Key: ${config.apiKey ? '***' + config.apiKey.slice(-4) : '(未设置)'}`);
  console.log(`模型: ${config.model || '(默认: ' + (PROVIDER_DEFAULTS[config.provider]?.model || '?') + ')'}`);
  console.log(`地址: ${config.baseUrl || '(默认: ' + (PROVIDER_DEFAULTS[config.provider]?.baseUrl || '?') + ')'}`);
  console.log(`启用: ${config.enabled ? '✓ 是' : '✗ 否'}`);
  console.log(`\n状态: ${isLLMEnabled() ? '✓ LLM 可用' : '✗ LLM 不可用'}`);
}

async function setupProvider(provider, apiKey) {
  if (!provider) {
    console.log('请指定提供商: deepseek, openai, claude, ollama');
    return;
  }

  const config = {
    provider: provider,
    enabled: true
  };

  if (provider === 'ollama') {
    config.apiKey = '';
    console.log('配置 Ollama 本地模型...');
    console.log('请确保 Ollama 正在运行 (ollama serve)');
    console.log(`默认模型: ${PROVIDER_DEFAULTS.ollama.model}`);
  } else {
    if (!apiKey) {
      console.log(`请提供 ${provider} 的 API Key:`);
      console.log(`  node scripts/test-llm.js setup ${provider} YOUR_API_KEY`);
      return;
    }
    config.apiKey = apiKey;
  }

  saveConfig(config);
  console.log('\n✓ 配置已保存！');
  showConfig();
}

async function testCall(text) {
  console.log(`=== 测试 LLM 分析 ===\n`);
  console.log(`输入: ${text}\n`);

  if (!isLLMEnabled()) {
    console.log('✗ LLM 未启用。请先配置:');
    console.log('  node scripts/test-llm.js setup deepseek YOUR_KEY');
    console.log('  node scripts/test-llm.js setup ollama');
    return;
  }

  console.log('正在调用 API...\n');
  const startTime = Date.now();

  try {
    const result = await analyzeSentence(text);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result) {
      console.log(`✓ 分析完成 (${elapsed}s)\n`);
      console.log('--- 翻译 ---');
      console.log(`  ${result.translation}\n`);

      if (result.words && result.words.length > 0) {
        console.log('--- 词汇 ---');
        for (const w of result.words) {
          const jlpt = w.jlpt ? ` [${w.jlpt}]` : '';
          console.log(`  ${w.word} (${w.reading}) - ${w.meaning}${jlpt} (${w.pos})`);
        }
        console.log('');
      }

      if (result.grammar && result.grammar.length > 0) {
        console.log('--- 语法 ---');
        for (const g of result.grammar) {
          const jlpt = g.jlpt ? ` [${g.jlpt}]` : '';
          console.log(`  ${g.pattern}${jlpt}: ${g.explanation}`);
          if (g.usage) console.log(`    → ${g.usage}`);
        }
        console.log('');
      }

      if (result.conjugation) {
        console.log('--- 变形 ---');
        console.log(`  ${result.conjugation}\n`);
      }
    } else {
      console.log(`✗ 分析失败 (${elapsed}s)`);
    }
  } catch (err) {
    console.error('错误:', err.message);
  }
}

main().catch(console.error);
