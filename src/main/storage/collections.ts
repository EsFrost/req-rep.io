import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Collection } from '../../shared/types';

export class CollectionStorage {
  private storagePath: string;
  
  constructor() {
    const userDataPath = app.getPath('userData');
    this.storagePath = path.join(userDataPath, 'collections.json');
    this.ensureStorageFile();
  }
  
  private ensureStorageFile(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify([]));
    }
  }
  
  loadAll(): Collection[] {
    try {
      const data = fs.readFileSync(this.storagePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  
  save(collection: Collection): void {
    const collections = this.loadAll();
    const index = collections.findIndex(c => c.id === collection.id);
    
    if (index >= 0) {
      collections[index] = { ...collection, updatedAt: Date.now() };
    } else {
      collections.push(collection);
    }
    
    fs.writeFileSync(this.storagePath, JSON.stringify(collections, null, 2));
  }
  
  delete(id: string): void {
    const collections = this.loadAll().filter(c => c.id !== id);
    fs.writeFileSync(this.storagePath, JSON.stringify(collections, null, 2));
  }
}