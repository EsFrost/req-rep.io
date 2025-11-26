import { BrowserWindow, Menu, ipcMain, app } from 'electron';
import path from 'path';

export const createWindow = (): BrowserWindow => {
  let iconPath: string;
  
  if (app.isPackaged) {
    
    if (process.platform === 'win32') {
      iconPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'icons', 'win', 'icon.ico');
    } else if (process.platform === 'darwin') {
      iconPath = path.join(process.resourcesPath, 'build', 'icons', 'mac', 'icon.icns');
    } else {
      iconPath = path.join(process.resourcesPath, 'build', 'icons', 'png', '512x512.png');
    }
  } else {
    if (process.platform === 'win32') {
      iconPath = path.join(__dirname, '../../build/icons/win/icon.ico');
    } else if (process.platform === 'darwin') {
      iconPath = path.join(__dirname, '../../build/icons/mac/icon.icns');
    } else {
      iconPath = path.join(__dirname, '../../build/icons/png/512x512.png');
    }
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Hide the menu by default
  win.setMenuBarVisibility(false);
  
  win.loadFile('index.html');

  // Handle menu toggle
  ipcMain.on('toggle-menu', () => {
    const isVisible = win.isMenuBarVisible();
    win.setMenuBarVisibility(!isVisible);
  });
  
  return win;
};