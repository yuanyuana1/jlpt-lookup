/**
 * 收藏/生词本模块
 */

const path = require('path');
const fs = require('fs');
const { getUserDataPath } = require('./paths');

const FAVORITES_PATH = getUserDataPath('favorites.json');

// 内存中的收藏列表
let favorites = [];

/**
 * 加载收藏
 */
function loadFavorites() {
  if (fs.existsSync(FAVORITES_PATH)) {
    try {
      favorites = JSON.parse(fs.readFileSync(FAVORITES_PATH, 'utf-8'));
      console.log(`Favorites loaded: ${favorites.length} items`);
    } catch (e) {
      favorites = [];
    }
  }
  return favorites;
}

/**
 * 保存收藏
 */
function saveFavorites() {
  try {
    const dir = path.dirname(FAVORITES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FAVORITES_PATH, JSON.stringify(favorites, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save favorites:', e.message);
  }
}

/**
 * 获取所有收藏
 */
function getFavorites() {
  return favorites;
}

/**
 * 添加收藏
 * @param {Object} item - { word, reading, meaning, jlpt_level, pos, note }
 */
function addFavorite(item) {
  // 检查是否已存在（按 word 去重）
  const exists = favorites.find(f => f.word === item.word);
  if (exists) {
    return { success: false, message: 'already_exists' };
  }

  const newItem = {
    id: Date.now(),
    word: item.word || '',
    reading: item.reading || '',
    meaning: item.meaning || '',
    jlpt_level: item.jlpt_level || null,
    pos: item.pos || '',
    note: item.note || '',
    createdAt: new Date().toISOString()
  };

  favorites.unshift(newItem); // 新的放前面
  saveFavorites();
  
  return { success: true, item: newItem };
}

/**
 * 删除收藏
 */
function removeFavorite(id) {
  const index = favorites.findIndex(f => f.id === id);
  if (index === -1) {
    return { success: false, message: 'not_found' };
  }
  
  favorites.splice(index, 1);
  saveFavorites();
  
  return { success: true };
}

/**
 * 更新收藏备注
 */
function updateFavoriteNote(id, note) {
  const item = favorites.find(f => f.id === id);
  if (!item) {
    return { success: false, message: 'not_found' };
  }
  
  item.note = note;
  saveFavorites();
  
  return { success: true, item };
}

/**
 * 检查是否已收藏
 */
function isFavorite(word) {
  return favorites.some(f => f.word === word);
}

/**
 * 清空所有收藏
 */
function clearFavorites() {
  favorites = [];
  saveFavorites();
  return { success: true };
}

module.exports = {
  loadFavorites,
  getFavorites,
  addFavorite,
  removeFavorite,
  updateFavoriteNote,
  isFavorite,
  clearFavorites
};
