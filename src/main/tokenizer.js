const kuromoji = require('kuromoji');
const path = require('path');

let tokenizer = null;

/**
 * 初始化 kuromoji 分词器
 */
function initTokenizer() {
  return new Promise((resolve, reject) => {
    const dicPath = path.join(
      path.dirname(require.resolve('kuromoji')),
      '../dict'
    );

    kuromoji.builder({ dicPath }).build((err, _tokenizer) => {
      if (err) {
        console.error('Tokenizer init failed:', err);
        reject(err);
        return;
      }
      tokenizer = _tokenizer;
      console.log('Tokenizer initialized');
      resolve();
    });
  });
}

/**
 * 对日语文本进行分词
 * @param {string} text - 输入文本
 * @returns {Array} 分词结果
 */
async function tokenize(text) {
  if (!tokenizer) {
    throw new Error('Tokenizer not initialized');
  }

  const tokens = tokenizer.tokenize(text);

  // 过滤并格式化结果
  return tokens.map(token => ({
    surface_form: token.surface_form,
    basic_form: token.basic_form,
    reading: katakanaToHiragana(token.reading || ''),  // 转为平假名
    pronunciation: katakanaToHiragana(token.pronunciation || ''),
    pos: token.pos,
    pos_detail_1: token.pos_detail_1,
    pos_detail_2: token.pos_detail_2,
    conjugated_type: token.conjugated_type,
    conjugated_form: token.conjugated_form
  }));
}

/**
 * 片假名转平假名
 */
function katakanaToHiragana(str) {
  if (!str) return '';
  return str.replace(/[\u30A1-\u30F6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}

module.exports = { initTokenizer, tokenize, katakanaToHiragana };
