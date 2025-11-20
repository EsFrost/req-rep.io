import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { HistoryEntry } from '../../shared/types';

export class HistoryStorage {
  private storagePath: string;
  private maxEntries = 100;
  
  constructor() {
    const userDataPath = app.getPath('userData');
    this.storagePath = path.join(userDataPath, 'history.json');
    this.ensureStorageFile();
  }
  
  private ensureStorageFile(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify([]));
    }
  }
  
  get(limit?: number): HistoryEntry[] {
    try {
      const data = fs.readFileSync(this.storagePath, 'utf-8');
      const history = JSON.parse(data);
      return limit ? history.slice(0, limit) : history;
    } catch {
      return [];
    }
  }
  
  add(entry: HistoryEntry): void {
    const history = this.get();
    history.unshift(entry);
    
    // Keep only the most recent entries
    const trimmed = history.slice(0, this.maxEntries);
    
    fs.writeFileSync(this.storagePath, JSON.stringify(trimmed, null, 2));
  }
  
  clear(): void {
    fs.writeFileSync(this.storagePath, JSON.stringify([]));
  }
}