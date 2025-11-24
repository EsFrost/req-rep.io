import { contextBridge, ipcRenderer } from 'electron';
import { Request, HttpResponse, Collection, Environment, HistoryEntry, Project } from '../shared/types';

contextBridge.exposeInMainWorld('electron', {

  // Toggle menu, obviously
  toggleMenu: () => ipcRenderer.send('toggle-menu'),

  // Request
  sendRequest: (request: Request): Promise<HttpResponse> => 
    ipcRenderer.invoke('request:send', request),
  
  // Collections
  saveCollection: (collection: Collection): Promise<void> => 
    ipcRenderer.invoke('collection:save', collection),
  loadCollections: (): Promise<Collection[]> => 
    ipcRenderer.invoke('collection:load'),
  deleteCollection: (id: string): Promise<void> => 
    ipcRenderer.invoke('collection:delete', id),
  
  // Projects
  saveProject: (project: Project): Promise<void> => 
    ipcRenderer.invoke('project:save', project),
  loadProjects: (): Promise<Project[]> => 
    ipcRenderer.invoke('project:load'),
  deleteProject: (id: string): Promise<void> => 
    ipcRenderer.invoke('project:delete', id),
  exportProject: (project: Project): Promise<void> => 
    ipcRenderer.invoke('project:export', project),
  importProject: (): Promise<Project | null> => 
    ipcRenderer.invoke('project:import'),
  
  // Environments
  saveEnvironment: (environment: Environment): Promise<void> => 
    ipcRenderer.invoke('environment:save', environment),
  loadEnvironments: (): Promise<Environment[]> => 
    ipcRenderer.invoke('environment:load'),
  deleteEnvironment: (id: string): Promise<void> => 
    ipcRenderer.invoke('environment:delete', id),
  setActiveEnvironment: (id: string): Promise<void> => 
    ipcRenderer.invoke('environment:setActive', id),
  
  // History
  getHistory: (limit?: number): Promise<HistoryEntry[]> => 
    ipcRenderer.invoke('history:get', limit),
  clearHistory: (): Promise<void> => 
    ipcRenderer.invoke('history:clear'),
  
  // Export/Import Request
  exportRequest: (request: Request): Promise<void> => 
    ipcRenderer.invoke('request:export', request),
  importRequest: (): Promise<Request | null> => 
    ipcRenderer.invoke('request:import'),
});