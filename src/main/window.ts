import { BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'path';

export const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
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