const initSqlJs = require('sql.js');
const { katakanaToHiragana } = require('./tokenizer');
const path = require('path');
const fs = require('fs');
const { getResourcePath } = require('./paths');

let db = null;

/**
 * 初始化词典数据库
 */
async function initDictionary() {
  const dbPath = getResourcePath('data', 'dictionary.db');

  const SQL = await initSqlJs();

  // 如果数据库文件已存在，加载它
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 创建词典表
  db.run(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kanji TEXT,
      reading TEXT NOT NULL,
      meaning TEXT NOT NULL,
      jlpt_level INTEGER,
      pos TEXT,
      tags TEXT
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_words_kanji ON words(kanji)');
  db.run('CREATE INDEX IF NOT EXISTS idx_words_reading ON words(reading)');
  db.run('CREATE INDEX IF NOT EXISTS idx_words_jlpt ON words(jlpt_level)');

  // 创建语法表
  db.run(`
    CREATE TABLE IF NOT EXISTS grammar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      meaning TEXT NOT NULL,
      jlpt_level INTEGER,
      explanation TEXT,
      example_ja TEXT,
      example_zh TEXT
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_grammar_pattern ON grammar(pattern)');
  db.run('CREATE INDEX IF NOT EXISTS idx_grammar_jlpt ON grammar(jlpt_level)');

  // 如果词典为空，插入示例数据
  const result = db.exec('SELECT COUNT(*) as cnt FROM words');
  const count = result[0].values[0][0];
  if (count === 0) {
    insertSampleData();
  }

  // 保存到文件
  saveToDisk(dbPath);
  console.log('Dictionary initialized');
}

/**
 * 保存数据库到磁盘
 */
function saveToDisk(dbPath) {
  if (!db) return;
  // 打包后词典是只读资源，不需要保存
  const { app } = require('electron');
  if (app.isPackaged) return;
  const filePath = dbPath || getResourcePath('data', 'dictionary.db');
  try {
    const data = db.export();
    fs.writeFileSync(filePath, Buffer.from(data));
  } catch (e) {
    // 忽略写入失败（如 asar 只读）
  }
}

/**
 * 插入示例词典数据
 */
function insertSampleData() {
  const sampleWords = [
    ['食べる', 'たべる', '吃', 4, '动词'],
    ['飲む', 'のむ', '喝', 5, '动词'],
    ['行く', 'いく', '去', 5, '动词'],
    ['来る', 'くる', '来', 5, '动词'],
    ['見る', 'みる', '看', 5, '动词'],
    ['聞く', 'きく', '听；问', 5, '动词'],
    ['読む', 'よむ', '读', 5, '动词'],
    ['書く', 'かく', '写', 5, '动词'],
    ['話す', 'はなす', '说，讲', 5, '动词'],
    ['買う', 'かう', '买', 5, '动词'],
    ['する', 'する', '做', 5, '动词'],
    ['ある', 'ある', '有（无生命）', 5, '动词'],
    ['いる', 'いる', '有（有生命）', 5, '动词'],
    ['なる', 'なる', '变成', 5, '动词'],
    ['思う', 'おもう', '想，认为', 4, '动词'],
    ['知る', 'しる', '知道', 4, '动词'],
    ['使う', 'つかう', '使用', 4, '动词'],
    ['作る', 'つくる', '制作', 4, '动词'],
    ['待つ', 'まつ', '等待', 5, '动词'],
    ['持つ', 'もつ', '拿，持有', 4, '动词'],
    ['大きい', 'おおきい', '大的', 5, '形容词'],
    ['小さい', 'ちいさい', '小的', 5, '形容词'],
    ['新しい', 'あたらしい', '新的', 5, '形容词'],
    ['古い', 'ふるい', '旧的，老的', 5, '形容词'],
    ['高い', 'たかい', '高的；贵的', 5, '形容词'],
    ['安い', 'やすい', '便宜的', 5, '形容词'],
    ['良い', 'よい', '好的', 5, '形容词'],
    ['悪い', 'わるい', '坏的', 5, '形容词'],
    ['多い', 'おおい', '多的', 5, '形容词'],
    ['少ない', 'すくない', '少的', 5, '形容词'],
    ['難しい', 'むずかしい', '难的', 4, '形容词'],
    ['易しい', 'やさしい', '容易的', 4, '形容词'],
    ['美しい', 'うつくしい', '美丽的', 3, '形容词'],
    ['学校', 'がっこう', '学校', 5, '名词'],
    ['先生', 'せんせい', '老师', 5, '名词'],
    ['学生', 'がくせい', '学生', 5, '名词'],
    ['日本語', 'にほんご', '日语', 5, '名词'],
    ['電車', 'でんしゃ', '电车', 5, '名词'],
    ['天気', 'てんき', '天气', 5, '名词'],
    ['友達', 'ともだち', '朋友', 5, '名词'],
    ['仕事', 'しごと', '工作', 4, '名词'],
    ['勉強', 'べんきょう', '学习', 4, '名词'],
    ['問題', 'もんだい', '问题', 4, '名词'],
    ['時間', 'じかん', '时间', 5, '名词'],
    ['今日', 'きょう', '今天', 5, '名词'],
    ['明日', 'あした', '明天', 5, '名词'],
    ['昨日', 'きのう', '昨天', 5, '名词'],
    ['経験', 'けいけん', '经验', 3, '名词'],
    ['環境', 'かんきょう', '环境', 3, '名词'],
    ['社会', 'しゃかい', '社会', 3, '名词'],
    ['政治', 'せいじ', '政治', 2, '名词'],
    ['経済', 'けいざい', '经济', 2, '名词'],
    ['文化', 'ぶんか', '文化', 3, '名词'],
    ['歴史', 'れきし', '历史', 3, '名词'],
    ['人', 'ひと', '人', 5, '名词'],
    ['男', 'おとこ', '男人', 5, '名词'],
    ['女', 'おんな', '女人', 5, '名词'],
    ['子供', 'こども', '孩子', 5, '名词'],
    ['家', 'いえ', '家', 5, '名词'],
    ['水', 'みず', '水', 5, '名词'],
  ];

  const stmt = db.prepare('INSERT INTO words (kanji, reading, meaning, jlpt_level, pos) VALUES (?, ?, ?, ?, ?)');
  for (const word of sampleWords) {
    stmt.run(word);
  }
  stmt.free();

  // 插入示例语法
  const sampleGrammar = [
    ['〜ている', '正在做...；表示状态', 5, '动词て形+いる，表示动作正在进行或结果状态的持续', '今、本を読んでいます。', '现在正在读书。'],
    ['〜たい', '想要做...', 5, '动词ます形去掉ます+たい，表示说话人的愿望', '日本に行きたいです。', '想去日本。'],
    ['〜てください', '请做...', 5, '动词て形+ください，表示请求', 'ここに名前を書いてください。', '请在这里写名字。'],
    ['〜ないでください', '请不要做...', 5, '动词ない形+でください，表示请求不要做某事', 'ここで写真を撮らないでください。', '请不要在这里拍照。'],
    ['〜てもいい', '可以做...', 5, '动词て形+もいい，表示许可', 'ここに座ってもいいですか。', '可以坐这里吗？'],
    ['〜なければならない', '必须做...', 4, '动词ない形去掉ない+なければならない，表示义务', '毎日勉強しなければならない。', '必须每天学习。'],
    ['〜ことができる', '能够做...', 4, '动词辞书形+ことができる，表示能力或可能性', '日本語を話すことができます。', '能说日语。'],
    ['〜たことがある', '曾经做过...', 4, '动词た形+ことがある，表示经验', '日本に行ったことがあります。', '去过日本。'],
    ['〜ようにする', '努力做到...', 3, '动词辞书形/ない形+ようにする，表示努力使某状态实现', '早く寝るようにしています。', '我在努力早睡。'],
    ['〜ようになる', '变得能够...', 3, '动词辞书形+ようになる，表示能力或状态的变化', '日本語が話せるようになった。', '变得能说日语了。'],
    ['〜わけではない', '并不是...', 2, '用于部分否定，表示事情并非完全如此', '嫌いなわけではない。', '并不是讨厌。'],
    ['〜に違いない', '一定是...', 2, '表示强烈的推测和确信', '彼は知っているに違いない。', '他一定知道。'],
  ];

  const grammarStmt = db.prepare('INSERT INTO grammar (pattern, meaning, jlpt_level, explanation, example_ja, example_zh) VALUES (?, ?, ?, ?, ?, ?)');
  for (const item of sampleGrammar) {
    grammarStmt.run(item);
  }
  grammarStmt.free();

  console.log('Sample data inserted');
}

/**
 * 查询单词
 * @param {string} surface - 表层形式
 * @param {string} basicForm - 基本形
 * @param {string} lang - 语言偏好 ('zh' | 'en' | 'ja')
 */
function lookupWord(surface, basicForm, lang = 'zh') {
  if (!db) return null;

  // 检查是否有 meaning_zh 列
  let hasZhColumn = false;
  try {
    const cols = db.exec("PRAGMA table_info(words)");
    if (cols.length > 0) {
      hasZhColumn = cols[0].values.some(row => row[1] === 'meaning_zh');
    }
  } catch (e) {}

  const selectCols = hasZhColumn 
    ? 'kanji, reading, meaning, meaning_zh, jlpt_level, pos'
    : 'kanji, reading, meaning, NULL as meaning_zh, jlpt_level, pos';

  // 先用基本形查询
  let results = db.exec(
    `SELECT ${selectCols} FROM words WHERE kanji = ? OR reading = ? LIMIT 1`,
    [basicForm, basicForm]
  );

  // 如果基本形没查到，用表层形式查
  if (results.length === 0 && surface !== basicForm) {
    results = db.exec(
      `SELECT ${selectCols} FROM words WHERE kanji = ? OR reading = ? LIMIT 1`,
      [surface, surface]
    );
  }

  if (results.length > 0 && results[0].values.length > 0) {
    const row = results[0].values[0];
    const meaningEn = row[2];
    const meaningZh = row[3];
    
    // 根据语言偏好选择释义
    let meaning = meaningEn;
    if (lang === 'zh' && meaningZh) {
      meaning = meaningZh;
    } else if (lang === 'ja') {
      meaning = meaningZh || meaningEn; // 日语界面也优先显示中文
    }
    
    return {
      kanji: row[0],
      reading: katakanaToHiragana(row[1]),
      meaning: meaning,
      meaning_en: meaningEn,
      meaning_zh: meaningZh,
      jlpt_level: row[4],
      pos: row[5]
    };
  }

  return null;
}

/**
 * 查询语法
 */
function lookupGrammar(pattern) {
  if (!db) return [];

  const results = db.exec(
    'SELECT pattern, meaning, jlpt_level, explanation, example_ja, example_zh FROM grammar WHERE pattern LIKE ? ORDER BY jlpt_level DESC',
    [`%${pattern}%`]
  );

  if (results.length === 0) return [];

  return results[0].values.map(row => ({
    pattern: row[0],
    meaning: row[1],
    jlpt_level: row[2],
    explanation: row[3],
    example_ja: row[4],
    example_zh: row[5]
  }));
}

/**
 * 获取数据库统计信息
 */
function getStats() {
  if (!db) return { words: 0, grammar: 0 };

  const wordResult = db.exec('SELECT COUNT(*) FROM words');
  const grammarResult = db.exec('SELECT COUNT(*) FROM grammar');

  return {
    words: wordResult[0].values[0][0],
    grammar: grammarResult[0].values[0][0]
  };
}

module.exports = { initDictionary, lookupWord, lookupGrammar, getStats };
