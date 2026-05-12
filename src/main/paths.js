/**
 * 路径解析工具
 * 
 * 开发环境：数据文件在项目根目录 data/
 * 打包环境：
 *   - 只读资源（dictionary.db）在 process.resourcesPath/data/
 *   - 可写数据（config、favorites、history、cache）在 app.getPath('userData')
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const isPacked = app.isPackaged;

/**
 * 获取只读资源路径（dictionary.db 等打包进去的文件）
 */
function getResourcePath(...segments) {
  if (isPacked) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(__dirname, '../../', ...segments);
}

/**
 * 获取可写用户数据路径（config、favorites、history、cache）
 * 打包后写到 %APPDATA%/jlpt-lookup/
 * 开发时写到项目 data/ 目录
 */
function getUserDataPath(...segments) {
  if (isPacked) {
    const userDataDir = path.join(app.getPath('userData'), 'data');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    return path.join(userDataDir, ...segments);
  }
  return path.join(__dirname, '../../data', ...segments);
}

module.exports = { getResourcePath, getUserDataPath };
