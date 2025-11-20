import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Environment } from '../../shared/types';

export class EnvironmentStorage {
  private storagePath: string;
  
  constructor() {
    const userDataPath = app.getPath('userData');
    this.storagePath = path.join(userDataPath, 'environments.json');
    this.ensureStorageFile();
  }
  
  private ensureStorageFile(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify([]));
    }
  }
  
  loadAll(): Environment[] {
    try {
      const data = fs.readFileSync(this.storagePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  
  save(environment: Environment): void {
    const environments = this.loadAll();
    const index = environments.findIndex(e => e.id === environment.id);
    
    if (index >= 0) {
      environments[index] = environment;
    } else {
      environments.push(environment);
    }
    
    fs.writeFileSync(this.storagePath, JSON.stringify(environments, null, 2));
  }
  
  delete(id: string): void {
    const environments = this.loadAll().filter(e => e.id !== id);
    fs.writeFileSync(this.storagePath, JSON.stringify(environments, null, 2));
  }
  
  setActive(id: string): void {
    const environments = this.loadAll();
    environments.forEach(e => {
      e.isActive = e.id === id;
    });
    fs.writeFileSync(this.storagePath, JSON.stringify(environments, null, 2));
  }
}