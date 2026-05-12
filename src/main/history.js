/**
 * 查询历史记录模块
 */

const path = require('path');
const fs = require('fs');
const { getUserDataPath } = require('./paths');

const HISTORY_PATH = getUserDataPath('history.json');
const MAX_HISTORY = 100;

let history = [];

/**
 * 加载历史
 */
function loadHistory() {
  if (fs.existsSync(HISTORY_PATH)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
      console.log(`History loaded: ${history.length} items`);
    } catch (e) {
      history = [];
    }
  }
  return history;
}

/**
 * 保存历史
 */
function saveHistory() {
  try {
    const dir = path.dirname(HISTORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history), 'utf-8');
  } catch (e) {
    console.error('Failed to save history:', e.message);
  }
}

/**
 * 获取历史
 */
function getHistory() {
  return history;
}

/**
 * 添加历史记录
 */
function addHistory(text, mode) {
  // 如果已存在相同文本，先删除旧的
  const existingIndex = history.findIndex(h => h.text === text);
  if (existingIndex !== -1) {
    history.splice(existingIndex, 1);
  }

  // 添加到最前面
  history.unshift({
    id: Date.now(),
    text: text,
    mode: mode, // 'word' or 'sentence'
    createdAt: new Date().toISOString()
  });

  // 超出上限时删除最旧的
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  saveHistory();
}

/**
 * 删除单条历史
 */
function removeHistory(id) {
  const index = history.findIndex(h => h.id === id);
  if (index !== -1) {
    history.splice(index, 1);
    saveHistory();
    return { success: true };
  }
  return { success: false };
}

/**
 * 清空历史
 */
function clearHistory() {
  history = [];
  saveHistory();
  return { success: true };
}

module.exports = {
  loadHistory,
  getHistory,
  addHistory,
  removeHistory,
  clearHistory
};
