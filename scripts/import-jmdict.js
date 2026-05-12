/**
 * JMdict 完整词典导入脚本
 * 
 * 使用方法：
 * 1. 从 https://github.com/scriptin/jmdict-simplified/releases 下载最新的:
 *    - jmdict-eng-3.6.1.json.zip (英文释义)
 *    解压后得到 jmdict-eng-3.6.1.json（文件名可能不同）
 * 
 * 2. 将 JSON 文件放到项目根目录的 data/ 文件夹下
 * 
 * 3. 运行: node scripts/import-jmdict.js
 * 
 * JSON 格式说明 (jmdict-simplified):
 * {
 *   "words": [
 *     {
 *       "id": "1000220",
 *       "kanji": [{ "text": "明白", "common": true }],
 *       "kana": [{ "text": "あからさま", "common": true }],
 *       "sense": [{
 *         "partOfSpeech": ["adj-na", "adj-no"],
 *         "gloss": [{ "lang": "eng", "text": "plain" }]
 *       }]
 *     }
 *   ]
 * }
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// JLPT 词汇表（简化版，实际可从外部文件加载）
// 这里内置一个基础的 JLPT 等级映射
const JLPT_LEVELS = {};

async function loadJlptData() {
  // 尝试加载 JLPT 词汇文件
  const jlptFile = path.join(__dirname, '../data/jlpt-vocab.json');
  if (fs.existsSync(jlptFile)) {
    const data = JSON.parse(fs.readFileSync(jlptFile, 'utf-8'));
    for (const [level, words] of Object.entries(data)) {
      for (const word of words) {
        JLPT_LEVELS[word] = parseInt(level);
      }
    }
    console.log(`已加载 JLPT 词汇表: ${Object.keys(JLPT_LEVELS).length} 个词`);
  } else {
    console.log('未找到 JLPT 词汇文件，将跳过 JLPT 等级标注');
    console.log('（可稍后运行 node scripts/import-jlpt.js 导入）');
  }
}

// 词性映射：JMdict 缩写 → 中文
const POS_MAP = {
  'n': '名词',
  'v1': '一段动词',
  'v5': '五段动词',
  'v5u': '五段动词(う)',
  'v5k': '五段动词(く)',
  'v5g': '五段动词(ぐ)',
  'v5s': '五段动词(す)',
  'v5t': '五段动词(つ)',
  'v5n': '五段动词(ぬ)',
  'v5b': '五段动词(ぶ)',
  'v5m': '五段动词(む)',
  'v5r': '五段动词(る)',
  'vs': 'サ変动词',
  'vs-i': 'サ変动词',
  'vk': 'カ変动词',
  'adj-i': 'い形容词',
  'adj-na': 'な形容词',
  'adj-no': '连体词',
  'adv': '副词',
  'conj': '接续词',
  'int': '感叹词',
  'prt': '助词',
  'pn': '代词',
  'suf': '接尾词',
  'pref': '接头词',
  'exp': '表达',
  'aux-v': '助动词',
  'aux-adj': '助形容词',
  'ctr': '量词',
  'num': '数词',
};

function getPos(partOfSpeech) {
  if (!partOfSpeech || partOfSpeech.length === 0) return '';
  
  for (const pos of partOfSpeech) {
    // 尝试精确匹配
    if (POS_MAP[pos]) return POS_MAP[pos];
    
    // 尝试前缀匹配
    for (const [key, value] of Object.entries(POS_MAP)) {
      if (pos.startsWith(key)) return value;
    }
  }
  
  return partOfSpeech[0] || '';
}

function getJlptLevel(kanji, kana) {
  // 先查汉字
  if (kanji && JLPT_LEVELS[kanji]) return JLPT_LEVELS[kanji];
  // 再查假名
  if (kana && JLPT_LEVELS[kana]) return JLPT_LEVELS[kana];
  return null;
}

async function main() {
  console.log('=== JMdict 词典导入工具 ===\n');

  // 查找 JSON 文件
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const files = fs.readdirSync(dataDir).filter(f => f.startsWith('jmdict') && f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('错误：未找到 JMdict JSON 文件！\n');
    console.log('请按以下步骤操作：');
    console.log('1. 访问 https://github.com/scriptin/jmdict-simplified/releases');
    console.log('2. 下载最新的 jmdict-eng-*.json.zip');
    console.log('3. 解压 JSON 文件到 data/ 目录');
    console.log('4. 重新运行此脚本\n');
    process.exit(1);
  }

  const jsonFile = path.join(dataDir, files[0]);
  console.log(`找到词典文件: ${files[0]}`);

  // 加载 JLPT 数据
  await loadJlptData();

  // 读取 JSON
  console.log('\n正在读取 JSON 文件（可能需要几秒钟）...');
  const rawData = fs.readFileSync(jsonFile, 'utf-8');
  const dictData = JSON.parse(rawData);
  
  const words = dictData.words;
  console.log(`共 ${words.length} 个词条\n`);

  // 初始化数据库
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY,
      kanji TEXT,
      reading TEXT NOT NULL,
      meaning TEXT NOT NULL,
      jlpt_level INTEGER,
      pos TEXT,
      tags TEXT,
      is_common INTEGER DEFAULT 0
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_words_kanji ON words(kanji)');
  db.run('CREATE INDEX IF NOT EXISTS idx_words_reading ON words(reading)');
  db.run('CREATE INDEX IF NOT EXISTS idx_words_jlpt ON words(jlpt_level)');
  db.run('CREATE INDEX IF NOT EXISTS idx_words_common ON words(is_common)');

  // 保留语法表
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

  // 批量插入
  console.log('正在导入词典数据...');
  const stmt = db.prepare(
    'INSERT INTO words (id, kanji, reading, meaning, jlpt_level, pos, is_common) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  let imported = 0;
  let skipped = 0;
  const startTime = Date.now();

  db.run('BEGIN TRANSACTION');

  for (const word of words) {
    try {
      // 获取汉字写法
      const kanjiText = word.kanji && word.kanji.length > 0 
        ? word.kanji[0].text 
        : null;
      
      // 获取假名读音
      const kanaText = word.kana && word.kana.length > 0 
        ? word.kana[0].text 
        : null;

      if (!kanaText) {
        skipped++;
        continue;
      }

      // 获取释义（英文）
      const meanings = [];
      if (word.sense) {
        for (const sense of word.sense) {
          if (sense.gloss) {
            for (const g of sense.gloss) {
              if (g.lang === 'eng' || !g.lang) {
                meanings.push(g.text);
              }
            }
          }
        }
      }

      if (meanings.length === 0) {
        skipped++;
        continue;
      }

      const meaningText = meanings.slice(0, 5).join('; '); // 最多取5个释义

      // 获取词性
      const pos = word.sense && word.sense[0] 
        ? getPos(word.sense[0].partOfSpeech) 
        : '';

      // 判断是否常用词
      const isCommon = (word.kanji && word.kanji[0] && word.kanji[0].common) ||
                       (word.kana && word.kana[0] && word.kana[0].common) ? 1 : 0;

      // 获取 JLPT 等级
      const jlptLevel = getJlptLevel(kanjiText, kanaText);

      // 插入数据库
      stmt.run([
        parseInt(word.id),
        kanjiText,
        kanaText,
        meaningText,
        jlptLevel,
        pos,
        isCommon
      ]);

      imported++;

      // 进度显示
      if (imported % 10000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  已导入 ${imported} 条 (${elapsed}s)`);
      }
    } catch (err) {
      skipped++;
    }
  }

  stmt.free();
  db.run('COMMIT');

  // 插入语法数据
  console.log('\n正在导入语法数据...');
  insertGrammarData(db);

  // 保存数据库
  const dbPath = path.join(dataDir, 'dictionary.db');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const fileSize = (buffer.length / 1024 / 1024).toFixed(1);

  console.log(`\n=== 导入完成 ===`);
  console.log(`导入: ${imported} 条`);
  console.log(`跳过: ${skipped} 条`);
  console.log(`耗时: ${elapsed}s`);
  console.log(`数据库大小: ${fileSize} MB`);
  console.log(`保存位置: ${dbPath}`);
}

function insertGrammarData(db) {
  const grammarData = [
    // N5 语法
    ['〜ている', '正在做...；表示状态', 5, '动词て形+いる，表示动作正在进行或结果状态的持续', '今、本を読んでいます。', '现在正在读书。'],
    ['〜たい', '想要做...', 5, '动词ます形去掉ます+たい，表示说话人的愿望', '日本に行きたいです。', '想去日本。'],
    ['〜てください', '请做...', 5, '动词て形+ください，表示请求', 'ここに名前を書いてください。', '请在这里写名字。'],
    ['〜ないでください', '请不要做...', 5, '动词ない形+でください，表示请求不要做某事', 'ここで写真を撮らないでください。', '请不要在这里拍照。'],
    ['〜てもいい', '可以做...', 5, '动词て形+もいい，表示许可', 'ここに座ってもいいですか。', '可以坐这里吗？'],
    ['〜てはいけない', '不可以做...', 5, '动词て形+はいけない，表示禁止', 'ここでタバコを吸ってはいけません。', '不可以在这里吸烟。'],
    ['〜から', '因为...', 5, '句子+から，表示原因理由', '暑いですから、窓を開けてください。', '因为很热，请打开窗户。'],
    ['〜ましょう', '一起做...吧', 5, '动词ます形+ましょう，表示提议', '一緒に食べましょう。', '一起吃吧。'],
    ['〜つもり', '打算做...', 5, '动词辞书形+つもり，表示意图', '来年日本に行くつもりです。', '打算明年去日本。'],
    ['〜ことがある', '有时会...', 5, '动词辞书形+ことがある，表示偶尔发生', '朝ご飯を食べないことがあります。', '有时不吃早饭。'],
    
    // N4 语法
    ['〜なければならない', '必须做...', 4, '动词ない形去掉ない+なければならない，表示义务', '毎日勉強しなければならない。', '必须每天学习。'],
    ['〜ことができる', '能够做...', 4, '动词辞书形+ことができる，表示能力或可能性', '日本語を話すことができます。', '能说日语。'],
    ['〜たことがある', '曾经做过...', 4, '动词た形+ことがある，表示经验', '日本に行ったことがあります。', '去过日本。'],
    ['〜ながら', '一边...一边...', 4, '动词ます形+ながら，表示同时进行两个动作', '音楽を聞きながら勉強します。', '一边听音乐一边学习。'],
    ['〜てしまう', '做完了...（遗憾/完成）', 4, '动词て形+しまう，表示完成或遗憾', '財布を忘れてしまいました。', '把钱包忘了。'],
    ['〜そうだ（様態）', '看起来要...', 4, '动词ます形/形容词词干+そうだ，表示样态推测', '雨が降りそうです。', '看起来要下雨了。'],
    ['〜そうだ（伝聞）', '听说...', 4, '普通形+そうだ，表示传闻', '明日は雨だそうです。', '听说明天下雨。'],
    ['〜ようにする', '努力做到...', 4, '动词辞书形/ない形+ようにする，表示努力', '早く寝るようにしています。', '我在努力早睡。'],
    ['〜ようになる', '变得能够...', 4, '动词辞书形+ようになる，表示变化', '日本語が話せるようになった。', '变得能说日语了。'],
    ['〜ても', '即使...也...', 4, '动词て形+も，表示让步', '雨が降っても行きます。', '即使下雨也去。'],
    ['〜たら', '如果...的话', 4, '动词た形+ら，表示条件', '暇だったら遊びに来てください。', '如果有空的话请来玩。'],
    ['〜ば', '如果...的话', 4, '动词假定形+ば，表示条件', '安ければ買います。', '如果便宜的话就买。'],
    ['〜のに', '明明...却...', 4, '普通形+のに，表示不满或遗憾', '約束したのに来なかった。', '明明约好了却没来。'],
    ['〜てあげる', '为别人做...', 4, '动词て形+あげる，表示为他人做某事', '友達に本を貸してあげた。', '借书给朋友了。'],
    ['〜てもらう', '请别人做...', 4, '动词て形+もらう，表示接受恩惠', '友達に教えてもらった。', '请朋友教了我。'],
    ['〜てくれる', '别人为我做...', 4, '动词て形+くれる，表示他人为我做某事', '母が料理を作ってくれた。', '妈妈给我做了饭。'],
    ['〜させる', '让/使...做', 4, '使役形，表示让某人做某事', '子供に野菜を食べさせる。', '让孩子吃蔬菜。'],
    ['〜られる（受身）', '被...', 4, '被动形，表示被动', '先生に褒められた。', '被老师表扬了。'],
    ['〜と思う', '我认为...', 4, '普通形+と思う，表示想法', '明日は晴れると思います。', '我认为明天会晴天。'],
    
    // N3 语法
    ['〜ようにする', '努力做到...', 3, '动词辞书形/ない形+ようにする，表示努力使某状态实现', '早く寝るようにしています。', '我在努力早睡。'],
    ['〜ことにする', '决定做...', 3, '动词辞书形+ことにする，表示决定', '来月から運動することにした。', '决定从下个月开始运动。'],
    ['〜ことになる', '（被）决定...', 3, '动词辞书形+ことになる，表示客观决定', '来月転勤することになった。', '（被决定）下个月调动工作。'],
    ['〜ために', '为了...', 3, '动词辞书形/名词の+ために，表示目的', '日本語を勉強するために日本に来た。', '为了学日语来了日本。'],
    ['〜ように', '为了能...', 3, '动词辞书形/ない形+ように，表示目标', '忘れないようにメモした。', '为了不忘记做了笔记。'],
    ['〜はずだ', '应该...', 3, '普通形+はずだ，表示推断', '彼はもう着いたはずです。', '他应该已经到了。'],
    ['〜わけだ', '也就是说...', 3, '普通形+わけだ，表示理所当然的结论', 'つまり、彼は来ないわけだ。', '也就是说，他不来了。'],
    ['〜ばかり', '刚刚...', 3, '动词た形+ばかり，表示刚做完', '日本に来たばかりです。', '刚来日本。'],
    ['〜ところ', '正要/正在/刚刚...', 3, '动词辞书形/ている/た形+ところ，表示时间点', '今出かけるところです。', '正要出门。'],
    ['〜ことはない', '没必要...', 3, '动词辞书形+ことはない，表示不必要', '心配することはない。', '没必要担心。'],
    ['〜っぽい', '有...的倾向', 3, '名词/动词ます形+っぽい，表示倾向', '最近忘れっぽくなった。', '最近变得容易忘事了。'],
    ['〜がち', '容易...；往往...', 3, '动词ます形/名词+がち，表示消极倾向', '彼は遅刻しがちだ。', '他容易迟到。'],
    ['〜おかげで', '多亏了...', 3, '普通形+おかげで，表示积极原因', '先生のおかげで合格できた。', '多亏了老师才能合格。'],
    ['〜せいで', '因为...（消极）', 3, '普通形+せいで，表示消极原因', '雨のせいで試合が中止になった。', '因为下雨比赛取消了。'],
    ['〜として', '作为...', 3, '名词+として，表示身份立场', '留学生として日本に来た。', '作为留学生来了日本。'],
    ['〜に対して', '对于...', 3, '名词+に対して，表示对象', '先生に対して失礼だ。', '对老师很失礼。'],
    ['〜について', '关于...', 3, '名词+について，表示话题', '日本の文化について調べた。', '调查了关于日本文化的内容。'],
    ['〜によって', '根据.../由于...', 3, '名词+によって，表示手段/原因/依据', '国によって文化が違う。', '不同国家文化不同。'],
    
    // N2 语法
    ['〜わけではない', '并不是...', 2, '用于部分否定，表示事情并非完全如此', '嫌いなわけではない。', '并不是讨厌。'],
    ['〜に違いない', '一定是...', 2, '表示强烈的推测和确信', '彼は知っているに違いない。', '他一定知道。'],
    ['〜わけにはいかない', '不能...', 2, '动词辞书形+わけにはいかない，表示不能做某事', '約束を破るわけにはいかない。', '不能违背约定。'],
    ['〜ざるを得ない', '不得不...', 2, '动词ない形去ない+ざるを得ない，表示不得已', '行かざるを得ない。', '不得不去。'],
    ['〜に過ぎない', '只不过是...', 2, '名词/动词普通形+に過ぎない，表示程度低', 'これは始まりに過ぎない。', '这只不过是开始。'],
    ['〜どころか', '别说...连...', 2, '名词/动词普通形+どころか，表示程度超出预期', '漢字どころかひらがなも読めない。', '别说汉字，连平假名都不会读。'],
    ['〜一方だ', '越来越...', 2, '动词辞书形+一方だ，表示持续变化', '物価は上がる一方だ。', '物价越来越高。'],
    ['〜つつある', '正在逐渐...', 2, '动词ます形+つつある，表示渐进变化', '状況は改善しつつある。', '状况正在逐渐改善。'],
    ['〜上で', '在...之后/方面', 2, '动词た形/名词の+上で，表示前提', '相談した上で決めます。', '商量之后再决定。'],
    ['〜次第', '一...就...', 2, '动词ます形+次第，表示立即', '届き次第連絡します。', '一收到就联系你。'],
    ['〜に伴って', '随着...', 2, '名词/动词辞书形+に伴って，表示伴随', '経済の発展に伴って問題も増えた。', '随着经济发展问题也增多了。'],
    ['〜を通じて', '通过...', 2, '名词+を通じて，表示手段或期间', 'インターネットを通じて情報を得る。', '通过网络获取信息。'],
    ['〜に基づいて', '基于...', 2, '名词+に基づいて，表示依据', '事実に基づいて判断する。', '基于事实进行判断。'],
    ['〜からといって', '虽说...但不一定...', 2, '普通形+からといって，表示不能因此就...', '安いからといって買いすぎてはいけない。', '不能因为便宜就买太多。'],
    ['〜としても', '即使...也...', 2, '普通形+としても，表示假设让步', '失敗したとしても後悔しない。', '即使失败了也不后悔。'],
    
    // N1 语法
    ['〜ものを', '本来...却...（遗憾）', 1, '普通形+ものを，表示遗憾不满', '言ってくれればよかったものを。', '你要是说了就好了。'],
    ['〜ともなると', '一旦到了...的程度', 1, '名词+ともなると，表示达到某程度', '社長ともなると責任が重い。', '一旦当了社长责任就重了。'],
    ['〜をもって', '以...', 1, '名词+をもって，表示手段/期限', '本日をもって閉店いたします。', '以今天为止关店。'],
    ['〜に至って', '到了...的地步', 1, '名词/动词辞书形+に至って，表示事态发展', '事態はここに至って深刻になった。', '事态到了这个地步变得严重了。'],
    ['〜ないものでもない', '也不是不能...', 1, '动词ない形+ものでもない，表示委婉肯定', 'やれないものでもない。', '也不是做不到。'],
    ['〜ずにはいられない', '不由得...', 1, '动词ない形去ない+ずにはいられない，表示无法抑制', '笑わずにはいられなかった。', '不由得笑了。'],
    ['〜てやまない', '衷心地...', 1, '动词て形+やまない，表示强烈持续的感情', '成功を願ってやまない。', '衷心祝愿成功。'],
    ['〜極まりない', '极其...', 1, 'な形容词词干+極まりない，表示极端程度', '失礼極まりない態度だ。', '极其失礼的态度。'],
    ['〜たりとも〜ない', '一...也不...', 1, '数量词+たりとも+ない，表示完全否定', '一秒たりとも無駄にしない。', '一秒也不浪费。'],
    ['〜をおいて〜ない', '除了...没有...', 1, '名词+をおいて+ない，表示唯一', '彼をおいて適任者はいない。', '除了他没有合适的人。'],
  ];

  const stmt = db.prepare(
    'INSERT INTO grammar (pattern, meaning, jlpt_level, explanation, example_ja, example_zh) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const item of grammarData) {
    stmt.run(item);
  }
  stmt.free();

  console.log(`已导入 ${grammarData.length} 条语法`);
}

main().catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
