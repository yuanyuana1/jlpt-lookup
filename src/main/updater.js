/**
 * 自动更新模块
 * 使用 electron-updater + GitHub Releases
 */

const { autoUpdater } = require('electron-updater');
const { ipcMain, BrowserWindow } = require('electron');

// 关闭自动下载，让用户决定
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let updateWindow = null;

/**
 * 初始化更新检查
 * @param {BrowserWindow} mainWin - 主窗口，用于发送通知
 */
function initUpdater(mainWin) {
  // 开发模式下不检查更新
  if (!require('electron').app.isPackaged) {
    console.log('Updater: skipped in dev mode');
    return;
  }

  // 检查到新版本
  autoUpdater.on('update-available', (info) => {
    console.log(`Update available: ${info.version}`);
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes || ''
      });
    }
  });

  // 没有新版本
  autoUpdater.on('update-not-available', () => {
    console.log('No update available');
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('update-not-available');
    }
  });

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('update-download-progress', {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total
      });
    }
  });

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    console.log(`Update downloaded: ${info.version}`);
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('update-downloaded', { version: info.version });
    }
  });

  // 错误处理
  autoUpdater.on('error', (err) => {
    console.error('Updater error:', err.message);
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('update-error', err.message);
    }
  });

  // 启动后 5 秒检查更新（不影响启动速度）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('Check update failed:', err.message);
    });
  }, 5000);
}

// IPC 接口
ipcMain.handle('check-for-updates', async () => {
  if (!require('electron').app.isPackaged) {
    return { status: 'dev', message: '开发模式下不检查更新' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: 'checking' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

ipcMain.handle('download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

module.exports = { initUpdater };
