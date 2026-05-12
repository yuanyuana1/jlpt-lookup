/**
 * 测试完整词典的查询效果
 */
const { initTokenizer, tokenize, katakanaToHiragana } = require('../src/main/tokenizer');
const { initDictionary, lookupWord, lookupGrammar, getStats } = require('../src/main/dictionary');

async function main() {
  console.log('=== 完整词典测试 ===\n');

  await initTokenizer();
  await initDictionary();
  
  const stats = getStats();
  console.log(`词典: ${stats.words} 个单词, ${stats.grammar} 条语法\n`);

  // 测试各种句子
  const testSentences = [
    '彼女に振られたばかりなのに、もう新しい彼女ができたらしい',
    '食べられない',
    '日本語を勉強しています',
    '電車に乗って学校に行きます',
    '美しい花が咲いている',
    '明日は天気がいいそうです',
  ];

  for (const sentence of testSentences) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`原文: ${sentence}\n`);
    
    const tokens = await tokenize(sentence);
    
    for (const token of tokens) {
      // 跳过助词和标点
      if (token.pos === '助詞' || token.pos === '記号') continue;
      
      const result = lookupWord(token.surface_form, token.basic_form);
      const reading = katakanaToHiragana(token.reading);
      
      if (result) {
        const jlpt = result.jlpt_level ? ` [N${result.jlpt_level}]` : '';
        const conjugation = token.surface_form !== token.basic_form 
          ? ` (${token.surface_form}→${token.basic_form})` 
          : '';
        console.log(`  ${token.surface_form} [${reading}]${conjugation}`);
        console.log(`    → ${result.meaning}${jlpt} (${result.pos || token.pos})`);
      } else if (token.pos !== '助動詞') {
        console.log(`  ${token.surface_form} [${reading}] (${token.pos}) - 词典未收录`);
      }
    }
    console.log('');
  }

  // 测试语法
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log('语法查询测试:\n');
  
  const grammarTests = ['ばかり', 'らしい', 'そうだ', 'ている'];
  for (const pattern of grammarTests) {
    const results = lookupGrammar(pattern);
    if (results.length > 0) {
      for (const g of results) {
        console.log(`  ${g.pattern} (N${g.jlpt_level}): ${g.meaning}`);
      }
    }
  }
}

main().catch(console.error);
