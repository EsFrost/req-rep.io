import { ipcMain } from 'electron';
import { Request, HttpResponse, Collection, Environment, HistoryEntry } from '../../shared/types';
import { RequestHandler } from './request-handler';
import { CollectionStorage } from '../storage/collections';
import { EnvironmentStorage } from '../storage/environments';
import { HistoryStorage } from '../storage/history';

const requestHandler = new RequestHandler();
const collectionStorage = new CollectionStorage();
const environmentStorage = new EnvironmentStorage();
const historyStorage = new HistoryStorage();

export const registerHandlers = (): void => {
  // Send HTTP request
  ipcMain.handle('request:send', async (_event, request: Request): Promise<HttpResponse> => {
    const response = await requestHandler.execute(request);
    
    // Only save to history if we got a real response (not an error)
    if (response.status > 0) {
      historyStorage.add({
        id: Date.now().toString(),
        request,
        response,
        timestamp: Date.now()
      });
    }
    
    return response;
  });
  
  // Collection management
  ipcMain.handle('collection:save', async (_event, collection: Collection): Promise<void> => {
    collectionStorage.save(collection);
  });
  
  ipcMain.handle('collection:load', async (): Promise<Collection[]> => {
    return collectionStorage.loadAll();
  });
  
  ipcMain.handle('collection:delete', async (_event, id: string): Promise<void> => {
    collectionStorage.delete(id);
  });
  
  // Environment management
  ipcMain.handle('environment:save', async (_event, environment: Environment): Promise<void> => {
    environmentStorage.save(environment);
  });
  
  ipcMain.handle('environment:load', async (): Promise<Environment[]> => {
    return environmentStorage.loadAll();
  });
  
  ipcMain.handle('environment:delete', async (_event, id: string): Promise<void> => {
    environmentStorage.delete(id);
  });
  
  ipcMain.handle('environment:setActive', async (_event, id: string): Promise<void> => {
    environmentStorage.setActive(id);
  });
  
  // History management
  ipcMain.handle('history:get', async (_event, limit?: number): Promise<HistoryEntry[]> => {
    return historyStorage.get(limit);
  });
  
  ipcMain.handle('history:clear', async (): Promise<void> => {
    historyStorage.clear();
  });
};