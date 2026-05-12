/**
 * 自动下载 JMdict 词典 JSON 文件
 * 
 * 从 GitHub Releases 下载 jmdict-simplified 的英文版本
 * 使用方法: node scripts/download-jmdict.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RELEASES_API = 'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest';
const DATA_DIR = path.join(__dirname, '../data');

function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { 'User-Agent': 'jlpt-lookup/1.0' },
      ...options
    };

    https.get(url, opts, (res) => {
      // 处理重定向
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location, options).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== JMdict 词典下载工具 ===\n');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 检查是否已有 JSON 文件
  const existingFiles = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('jmdict') && f.endsWith('.json'));
  if (existingFiles.length > 0) {
    console.log(`已存在词典文件: ${existingFiles[0]}`);
    console.log('如需重新下载，请先删除该文件。');
    return;
  }

  console.log('正在获取最新版本信息...');
  
  try {
    const releaseData = await httpsGet(RELEASES_API);
    const release = JSON.parse(releaseData.toString());
    
    console.log(`最新版本: ${release.tag_name}`);
    
    // 查找英文版 JSON zip
    const asset = release.assets.find(a => 
      a.name.includes('jmdict-eng') && a.name.endsWith('.json.zip')
    );

    if (!asset) {
      // 尝试找不带 zip 的
      const jsonAsset = release.assets.find(a => 
        a.name.includes('jmdict-eng') && a.name.endsWith('.json')
      );
      
      if (!jsonAsset) {
        console.log('\n未找到合适的下载文件。');
        console.log('请手动下载:');
        console.log(`  ${release.html_url}`);
        console.log('\n下载 jmdict-eng-*.json.zip 并解压到 data/ 目录');
        return;
      }
    }

    const downloadUrl = asset ? asset.browser_download_url : null;
    const fileName = asset ? asset.name : null;
    const fileSize = asset ? (asset.size / 1024 / 1024).toFixed(1) : '?';

    console.log(`\n下载文件: ${fileName} (${fileSize} MB)`);
    console.log(`下载地址: ${downloadUrl}\n`);
    
    console.log('由于文件较大，建议手动下载：');
    console.log(`\n方法1: 浏览器直接下载`);
    console.log(`  ${downloadUrl}`);
    console.log(`\n方法2: 使用 curl 命令`);
    console.log(`  curl -L -o data/${fileName} "${downloadUrl}"`);
    console.log(`\n方法3: 使用 PowerShell`);
    console.log(`  Invoke-WebRequest -Uri "${downloadUrl}" -OutFile "data/${fileName}"`);
    console.log(`\n下载完成后：`);
    console.log(`  1. 解压 zip 文件到 data/ 目录`);
    console.log(`  2. 运行: node scripts/import-jmdict.js`);

  } catch (err) {
    console.log(`获取版本信息失败: ${err.message}`);
    console.log('\n请手动访问以下地址下载:');
    console.log('  https://github.com/scriptin/jmdict-simplified/releases');
    console.log('\n下载 jmdict-eng-*.json.zip 并解压到 data/ 目录');
    console.log('然后运行: node scripts/import-jmdict.js');
  }
}

main();
