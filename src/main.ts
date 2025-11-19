import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile('index.html');
};

app.on('ready', () => {
  ipcMain.handle('fetch-url', async (_event, url: string) => {
    try {
      const { stdout, stderr } = await execAsync(`curl -s "${url}"`);
      if (stderr) {
        return { success: false, error: stderr };
      }
      return { success: true, data: stdout };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});