const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 查词
  lookup: (text) => ipcRenderer.invoke('lookup', text),
  closePopup: () => ipcRenderer.invoke('close-popup'),
  onLookupResult: (callback) => {
    ipcRenderer.on('lookup-result', (event, data) => callback(data));
  },
  onLLMResult: (callback) => {
    ipcRenderer.on('llm-result', (event, data) => callback(data));
  },

  // LLM 相关
  llmAnalyze: (text) => ipcRenderer.invoke('llm-analyze', text),
  llmGetConfig: () => ipcRenderer.invoke('llm-get-config'),
  llmSaveConfig: (config) => ipcRenderer.invoke('llm-save-config', config),
  llmIsEnabled: () => ipcRenderer.invoke('llm-is-enabled'),
  llmClearCache: () => ipcRenderer.invoke('llm-clear-cache'),

  // 应用设置
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  setHotkey: (hotkey) => ipcRenderer.invoke('set-hotkey', hotkey),
  saveAppConfig: (config) => ipcRenderer.invoke('save-app-config', config),

  // 收藏/生词本
  favoritesGet: () => ipcRenderer.invoke('favorites-get'),
  favoritesAdd: (item) => ipcRenderer.invoke('favorites-add', item),
  favoritesRemove: (id) => ipcRenderer.invoke('favorites-remove', id),
  favoritesUpdateNote: (id, note) => ipcRenderer.invoke('favorites-update-note', id, note),
  favoritesCheck: (word) => ipcRenderer.invoke('favorites-check', word),
  favoritesClear: () => ipcRenderer.invoke('favorites-clear'),

  // 历史记录
  historyGet: () => ipcRenderer.invoke('history-get'),
  historyAdd: (text, mode) => ipcRenderer.invoke('history-add', text, mode),
  historyRemove: (id) => ipcRenderer.invoke('history-remove', id),
  historyClear: () => ipcRenderer.invoke('history-clear'),

  // 自动更新
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, info) => cb(info)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', () => cb()),
  onUpdateDownloadProgress: (cb) => ipcRenderer.on('update-download-progress', (_, p) => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, info) => cb(info)),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_, msg) => cb(msg))
});
