import { Request, Project, Folder } from '../../shared/types';
import { findFolder } from './project-manager';

export interface RequestContext {
  request: Request;
  projectId?: string;
  folderId?: string;
  isInProject: boolean;
}

export function getRequestContext(request: Request): RequestContext {
  return {
    request,
    projectId: request.projectId,
    folderId: request.folderId,
    isInProject: !!request.projectId
  };
}

export function saveRequestToProject(
  request: Request,
  project: Project,
  folderId?: string
): void {
  // Remove request from old location if it exists
  removeRequestFromProject(project, request.id);
  
  // Update request context
  request.projectId = project.id;
  request.folderId = folderId;
  request.updatedAt = Date.now();
  
  // Add to new location
  if (folderId) {
    const folder = findFolder(project.folders, folderId);
    if (folder) {
      folder.requests.push(request);
    }
  } else {
    project.requests.push(request);
  }
}

export function updateRequestInProject(
  request: Request,
  project: Project
): boolean {
  if (!request.projectId || request.projectId !== project.id) {
    return false;
  }
  
  request.updatedAt = Date.now();
  
  if (request.folderId) {
    const folder = findFolder(project.folders, request.folderId);
    if (folder) {
      const index = folder.requests.findIndex(r => r.id === request.id);
      if (index >= 0) {
        folder.requests[index] = { ...request };
        return true;
      }
    }
  } else {
    const index = project.requests.findIndex(r => r.id === request.id);
    if (index >= 0) {
      project.requests[index] = { ...request };
      return true;
    }
  }
  
  return false;
}

function removeRequestFromProject(project: Project, requestId: string): void {
  // Remove from root
  project.requests = project.requests.filter(r => r.id !== requestId);
  
  // Remove from all folders
  const removeFromFolders = (folders: Folder[]) => {
    folders.forEach(folder => {
      folder.requests = folder.requests.filter(r => r.id !== requestId);
      removeFromFolders(folder.subfolders);
    });
  };
  
  removeFromFolders(project.folders);
}