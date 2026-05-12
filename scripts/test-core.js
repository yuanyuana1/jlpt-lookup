/**
 * 测试核心模块：分词 + 词典查询
 */
const { initTokenizer, tokenize, katakanaToHiragana } = require('../src/main/tokenizer');
const { initDictionary, lookupWord, lookupGrammar, getStats } = require('../src/main/dictionary');

async function main() {
  console.log('=== JLPT Lookup 核心模块测试 ===\n');

  // 初始化
  console.log('1. 初始化分词器...');
  await initTokenizer();
  console.log('   ✓ 分词器就绪\n');

  console.log('2. 初始化词典...');
  await initDictionary();
  const stats = getStats();
  console.log(`   ✓ 词典就绪 (${stats.words} 个单词, ${stats.grammar} 条语法)\n`);

  // 测试分词
  console.log('3. 测试分词:');
  const testTexts = [
    '日本語を勉強しています',
    '食べたい',
    '学校に行く'
  ];

  for (const text of testTexts) {
    console.log(`\n   输入: "${text}"`);
    const tokens = await tokenize(text);
    for (const t of tokens) {
      const reading = katakanaToHiragana(t.reading);
      console.log(`   → ${t.surface_form} [${reading}] (${t.pos}) 基本形: ${t.basic_form}`);
    }
  }

  // 测试查词
  console.log('\n\n4. 测试查词:');
  const testWords = ['食べる', 'がっこう', '勉強', '行く', '日本語'];
  
  for (const word of testWords) {
    const result = lookupWord(word, word);
    if (result) {
      const jlpt = result.jlpt_level ? `N${result.jlpt_level}` : '?';
      console.log(`   ${word} → ${result.meaning} [${result.reading}] (${jlpt}, ${result.pos})`);
    } else {
      console.log(`   ${word} → 未找到`);
    }
  }

  // 测试语法查询
  console.log('\n\n5. 测试语法查询:');
  const grammarResults = lookupGrammar('ている');
  for (const g of grammarResults) {
    console.log(`   ${g.pattern} (N${g.jlpt_level}): ${g.meaning}`);
    console.log(`   解释: ${g.explanation}`);
    console.log(`   例句: ${g.example_ja} → ${g.example_zh}`);
  }

  console.log('\n\n=== 测试完成 ===');
}

main().catch(console.error);
