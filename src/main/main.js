const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { lookupWord, lookupGrammar } = require('./dictionary');
const { tokenize } = require('./tokenizer');
const { loadConfig, saveConfig, getConfig, isLLMEnabled, analyzeSentence, clearCache, getFromCache } = require('./llm');
const { loadFavorites, getFavorites, addFavorite, removeFavorite, updateFavoriteNote, isFavorite, clearFavorites } = require('./favorites');
const { loadHistory, getHistory, addHistory, removeHistory, clearHistory } = require('./history');
const { getUserDataPath } = require('./paths');
const { initUpdater } = require('./updater');

let mainWindow = null;
let popupWindow = null;
let tray = null;

// 应用设置 - 使用用户数据目录（打包后可写）
const APP_CONFIG_PATH = getUserDataPath('app-config.json');
let appConfig = { hotkey: 'Ctrl+Shift+J' };

function loadAppConfig() {
  try {
    if (fs.existsSync(APP_CONFIG_PATH)) {
      appConfig = JSON.parse(fs.readFileSync(APP_CONFIG_PATH, 'utf-8'));
    }
  } catch (e) { /* 使用默认值 */ }
  return appConfig;
}

function saveAppConfig(newConfig) {
  appConfig = { ...appConfig, ...newConfig };
  const dir = path.dirname(APP_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(APP_CONFIG_PATH, JSON.stringify(appConfig, null, 2), 'utf-8');
  return appConfig;
}

function registerHotkey(hotkey) {
  // 先注销所有快捷键
  globalShortcut.unregisterAll();
  
  try {
    const success = globalShortcut.register(hotkey, () => {
      handleLookup();
    });
    if (success) {
      console.log(`Hotkey registered: ${hotkey}`);
      return true;
    }
  } catch (e) {
    console.error(`Hotkey registration failed: ${hotkey}`, e.message);
  }
  
  // 注册失败时回退到默认
  if (hotkey !== 'Ctrl+Shift+J') {
    globalShortcut.register('Ctrl+Shift+J', () => handleLookup());
    console.log('Fallback to default hotkey: Ctrl+Shift+J');
  }
  return false;
}

// 防止多实例
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

function createAppMenu() {
  const { autoUpdater } = require('electron-updater');
  const { shell, dialog } = require('electron');

  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '显示主窗口',
          click: () => mainWindow && mainWindow.show()
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Alt+F4',
          click: () => app.exit()
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查更新...',
          click: () => {
            if (!app.isPackaged) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '检查更新',
                message: '当前为开发版本，无法检查更新。',
                buttons: ['确定']
              });
              return;
            }
            autoUpdater.checkForUpdates().catch(err => {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: '检查更新失败',
                message: err.message,
                buttons: ['确定']
              });
            });
          }
        },
        { type: 'separator' },
        {
          label: '在 GitHub 上查看源码',
          click: () => shell.openExternal('https://github.com/yuanyuana1/jlpt-lookup')
        },
        {
          label: '反馈问题',
          click: () => shell.openExternal('https://github.com/yuanyuana1/jlpt-lookup/issues')
        },
        { type: 'separator' },
        {
          label: '关于 JLPT Lookup',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 JLPT Lookup',
              icon: path.join(__dirname, '../../assets/icon.png'),
              message: 'JLPT Lookup',
              detail: [
                `版本：${app.getVersion()}`,
                '',
                '日语划词查询工具',
                '支持 JLPT N5-N1 词汇查询、语法分析',
                'AI 驱动的句子级深度解析',
                '',
                '© 2025 yuanyuana1'
              ].join('\n'),
              buttons: ['确定']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 680,
    show: true,
    frame: true,
    resizable: true,
    title: 'JLPT Lookup',
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('close', (event) => {
    // 点击关闭时隐藏到托盘而不是退出
    event.preventDefault();
    mainWindow.hide();
  });
}

// 弹窗管理：单例预加载模式
let popupReady = false;

function preloadPopup() {
  if (popupWindow && !popupWindow.isDestroyed()) return;
  popupWindow = new BrowserWindow({
    width: 480,
    height: 450,
    show: false,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    transparent: false,
    minWidth: 300,
    minHeight: 200,
    webPreferences: {
      preload: path.join(__dirname, '../renderer/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  popupReady = false;
  popupWindow.loadFile(path.join(__dirname, '../renderer/popup.html'));
  popupWindow.webContents.once('did-finish-load', () => {
    popupReady = true;
  });
  popupWindow.on('closed', () => {
    popupWindow = null;
    popupReady = false;
    setTimeout(preloadPopup, 200);
  });
}

function hidePopup() {
  if (!popupWindow || popupWindow.isDestroyed()) return;
  popupWindow.hide();
  popupReady = false;
  popupWindow.loadFile(path.join(__dirname, '../renderer/popup.html'));
  popupWindow.webContents.once('did-finish-load', () => {
    popupReady = true;
  });
}

function createTray() {
  // 使用简单的图标（后续可替换为自定义图标）
  tray = new Tray(path.join(__dirname, '../../assets/icon.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => mainWindow.show() },
    { label: '退出', click: () => { app.exit(); } }
  ]);

  tray.setToolTip('JLPT Lookup - 日语划词查询');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow.show());
}

// 处理划词查询
async function handleLookup() {
  const text = clipboard.readText().trim();
  
  if (!text || text.length === 0) return;
  if (!isJapanese(text)) return;

  const lang = appConfig.lang || 'zh';

  try {
    const tokens = await tokenize(text);
    
    const contentTokens = tokens.filter(t => 
      t.pos !== '助詞' && t.pos !== '記号' && t.surface_form.trim()
    );
    const isSentence = contentTokens.length >= 3 || text.length >= 6;

    const results = [];
    for (const token of tokens) {
      if (isSentence && (token.pos === '助詞' || token.pos === '記号' || token.pos === '助動詞')) continue;
      const entry = lookupWord(token.surface_form, token.basic_form, lang);
      if (entry) {
        results.push({
          ...entry,
          surface: token.surface_form,
          reading: token.reading,
          pos: entry.pos || token.pos
        });
      }
    }

    // 同步检查缓存，命中则直接用，否则异步请求
    let llmResult = null;
    let llmPromise = null;
    if (isSentence && isLLMEnabled()) {
      llmResult = getFromCache(text);
      if (!llmResult) {
        llmPromise = analyzeSentence(text);
      }
    }

    const { screen } = require('electron');
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;
    const winW = 480, winH = 450;
    const x = Math.round((width - winW) / 2);
    const y = Math.round((height - winH) / 2);

    const showPopup = () => {
      if (!popupWindow || popupWindow.isDestroyed()) return;

      popupWindow.setPosition(x, y);

      popupWindow.removeAllListeners('blur');
      let canClose = false;
      setTimeout(() => { canClose = true; }, 500);
      popupWindow.on('blur', () => {
        if (canClose) hidePopup();
      });

      popupWindow.webContents.send('lookup-result', {
        mode: isSentence ? 'sentence' : 'word',
        originalText: text,
        tokens,
        results,
        llmAnalysis: llmResult,
        loading: !!llmPromise
      });
      popupWindow.show();

      if (llmPromise) {
        llmPromise.then(analysis => {
          if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) {
            popupWindow.webContents.send('llm-result', analysis);
          }
        });
      }
    };

    if (popupReady) {
      showPopup();
    } else {
      if (!popupWindow || popupWindow.isDestroyed()) preloadPopup();
      popupWindow.webContents.once('did-finish-load', () => {
        popupReady = true;
        showPopup();
      });
    }
  } catch (err) {
    console.error('Lookup error:', err);
  }
}

// 检测是否包含日文
function isJapanese(text) {
  // 平假名、片假名、汉字范围
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

app.whenReady().then(async () => {
  // 初始化分词器
  const { initTokenizer } = require('./tokenizer');
  await initTokenizer();

  // 初始化词典
  const { initDictionary } = require('./dictionary');
  await initDictionary();

  // 加载 LLM 配置（同时预热，避免第一次查询时懒加载阻塞）
  loadConfig();
  isLLMEnabled();
  getFromCache('__warmup__');

  // 加载收藏
  loadFavorites();

  // 加载历史
  loadHistory();

  // 加载应用配置并注册快捷键
  loadAppConfig();

  createMainWindow();
  createTray();
  createAppMenu();

  registerHotkey(appConfig.hotkey);

  // 预加载弹窗，避免首次触发快捷键时等待页面加载
  preloadPopup();

  console.log(`JLPT Lookup started. Use ${appConfig.hotkey} to look up selected Japanese text.`);

  // 初始化自动更新
  initUpdater(mainWindow);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC 处理
ipcMain.handle('lookup', async (event, text) => {
  if (!text || !isJapanese(text)) return null;
  
  const lang = appConfig.lang || 'zh';
  const tokens = await tokenize(text);
  
  // 判断是单词模式还是句子模式
  const contentTokens = tokens.filter(t => 
    t.pos !== '助詞' && t.pos !== '記号' && t.surface_form.trim()
  );
  const isSentence = contentTokens.length >= 3 || text.length >= 6;

  if (!isSentence) {
    // === 单词模式：纯本地查询，毫秒级 ===
    const results = [];
    for (const token of tokens) {
      const entry = lookupWord(token.surface_form, token.basic_form, lang);
      if (entry) {
        results.push({
          ...entry,
          surface: token.surface_form,
          reading: token.reading,
          pos: entry.pos || token.pos
        });
      }
    }
    const grammarResults = lookupGrammar(text);
    return { mode: 'word', originalText: text, tokens, results, grammarResults, llmAnalysis: null };
  } else {
    // === 句子模式：先返回本地结果，不等 LLM ===
    const results = [];
    for (const token of tokens) {
      if (token.pos === '助詞' || token.pos === '記号' || token.pos === '助動詞') continue;
      const entry = lookupWord(token.surface_form, token.basic_form, lang);
      if (entry) {
        results.push({
          ...entry,
          surface: token.surface_form,
          reading: token.reading,
          pos: entry.pos || token.pos
        });
      }
    }
    return { mode: 'sentence', originalText: text, tokens, results, llmAnalysis: null, llmPending: isLLMEnabled() };
  }
});

ipcMain.handle('close-popup', () => {
  hidePopup();
});

// LLM 相关 IPC
ipcMain.handle('llm-analyze', async (event, text) => {
  if (!text || !isJapanese(text)) return null;
  return await analyzeSentence(text);
});

ipcMain.handle('llm-get-config', () => {
  return getConfig();
});

ipcMain.handle('llm-save-config', (event, newConfig) => {
  return saveConfig(newConfig);
});

ipcMain.handle('llm-is-enabled', () => {
  return isLLMEnabled();
});

// 快捷键相关 IPC
ipcMain.handle('get-app-config', () => {
  return appConfig;
});

ipcMain.handle('set-hotkey', (event, hotkey) => {
  const success = registerHotkey(hotkey);
  if (success) {
    saveAppConfig({ hotkey });
    return { success: true, hotkey };
  }
  return { success: false, hotkey: appConfig.hotkey, error: '快捷键注册失败，可能与其他程序冲突' };
});

ipcMain.handle('save-app-config', (event, config) => {
  return saveAppConfig(config);
});

ipcMain.handle('llm-clear-cache', () => {
  clearCache();
  return { success: true };
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// 收藏相关 IPC
ipcMain.handle('favorites-get', () => {
  return getFavorites();
});

ipcMain.handle('favorites-add', (event, item) => {
  return addFavorite(item);
});

ipcMain.handle('favorites-remove', (event, id) => {
  return removeFavorite(id);
});

ipcMain.handle('favorites-update-note', (event, id, note) => {
  return updateFavoriteNote(id, note);
});

ipcMain.handle('favorites-check', (event, word) => {
  return isFavorite(word);
});

ipcMain.handle('favorites-clear', () => {
  return clearFavorites();
});

// 历史记录相关 IPC
ipcMain.handle('history-get', () => {
  return getHistory();
});

ipcMain.handle('history-add', (event, text, mode) => {
  addHistory(text, mode);
  return { success: true };
});

ipcMain.handle('history-remove', (event, id) => {
  return removeHistory(id);
});

ipcMain.handle('history-clear', () => {
  return clearHistory();
});
