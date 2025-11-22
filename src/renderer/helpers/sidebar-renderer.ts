import { Project, Folder, Request } from '../../shared/types';
import { methodColors } from './request-builder';

export interface SidebarCallbacks {
  onNewFolder: () => void;
  onNewRequest: () => void;
  onAddRequestToFolder: (folderId: string) => void;
  onAddSubfolder: (parentId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onLoadRequest: (request: Request) => void;
}

export function renderSidebar(
  container: HTMLDivElement,
  project: Project | null,
  callbacks: SidebarCallbacks,
  activeRequestId?: string
): void {
  container.innerHTML = '';
  
  if (!project) {
    container.innerHTML = '<div class="text-gray-400 text-center py-4 text-sm">Select a project to view its contents</div>';
    return;
  }
  
  // Add New Folder Button
  const newFolderBtn = document.createElement('button');
  newFolderBtn.className = 'w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded mb-4 text-sm';
  newFolderBtn.textContent = '+ New Folder';
  newFolderBtn.onclick = callbacks.onNewFolder;
  container.appendChild(newFolderBtn);
  
  // Add New Request Button
  const newRequestBtn = document.createElement('button');
  newRequestBtn.className = 'w-full bg-green-600 hover:bg-green-700 px-3 py-2 rounded mb-4 text-sm';
  newRequestBtn.textContent = '+ New Request';
  newRequestBtn.onclick = callbacks.onNewRequest;
  container.appendChild(newRequestBtn);
  
  // Render folders
  project.folders.forEach(folder => {
    renderFolder(folder, container, 0, callbacks, activeRequestId);
  });
  
  // Render root requests
  project.requests.forEach(request => {
    renderRequest(request, container, 0, callbacks, activeRequestId);
  });
}

function renderFolder(
  folder: Folder,
  container: HTMLElement,
  depth: number,
  callbacks: SidebarCallbacks,
  activeRequestId?: string
): void {
  const folderDiv = document.createElement('div');
  folderDiv.className = 'mb-2';
  folderDiv.style.marginLeft = `${depth * 20}px`;
  
  const folderHeader = document.createElement('div');
  folderHeader.className = 'flex items-center justify-between bg-gray-800 p-2 rounded cursor-pointer hover:bg-gray-750';
  
  const folderName = document.createElement('div');
  folderName.className = 'flex items-center gap-2';
  folderName.innerHTML = `<span>📁</span><span class="text-sm">${folder.name}</span>`;
  
  const folderActions = document.createElement('div');
  folderActions.className = 'flex gap-1';
  
  const addRequestBtn = document.createElement('button');
  addRequestBtn.textContent = '+';
  addRequestBtn.className = 'bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs';
  addRequestBtn.onclick = (e) => {
    e.stopPropagation();
    callbacks.onAddRequestToFolder(folder.id);
  };
  
  const addSubfolderBtn = document.createElement('button');
  addSubfolderBtn.textContent = '📁';
  addSubfolderBtn.className = 'bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs';
  addSubfolderBtn.onclick = (e) => {
    e.stopPropagation();
    callbacks.onAddSubfolder(folder.id);
  };
  
  const deleteFolderBtn = document.createElement('button');
  deleteFolderBtn.textContent = '×';
  deleteFolderBtn.className = 'bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs';
  deleteFolderBtn.onclick = (e) => {
    e.stopPropagation();
    callbacks.onDeleteFolder(folder.id);
  };
  
  folderActions.appendChild(addRequestBtn);
  folderActions.appendChild(addSubfolderBtn);
  folderActions.appendChild(deleteFolderBtn);
  
  folderHeader.appendChild(folderName);
  folderHeader.appendChild(folderActions);
  folderDiv.appendChild(folderHeader);
  
  const folderContent = document.createElement('div');
  folderContent.className = 'ml-4 mt-1';
  
  folder.subfolders.forEach(subfolder => {
    renderFolder(subfolder, folderContent, depth + 1, callbacks, activeRequestId);
  });
  
  folder.requests.forEach(request => {
    renderRequest(request, folderContent, depth + 1, callbacks, activeRequestId);
  });
  
  folderDiv.appendChild(folderContent);
  container.appendChild(folderDiv);
}

function renderRequest(
  request: Request,
  container: HTMLElement,
  depth: number,
  callbacks: SidebarCallbacks,
  activeRequestId?: string
): void {
  const isActive = activeRequestId === request.id;
  
  const requestDiv = document.createElement('div');
  requestDiv.className = `p-2 rounded mb-1 cursor-pointer flex items-center justify-between ${
    isActive ? 'bg-blue-900 border border-blue-500' : 'bg-gray-800 hover:bg-gray-750'
  }`;
  requestDiv.style.marginLeft = `${depth * 20}px`;
  
  const methodColor = methodColors[request.method] || 'text-gray-400';
  
  const requestInfo = document.createElement('div');
  requestInfo.className = 'flex items-center gap-2 flex-1';
  requestInfo.innerHTML = `
    <span class="font-semibold ${methodColor} text-xs">${request.method}</span>
    <span class="text-sm ${isActive ? 'text-white font-semibold' : 'text-gray-300'}">${request.name}</span>
  `;
  
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '×';
  deleteBtn.className = 'bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    callbacks.onDeleteRequest(request.id);
  };
  
  requestDiv.onclick = () => {
    callbacks.onLoadRequest(request);
  };
  
  requestDiv.appendChild(requestInfo);
  requestDiv.appendChild(deleteBtn);
  container.appendChild(requestDiv);
}