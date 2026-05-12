/**
 * 下载包含中文释义的 JMdict 完整版
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOWNLOAD_URL = 'https://github.com/scriptin/jmdict-simplified/releases/latest/download/jmdict-all-3.6.1.json.zip';
const ZIP_PATH = path.join(__dirname, '../data/jmdict-all.json.zip');
const JSON_PATH = path.join(__dirname, '../data/jmdict-all-3.6.1.json');
const DATA_DIR = path.join(__dirname, '../data');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log('Downloading JMdict (all languages)...');
    console.log('URL:', url);
    console.log('This may take a few minutes...\n');

    const file = fs.createWriteStream(dest);
    
    const request = (url) => {
      https.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          console.log('Redirecting to:', response.headers.location);
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalSize) {
            const percent = ((downloaded / totalSize) * 100).toFixed(1);
            process.stdout.write(`\rDownloading: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log('\nDownload complete!');
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

async function main() {
  // 确保 data 目录存在
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 如果 JSON 已存在，跳过下载
  if (fs.existsSync(JSON_PATH)) {
    console.log('jmdict-all-3.6.2.json already exists, skipping download.');
    return;
  }

  try {
    await downloadFile(DOWNLOAD_URL, ZIP_PATH);
    
    console.log('\nExtracting...');
    
    // 使用 PowerShell 解压
    try {
      execSync(`powershell -Command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${DATA_DIR}' -Force"`, {
        stdio: 'inherit'
      });
      console.log('Extraction complete!');
      
      // 删除 zip 文件
      fs.unlinkSync(ZIP_PATH);
      console.log('Cleaned up zip file.');
      
    } catch (e) {
      console.log('\nAuto-extraction failed. Please manually extract:');
      console.log(`  ${ZIP_PATH}`);
      console.log(`  to: ${DATA_DIR}`);
    }

    console.log('\nNext step: run "npm run import-chinese" to import Chinese definitions.');
    
  } catch (err) {
    console.error('Download failed:', err.message);
    console.log('\nPlease manually download from:');
    console.log('https://github.com/scriptin/jmdict-simplified/releases');
    console.log('Look for: jmdict-all-3.6.2.json.zip');
  }
}

main();
