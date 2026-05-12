/**
 * 导入中文释义到词典数据库
 * 
 * 数据源：JMdict 多语言版本（包含中文翻译）
 * 下载地址：https://github.com/scriptin/jmdict-simplified/releases
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '../data/dictionary.db');
const JMDICT_PATH = path.join(__dirname, '../data/jmdict-all-3.6.1.json');

// 备选路径
const JMDICT_PATHS = [
  path.join(__dirname, '../data/jmdict-all-3.6.2.json'),
  path.join(__dirname, '../data/jmdict-all-3.6.1.json'),
  path.join(__dirname, '../data/jmdict-all.json'),
];

async function importChinese() {
  console.log('Loading JMdict with Chinese definitions...');
  
  // 查找可用的 JMdict 文件
  let jmdictPath = null;
  for (const p of JMDICT_PATHS) {
    if (fs.existsSync(p)) {
      jmdictPath = p;
      break;
    }
  }
  
  if (!jmdictPath) {
    console.log(`\nNo JMdict file found. Tried:`);
    JMDICT_PATHS.forEach(p => console.log(`  - ${p}`));
    console.log('\nPlease download jmdict-all-*.json from:');
    console.log('https://github.com/scriptin/jmdict-simplified/releases');
    console.log('\nOr run: npm run download-chinese');
    process.exit(1);
  }
  
  console.log(`Using: ${jmdictPath}`);
  const data = JSON.parse(fs.readFileSync(jmdictPath, 'utf-8'));
  console.log(`Loaded ${data.words.length} entries`);

  // 初始化数据库
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(dbBuffer);

  // 添加中文释义列（如果不存在）
  try {
    db.run('ALTER TABLE words ADD COLUMN meaning_zh TEXT');
    console.log('Added meaning_zh column');
  } catch (e) {
    console.log('meaning_zh column already exists');
  }

  // 创建临时映射表
  const chineseMap = new Map();
  
  for (const word of data.words) {
    // 获取中文释义
    const zhMeanings = [];
    for (const sense of word.sense || []) {
      // 查找中文翻译 (gloss 中 lang 为 'zho' 或 'chi')
      const zhGloss = (sense.gloss || []).filter(g => 
        g.lang === 'zho' || g.lang === 'chi' || g.lang === 'zh'
      );
      if (zhGloss.length > 0) {
        zhMeanings.push(zhGloss.map(g => g.text).join('；'));
      }
    }
    
    if (zhMeanings.length === 0) continue;
    
    const meaningZh = zhMeanings.join(' / ');
    
    // 获取所有可能的词形
    for (const kanji of word.kanji || []) {
      chineseMap.set(kanji.text, meaningZh);
    }
    for (const kana of word.kana || []) {
      if (!chineseMap.has(kana.text)) {
        chineseMap.set(kana.text, meaningZh);
      }
    }
  }

  console.log(`Found ${chineseMap.size} entries with Chinese definitions`);

  // 批量更新
  const updateStmt = db.prepare('UPDATE words SET meaning_zh = ? WHERE kanji = ? OR reading = ?');
  
  let updated = 0;
  let batch = 0;
  
  db.run('BEGIN TRANSACTION');
  
  for (const [word, meaning] of chineseMap) {
    updateStmt.run([meaning, word, word]);
    updated++;
    batch++;
    
    if (batch >= 5000) {
      db.run('COMMIT');
      db.run('BEGIN TRANSACTION');
      console.log(`Updated ${updated} entries...`);
      batch = 0;
    }
  }
  
  db.run('COMMIT');
  updateStmt.free();

  console.log(`\nTotal updated: ${updated} entries`);

  // 统计有中文释义的词条数
  const countResult = db.exec('SELECT COUNT(*) FROM words WHERE meaning_zh IS NOT NULL AND meaning_zh != ""');
  const zhCount = countResult[0].values[0][0];
  console.log(`Words with Chinese definitions: ${zhCount}`);

  // 保存数据库
  const dbData = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(dbData));
  console.log('\nDatabase saved!');
  
  db.close();
}

importChinese().catch(console.error);
