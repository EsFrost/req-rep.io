import { Request, HttpResponse, HttpMethod, KeyValue, Project, NetworkInfo } from '../shared/types';
import { TabManager } from './helpers/tab-manager';
import { replaceVariables } from './helpers/variable-replacer';
import { DisplayFormat, displayResponse } from './helpers/response-handler';
import { buildRequest, methodColors, isHttpMethod } from './helpers/request-builder';
import { renderKeyValueList, addKeyValue } from './helpers/key-value-renderer';
import { deleteFolder, deleteRequest, createFolder, createRequest, addFolderToProject, addRequestToProject } from './helpers/project-manager';
import { renderSidebar, SidebarCallbacks } from './helpers/sidebar-renderer';
import { renderProjectList, ProjectCallbacks } from './helpers/project-renderer';
import { loadRequestIntoUI } from './helpers/request-loader';
import { getBreadcrumbs, renderBreadcrumbs } from './helpers/breadcrumbs';
import { getRequestContext, saveRequestToProject, updateRequestInProject } from './helpers/request-context';
import { renderFolderTree } from './helpers/folder-tree';


declare global {
  interface Window {
    electron: {
      sendRequest: (request: Request) => Promise<HttpResponse>;
      saveProject: (project: Project) => Promise<void>;
      loadProjects: () => Promise<Project[]>;
      deleteProject: (id: string) => Promise<void>;
      exportProject: (project: Project) => Promise<void>;
      importProject: () => Promise<Project | null>;
      getHistory: (limit?: number) => Promise<any[]>;
      clearHistory: () => Promise<void>;
      exportRequest: (request: Request) => Promise<void>;
      importRequest: () => Promise<Request | null>;
      toggleMenu: () => void;
    };
  }
}

type TabType = 'params' | 'headers' | 'body' | 'auth';
type ResponseTabType = 'body' | 'headers';

// State
let projects: Project[] = [];
let currentProject: Project | null = null;
let autoSaveEnabled: boolean = true;
let hasUnsavedChanges: boolean = false;
let saveDebounceTimer: number | null = null;

let currentFormat: DisplayFormat = 'raw';
let currentMethod: HttpMethod = 'GET';
let lastResponse: HttpResponse | null = null;
let currentTab: TabType = 'params';
let currentResponseTab: ResponseTabType = 'body';
let queryParams: KeyValue[] = [];
let headers: KeyValue[] = [];
let formFields: KeyValue[] = [];
let projectVariables: KeyValue[] = [];
let editingProjectId: string | null = null;
let currentFolderParentId: string | null = null;

// UI Elements - Main
const fetchButton = document.getElementById('fetch') as HTMLButtonElement;
const urlInput = document.getElementById('url') as HTMLInputElement;
const resultDiv = document.getElementById('result') as HTMLDivElement;
const formatSelect = document.getElementById('format-select') as HTMLSelectElement;
const methodButton = document.getElementById('method-button') as HTMLButtonElement;
const methodText = document.getElementById('method-text') as HTMLSpanElement;
const methodDropdown = document.getElementById('method-dropdown') as HTMLDivElement;
const statusCodeSpan = document.getElementById('status-code') as HTMLSpanElement;
const responseTimeSpan = document.getElementById('response-time') as HTMLSpanElement;
const responseSizeSpan = document.getElementById('response-size') as HTMLSpanElement;

// UI Elements - Tabs
const tabsContainer = document.getElementById('tabs-container') as HTMLDivElement;
const newTabBtn = document.getElementById('new-tab') as HTMLButtonElement;

const paramsTab = document.getElementById('params-tab') as HTMLButtonElement;
const headersTab = document.getElementById('headers-tab') as HTMLButtonElement;
const bodyTab = document.getElementById('body-tab') as HTMLButtonElement;
const authTab = document.getElementById('auth-tab') as HTMLButtonElement;

const paramsPanel = document.getElementById('params-panel') as HTMLDivElement;
const headersPanel = document.getElementById('headers-panel') as HTMLDivElement;
const bodyPanel = document.getElementById('body-panel') as HTMLDivElement;
const authPanel = document.getElementById('auth-panel') as HTMLDivElement;

const paramsContainer = document.getElementById('params-container') as HTMLDivElement;
const headersContainer = document.getElementById('headers-container') as HTMLDivElement;
const addParamBtn = document.getElementById('add-param') as HTMLButtonElement;
const addHeaderBtn = document.getElementById('add-header') as HTMLButtonElement;

const bodyTypeSelect = document.getElementById('body-type') as HTMLSelectElement;
const bodyRawContainer = document.getElementById('body-raw-container') as HTMLDivElement;
const bodyFormContainer = document.getElementById('body-form-container') as HTMLDivElement;
const bodyJsonContainer = document.getElementById('body-json-container') as HTMLDivElement;
const bodyRawTextarea = document.getElementById('body-raw') as HTMLTextAreaElement;
const bodyJsonTextarea = document.getElementById('body-json') as HTMLTextAreaElement;
const bodyFormDataContainer = document.getElementById('body-formdata-container') as HTMLDivElement;
const addFormFieldBtn = document.getElementById('add-form-field') as HTMLButtonElement;

const authTypeSelect = document.getElementById('auth-type') as HTMLSelectElement;
const authNonePanel = document.getElementById('auth-none') as HTMLDivElement;
const authBasicPanel = document.getElementById('auth-basic') as HTMLDivElement;
const authBearerPanel = document.getElementById('auth-bearer') as HTMLDivElement;
const authApiKeyPanel = document.getElementById('auth-apikey') as HTMLDivElement;

// UI Elements - Actions
const saveRequestBtn = document.getElementById('save-request') as HTMLButtonElement;
const loadRequestBtn = document.getElementById('load-request') as HTMLButtonElement;
const viewHistoryBtn = document.getElementById('view-history') as HTMLButtonElement;
const historyModal = document.getElementById('history-modal') as HTMLDivElement;
const historyContainer = document.getElementById('history-container') as HTMLDivElement;
const clearHistoryBtn = document.getElementById('clear-history') as HTMLButtonElement;
const closeHistoryBtn = document.getElementById('close-history') as HTMLButtonElement;

// UI Elements - Projects
const projectDashboardBtn = document.getElementById('project-dashboard') as HTMLButtonElement;
const projectModal = document.getElementById('project-modal') as HTMLDivElement;
const projectListContainer = document.getElementById('project-list') as HTMLDivElement;
const createProjectBtn = document.getElementById('create-project') as HTMLButtonElement;
const closeProjectModalBtn = document.getElementById('close-project-modal') as HTMLButtonElement;
const currentProjectName = document.getElementById('current-project-name') as HTMLSpanElement;
const sidebarContainer = document.getElementById('sidebar-container') as HTMLDivElement;
const importProjectBtn = document.getElementById('import-project') as HTMLButtonElement;

// UI Elements - Project Form
const projectFormModal = document.getElementById('project-form-modal') as HTMLDivElement;
const projectFormTitle = document.getElementById('project-form-title') as HTMLHeadingElement;
const projectNameInput = document.getElementById('project-name-input') as HTMLInputElement;
const projectDescInput = document.getElementById('project-desc-input') as HTMLTextAreaElement;
const projectBaseUrlInput = document.getElementById('project-baseurl-input') as HTMLInputElement;
const projectVariablesContainer = document.getElementById('project-variables-container') as HTMLDivElement;
const addProjectVariableBtn = document.getElementById('add-project-variable') as HTMLButtonElement;
const saveProjectFormBtn = document.getElementById('save-project-form') as HTMLButtonElement;
const cancelProjectFormBtn = document.getElementById('cancel-project-form') as HTMLButtonElement;

// UI Elements - Folder
const folderModal = document.getElementById('folder-modal') as HTMLDivElement;
const folderModalTitle = document.getElementById('folder-modal-title') as HTMLHeadingElement;
const folderNameInput = document.getElementById('folder-name-input') as HTMLInputElement;
const saveFolderBtn = document.getElementById('save-folder') as HTMLButtonElement;
const cancelFolderBtn = document.getElementById('cancel-folder') as HTMLButtonElement;

// UI Elements - Folder Modal
const selectFolderModal = document.getElementById('select-folder-modal') as HTMLDivElement;
const selectProjectRoot = document.getElementById('select-project-root') as HTMLButtonElement;
const folderTreeContainer = document.getElementById('folder-tree-container') as HTMLDivElement;
const cancelFolderSelect = document.getElementById('cancel-folder-select') as HTMLButtonElement;

// State for adding request
let pendingRequestToAdd: Request | null = null;

// Breadcrumbs
const breadcrumbContainer = document.getElementById('breadcrumb-container') as HTMLDivElement;
const addToProjectBtn = document.getElementById('add-to-project') as HTMLButtonElement;

// Toggle menu elements
const hamburgerIcon = document.getElementById('hamburger-icon');
const closeIcon = document.getElementById('close-icon');
let menuVisible = false;

// Network info modal
const networkInfoBtn = document.getElementById('network-info-btn') as HTMLButtonElement;
const networkInfoModal = document.getElementById('network-info-modal') as HTMLDivElement;
const closeNetworkInfoBtn = document.getElementById('close-network-info') as HTMLButtonElement;

// Response tabs
const responseBodyTab = document.getElementById('response-body-tab') as HTMLButtonElement;
const responseHeadersTab = document.getElementById('response-headers-tab') as HTMLButtonElement;
const responseBodyPanel = document.getElementById('response-body-panel') as HTMLDivElement;
const responseHeadersPanel = document.getElementById('response-headers-panel') as HTMLDivElement;
const responseHeadersList = document.getElementById('response-headers-list') as HTMLDivElement;

// Save response request button
const saveResponseRequestBtn = document.getElementById('save-response-request') as HTMLButtonElement;

// Network info modal function
function displayNetworkInfo(networkInfo?: NetworkInfo): void {
  if (!networkInfo || Object.keys(networkInfo).length === 0) {
    networkInfoBtn.classList.add('hidden');
    return;
  }
  
  networkInfoBtn.classList.remove('hidden');
  
  const netHttpVersion = document.getElementById('net-http-version') as HTMLSpanElement;
  const netLocalAddress = document.getElementById('net-local-address') as HTMLSpanElement;
  const netRemoteAddress = document.getElementById('net-remote-address') as HTMLSpanElement;
  const netTlsProtocol = document.getElementById('net-tls-protocol') as HTMLSpanElement;
  const netCipherName = document.getElementById('net-cipher-name') as HTMLSpanElement;
  const netCertCN = document.getElementById('net-cert-cn') as HTMLSpanElement;
  const netIssuerCN = document.getElementById('net-issuer-cn') as HTMLSpanElement;
  const netValidUntil = document.getElementById('net-valid-until') as HTMLSpanElement;
  
  netHttpVersion.textContent = networkInfo.httpVersion || '-';
  netLocalAddress.textContent = networkInfo.localAddress || '-';
  netRemoteAddress.textContent = networkInfo.remoteAddress || '-';
  netTlsProtocol.textContent = networkInfo.tlsProtocol || '-';
  netCipherName.textContent = networkInfo.cipherName || '-';
  netCertCN.textContent = networkInfo.certificateCN || '-';
  netIssuerCN.textContent = networkInfo.issuerCN || '-';
  netValidUntil.textContent = networkInfo.validUntil || '-';
}

function switchResponseTab(tab: ResponseTabType): void {
  currentResponseTab = tab;
  
  // Update tab styles
  [responseBodyTab, responseHeadersTab].forEach(t => {
    t.classList.remove('border-white', 'text-white');
    t.classList.add('border-transparent', 'text-gray-400');
  });
  
  [responseBodyPanel, responseHeadersPanel].forEach(p => p.classList.add('hidden'));
  
  switch (tab) {
    case 'body':
      responseBodyTab.classList.add('border-white', 'text-white');
      responseBodyTab.classList.remove('text-gray-400', 'border-transparent');
      responseBodyPanel.classList.remove('hidden');
      break;
    case 'headers':
      responseHeadersTab.classList.add('border-white', 'text-white');
      responseHeadersTab.classList.remove('text-gray-400', 'border-transparent');
      responseHeadersPanel.classList.remove('hidden');
      break;
  }
}

function displayResponseHeaders(headers: Record<string, string>): void {
  responseHeadersList.innerHTML = '';
  
  if (!headers || Object.keys(headers).length === 0) {
    responseHeadersList.innerHTML = '<div class="text-gray-400 p-4">No headers</div>';
    return;
  }
  
  Object.entries(headers).forEach(([key, value]) => {
    const headerItem = document.createElement('div');
    headerItem.className = 'flex justify-between py-2 px-3 bg-[rgba(7,14,29,0.5)] rounded border border-gray-700';
    
    const headerKey = document.createElement('span');
    headerKey.className = 'font-semibold';
    headerKey.textContent = key;
    
    const headerValue = document.createElement('span');
    headerValue.className = 'text-white text-sm break-all ml-4';
    headerValue.textContent = value;
    
    headerItem.appendChild(headerKey);
    headerItem.appendChild(headerValue);
    responseHeadersList.appendChild(headerItem);
  });
}


// Event listener for menu toggle
document.getElementById('toggle-menu')?.addEventListener('click', () => {
  window.electron.toggleMenu();
  menuVisible = !menuVisible;
  
  if (menuVisible) {
    hamburgerIcon?.classList.add('hidden');
    closeIcon?.classList.remove('hidden');
  } else {
    hamburgerIcon?.classList.remove('hidden');
    closeIcon?.classList.add('hidden');
  }
});

document.getElementById('toggle-bearer-token')?.addEventListener('click', () => {
  const tokenInput = document.getElementById('auth-bearer-token') as HTMLInputElement;
  const eyeClosed = document.getElementById('bearer-eye-closed');
  const eyeOpen = document.getElementById('bearer-eye-open');
  
  if (!eyeClosed || !eyeOpen) return;
  
  if (tokenInput.type === 'password') {
    tokenInput.type = 'text';
    eyeClosed.classList.add('hidden');
    eyeOpen.classList.remove('hidden');
  } else {
    tokenInput.type = 'password';
    eyeClosed.classList.remove('hidden');
    eyeOpen.classList.add('hidden');
  }
});

// Tab Manager
const tabManager = new TabManager(tabsContainer, (tabId) => {
  loadTabById(tabId);
  renderSidebarUI();
});

// Project Functions
async function loadProjects(): Promise<void> {
  projects = await window.electron.loadProjects();
  renderProjectListUI();
  
  const lastProjectId = localStorage.getItem('lastActiveProject');
  if (lastProjectId) {
    const project = projects.find(p => p.id === lastProjectId);
    if (project) {
      loadProject(project.id);
    }
  }
}

async function saveProject(project: Project): Promise<void> {
  await window.electron.saveProject(project);
  hasUnsavedChanges = false;
  await loadProjects();
}

function markUnsavedChanges(): void {
  hasUnsavedChanges = true;
}

function autoSaveProject(): void {
  if (currentProject && autoSaveEnabled) {
    saveProject(currentProject);
  }
}

function debouncedSaveCurrentTab(): void {
  if (saveDebounceTimer !== null) {
    clearTimeout(saveDebounceTimer);
  }
  
  saveDebounceTimer = window.setTimeout(() => {
    saveCurrentTab();
    markUnsavedChanges();
    autoSaveProject();
    saveDebounceTimer = null;
  }, 500);
}

function saveCurrentTab(): void {
  const tab = tabManager.getActiveTab();
  if (!tab) return;
  
  const originalRequest = tab.request;
  
  const request = buildRequest(
    currentMethod,
    urlInput,
    paramsContainer,
    headersContainer,
    bodyTypeSelect,
    bodyRawTextarea,
    bodyJsonTextarea,
    bodyFormDataContainer,
    authTypeSelect,
    currentProject?.id
  );
  
  // Preserve ALL original request properties
  request.id = originalRequest.id;
  request.projectId = originalRequest.projectId;
  request.folderId = originalRequest.folderId;
  request.createdAt = originalRequest.createdAt;
  request.updatedAt = Date.now();
  
  // Update name based on URL
  updateRequestName(request);
  
  // Update the tab
  tab.request = request;
  tabManager.updateActiveTab(request, lastResponse);
  
  // Update request in project if it belongs to one
  if (currentProject && request.projectId === currentProject.id) {
    updateRequestInProject(request, currentProject);
    markUnsavedChanges();
    // Re-render sidebar to show updated request
    renderSidebarUI();
  }
  
  // Update breadcrumbs
  updateBreadcrumbs(request);
}

function updateRequestName(request: Request): void {
  if (!request.url) {
    request.name = 'Untitled Request';
    return;
  }
  
  try {
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(p => p).pop() || url.hostname;
    request.name = `${request.method} ${path}`;
  } catch {
    // If URL is incomplete, use what we have
    const urlPart = request.url.split('/').filter(p => p).pop() || request.url;
    request.name = `${request.method} ${urlPart.substring(0, 30)}`;
  }
}

// Add to project button event listener
addToProjectBtn?.addEventListener('click', () => {
  if (!currentProject) {
    alert('Please select a project first');
    return;
  }
  
  const tab = tabManager.getActiveTab();
  if (!tab) return;
  
  pendingRequestToAdd = tab.request;
  
  // Show folder selection modal
  folderTreeContainer.innerHTML = '';
  renderFolderTree(folderTreeContainer, currentProject.folders, (folderId) => {
    if (pendingRequestToAdd) {
      saveRequestToProject(pendingRequestToAdd, currentProject!, folderId);
      markUnsavedChanges();
      autoSaveProject();
      renderSidebarUI();
      
      // Update the tab's request
      tab.request.projectId = currentProject!.id;
      tab.request.folderId = folderId;
      updateBreadcrumbs(tab.request);
      
      selectFolderModal.classList.add('hidden');
      pendingRequestToAdd = null;
    }
  });
  
  selectFolderModal.classList.remove('hidden');
});

selectProjectRoot?.addEventListener('click', () => {
  if (pendingRequestToAdd && currentProject) {
    saveRequestToProject(pendingRequestToAdd, currentProject);
    markUnsavedChanges();
    autoSaveProject();
    renderSidebarUI();
    
    const tab = tabManager.getActiveTab();
    if (tab) {
      tab.request.projectId = currentProject.id;
      tab.request.folderId = undefined;
      updateBreadcrumbs(tab.request);
    }
    
    selectFolderModal.classList.add('hidden');
    pendingRequestToAdd = null;
  }
});

cancelFolderSelect?.addEventListener('click', () => {
  selectFolderModal.classList.add('hidden');
  pendingRequestToAdd = null;
});

function updateBreadcrumbs(request?: Request): void {
  const tab = tabManager.getActiveTab();
  const currentRequest = request || tab?.request;
  
  if (!currentRequest) {
    breadcrumbContainer.innerHTML = '<span class="text-gray-500 text-sm">No request</span>';
    addToProjectBtn.classList.add('hidden');
    return;
  }
  
  const context = getRequestContext(currentRequest);
  
  if (context.isInProject && currentProject && currentRequest.projectId === currentProject.id) {
    const breadcrumbs = getBreadcrumbs(currentProject, currentRequest.folderId);
    renderBreadcrumbs(breadcrumbContainer, breadcrumbs);
    addToProjectBtn.classList.add('hidden');
  } else {
    breadcrumbContainer.innerHTML = '<span class="text-gray-500 text-sm">Not in any project</span>';
    addToProjectBtn.classList.remove('hidden');
  }
}

function loadTabById(tabId: string): void {
  const tab = tabManager.getTabs().find(t => t.id === tabId);
  if (!tab) return;
  
  // Store the current focused element
  const activeElement = document.activeElement as HTMLElement;
  const wasFocused = activeElement && (
    activeElement === urlInput ||
    paramsContainer.contains(activeElement) ||
    headersContainer.contains(activeElement) ||
    bodyFormDataContainer.contains(activeElement)
  );
  
  loadRequestIntoUI(
    tab.request,
    {
      urlInput,
      paramsContainer,
      headersContainer,
      bodyTypeSelect,
      bodyRawTextarea,
      bodyJsonTextarea,
      bodyFormDataContainer,
      authTypeSelect
    },
    {
      renderParams: () => renderKeyValueList(paramsContainer, queryParams, debouncedSaveCurrentTab),
      renderHeaders: () => renderKeyValueList(headersContainer, headers, debouncedSaveCurrentTab),
      renderFormFields: () => renderKeyValueList(bodyFormDataContainer, formFields, debouncedSaveCurrentTab)
    },
    {
      setMethod: (method) => {
        currentMethod = method;
        updateMethodButton();
      },
      setQueryParams: (params) => { queryParams = params; },
      setHeaders: (hdrs) => { headers = hdrs; },
      setFormFields: (fields) => { formFields = fields; }
    }
  );
  
  // Restore focus if needed
  if (wasFocused && activeElement === urlInput) {
    setTimeout(() => {
      urlInput.focus();
    }, 0);
  }
  
  // Update breadcrumbs
  updateBreadcrumbs(tab.request);
  
  if (tab.response) {
    lastResponse = tab.response;
    displayResponse(tab.response, currentFormat, resultDiv, statusCodeSpan, responseTimeSpan, responseSizeSpan);
    displayNetworkInfo(tab.response.networkInfo);
    displayResponseHeaders(tab.response.headers);
  } else {
    lastResponse = null;
    resultDiv.innerHTML = '<div class="text-gray-400 p-4">No response yet</div>';
    statusCodeSpan.textContent = '-';
    statusCodeSpan.className = 'text-gray-500';
    responseTimeSpan.textContent = '-';
    responseSizeSpan.textContent = '-';
    displayNetworkInfo(undefined);
    displayResponseHeaders({});
  }
}

// Tab Management
function switchTab(tab: TabType) {
  currentTab = tab;
  
  [paramsTab, headersTab, bodyTab, authTab].forEach(t => {
    t.classList.remove('border-blue-500', 'text-white');
    t.classList.add('border-transparent', 'text-gray-400');
  });
  
  [paramsPanel, headersPanel, bodyPanel, authPanel].forEach(p => p.classList.add('hidden'));
  
  switch (tab) {
    case 'params':
      paramsTab.classList.add('border-blue-500', 'text-white');
      paramsTab.classList.remove('text-gray-400');
      paramsPanel.classList.remove('hidden');
      break;
    case 'headers':
      headersTab.classList.add('border-blue-500', 'text-white');
      headersTab.classList.remove('text-gray-400');
      headersPanel.classList.remove('hidden');
      break;
    case 'body':
      bodyTab.classList.add('border-blue-500', 'text-white');
      bodyTab.classList.remove('text-gray-400');
      bodyPanel.classList.remove('hidden');
      break;
    case 'auth':
      authTab.classList.add('border-blue-500', 'text-white');
      authTab.classList.remove('text-gray-400');
      authPanel.classList.remove('hidden');
      break;
  }
}

// Method Management
const updateMethodButton = () => {
  Object.values(methodColors).forEach(color => methodText.classList.remove(color));
  methodText.classList.add(methodColors[currentMethod]);
  methodText.textContent = currentMethod;
};

// Project UI Functions
function renderProjectListUI(): void {
  const callbacks: ProjectCallbacks = {
    onLoadProject: (projectId) => {
      loadProject(projectId);
      projectModal.classList.add('hidden');
    },
    onEditProject: (project) => {
      openProjectForm(project);
    },
    onExportProject: async (project) => {
      await window.electron.exportProject(project);
    },
    onDeleteProject: async (projectId) => {
      const project = projects.find(p => p.id === projectId);
      if (project && confirm(`Are you sure you want to delete project "${project.name}"?`)) {
        await window.electron.deleteProject(projectId);
        if (currentProject?.id === projectId) {
          currentProject = null;
          currentProjectName.textContent = 'No Project';
          renderSidebarUI();
        }
        await loadProjects();
      }
    }
  };
  
  renderProjectList(projectListContainer, projects, callbacks);
}

function openProjectForm(project?: Project): void {
  editingProjectId = project?.id || null;
  projectFormTitle.textContent = project ? 'Edit Project' : 'Create New Project';
  
  projectNameInput.value = project?.name || '';
  projectDescInput.value = project?.description || '';
  projectBaseUrlInput.value = project?.baseUrl || '';
  
  projectVariables = project?.variables ? [...project.variables] : [];
  renderKeyValueList(projectVariablesContainer, projectVariables, () => {});
  
  projectModal.classList.add('hidden');
  projectFormModal.classList.remove('hidden');
}

function loadProject(projectId: string): void {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  
  currentProject = project;
  localStorage.setItem('lastActiveProject', projectId);
  currentProjectName.textContent = project.name;
  
  renderSidebarUI();
}

function renderSidebarUI(): void {
  const tab = tabManager.getActiveTab();
  const activeRequestId = tab?.request.id;
  
  const callbacks: SidebarCallbacks = {
    onNewFolder: () => openFolderForm(),
    onNewRequest: () => createRequestInProject(),
    onAddRequestToFolder: (folderId) => createRequestInFolder(folderId),
    onAddSubfolder: (parentId) => openFolderForm(parentId),
    onDeleteFolder: (folderId) => deleteFolderUI(folderId),
    onDeleteRequest: (requestId) => deleteRequestUI(requestId),
    onLoadRequest: (request) => loadRequestIntoTab(request)
  };
  
  renderSidebar(sidebarContainer, currentProject, callbacks, activeRequestId);
}

function openFolderForm(parentId?: string): void {
  currentFolderParentId = parentId || null;
  folderModalTitle.textContent = 'Create New Folder';
  folderNameInput.value = '';
  folderModal.classList.remove('hidden');
}

function deleteFolderUI(folderId: string): void {
  if (!currentProject) return;
  if (!confirm('Delete this folder and all its contents?')) return;
  
  deleteFolder(currentProject, folderId);
  markUnsavedChanges();
  autoSaveProject();
  renderSidebarUI();
}

function createRequestInProject(): void {
  if (!currentProject) return;
  
  const request = createRequest(currentProject.id);
  request.name = `New Request ${Date.now()}`;
  addRequestToProject(currentProject, request);
  
  markUnsavedChanges();
  autoSaveProject();
  renderSidebarUI();
  
  loadRequestIntoTab(request);
}

function createRequestInFolder(folderId: string): void {
  if (!currentProject) return;
  
  const request = createRequest(currentProject.id, folderId);
  request.name = `New Request ${Date.now()}`;
  addRequestToProject(currentProject, request, folderId);
  
  markUnsavedChanges();
  autoSaveProject();
  renderSidebarUI();
  
  loadRequestIntoTab(request);
}

function loadRequestIntoTab(request: Request): void {
  const tab = tabManager.getActiveTab();
  if (tab) {
    // Load the request into the current active tab
    tab.request = { ...request };
    tab.response = null;
    loadTabById(tabManager.getActiveTabId());
  }
}

function deleteRequestUI(requestId: string): void {
  if (!currentProject) return;
  if (!confirm('Delete this request?')) return;
  
  deleteRequest(currentProject, requestId);
  
  markUnsavedChanges();
  autoSaveProject();
  renderSidebarUI();
}

// Event Listeners
newTabBtn?.addEventListener('click', () => {
  const request: Request = {
    id: Date.now().toString(),
    name: 'Untitled Request',
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    projectId: currentProject?.id,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  tabManager.createTab(request);
});

urlInput?.addEventListener('input', () => debouncedSaveCurrentTab());

paramsTab?.addEventListener('click', () => switchTab('params'));
headersTab?.addEventListener('click', () => switchTab('headers'));
bodyTab?.addEventListener('click', () => switchTab('body'));
authTab?.addEventListener('click', () => switchTab('auth'));

methodButton?.addEventListener('click', (e) => {
  e.stopPropagation();
  methodDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!methodDropdown.contains(e.target as Node) && e.target !== methodButton) {
    methodDropdown.classList.add('hidden');
  }
});

const methodOptions = methodDropdown.querySelectorAll('[data-method]');
methodOptions.forEach(option => {
  option.addEventListener('click', () => {
    const method = option.getAttribute('data-method');
    if (method && isHttpMethod(method)) {
      currentMethod = method;
      updateMethodButton();
      methodDropdown.classList.add('hidden');
      debouncedSaveCurrentTab();
    }
  });
});

addParamBtn?.addEventListener('click', () => addKeyValue(queryParams, paramsContainer, debouncedSaveCurrentTab));
addHeaderBtn?.addEventListener('click', () => addKeyValue(headers, headersContainer, debouncedSaveCurrentTab));
addFormFieldBtn?.addEventListener('click', () => addKeyValue(formFields, bodyFormDataContainer, debouncedSaveCurrentTab));

bodyTypeSelect?.addEventListener('change', () => {
  const type = bodyTypeSelect.value;
  
  [bodyRawContainer, bodyFormContainer, bodyJsonContainer].forEach(c => c.classList.add('hidden'));
  
  switch (type) {
    case 'raw':
    case 'x-www-form-urlencoded':
      bodyRawContainer.classList.remove('hidden');
      break;
    case 'json':
      bodyJsonContainer.classList.remove('hidden');
      break;
    case 'form-data':
      bodyFormContainer.classList.remove('hidden');
      break;
  }
  
  debouncedSaveCurrentTab();
});

bodyRawTextarea?.addEventListener('input', debouncedSaveCurrentTab);
bodyJsonTextarea?.addEventListener('input', debouncedSaveCurrentTab);

authTypeSelect?.addEventListener('change', () => {
  const type = authTypeSelect.value;
  
  [authNonePanel, authBasicPanel, authBearerPanel, authApiKeyPanel].forEach(p => p.classList.add('hidden'));
  
  switch (type) {
    case 'none':
      authNonePanel.classList.remove('hidden');
      break;
    case 'basic':
      authBasicPanel.classList.remove('hidden');
      break;
    case 'bearer':
      authBearerPanel.classList.remove('hidden');
      break;
    case 'api-key':
      authApiKeyPanel.classList.remove('hidden');
      break;
  }
  
  debouncedSaveCurrentTab();
});

document.getElementById('auth-basic-username')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-basic-password')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-bearer-token')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-apikey-key')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-apikey-value')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-apikey-addto')?.addEventListener('change', debouncedSaveCurrentTab);

formatSelect?.addEventListener('change', () => {
  currentFormat = formatSelect.value as DisplayFormat;
  if (lastResponse) {
    displayResponse(lastResponse, currentFormat, resultDiv, statusCodeSpan, responseTimeSpan, responseSizeSpan);
  }
});

fetchButton?.addEventListener('click', async () => {
  try {
    fetchButton.disabled = true;
    fetchButton.textContent = 'Sending...';
    
    saveCurrentTab();
    
    const request = buildRequest(
      currentMethod,
      urlInput,
      paramsContainer,
      headersContainer,
      bodyTypeSelect,
      bodyRawTextarea,
      bodyJsonTextarea,
      bodyFormDataContainer,
      authTypeSelect,
      currentProject?.id
    );
    
    const processedRequest = { ...request };
    processedRequest.url = replaceVariables(request.url, currentProject);
    
    const response = await window.electron.sendRequest(processedRequest);
    
    lastResponse = response;
    displayResponse(response, currentFormat, resultDiv, statusCodeSpan, responseTimeSpan, responseSizeSpan);
    displayNetworkInfo(response.networkInfo);
    displayResponseHeaders(response.headers);
    saveCurrentTab();
  } catch (error) {
    console.error(error);
    statusCodeSpan.textContent = 'Error';
    statusCodeSpan.className = 'text-red-400 font-semibold';
    resultDiv.textContent = `Error: ${(error as Error).message}`;
    displayNetworkInfo(undefined);
    displayResponseHeaders({});
  } finally {
    fetchButton.disabled = false;
    fetchButton.textContent = 'Send';
  }
});

saveRequestBtn?.addEventListener('click', async () => {
  const request = buildRequest(
    currentMethod,
    urlInput,
    paramsContainer,
    headersContainer,
    bodyTypeSelect,
    bodyRawTextarea,
    bodyJsonTextarea,
    bodyFormDataContainer,
    authTypeSelect,
    currentProject?.id
  );
  
  try {
    const url = new URL(request.url);
    const urlPath = url.pathname.split('/').filter(p => p).join('_') || url.hostname.replace(/\./g, '_');
    request.name = `${request.method}_${urlPath}`;
  } catch {
    request.name = `${request.method}_${Date.now()}`;
  }
  
  try {
    await window.electron.exportRequest(request);
  } catch (error) {
    console.error('Failed to export request:', error);
  }
});

loadRequestBtn?.addEventListener('click', async () => {
  try {
    const request = await window.electron.importRequest();
    
    if (!request) {
      return;
    }
    
    const tab = tabManager.getActiveTab();
    if (tab) {
      tab.request = request;
      tab.response = null;
      loadTabById(tabManager.getActiveTabId());
    }
    
  } catch (error) {
    console.error('Failed to load request:', error);
  }
});

// Event listener for save response request button
saveResponseRequestBtn?.addEventListener('click', async () => {
  const tab = tabManager.getActiveTab();
  if (!tab) return;
  
  const request = tab.request;
  
  try {
    const url = new URL(request.url);
    const urlPath = url.pathname.split('/').filter(p => p).join('_') || url.hostname.replace(/\./g, '_');
    request.name = `${request.method}_${urlPath}`;
  } catch {
    request.name = `${request.method}_${Date.now()}`;
  }
  
  try {
    await window.electron.exportRequest(request);
  } catch (error) {
    console.error('Failed to export request:', error);
  }
});

viewHistoryBtn?.addEventListener('click', async () => {
  const history = await window.electron.getHistory(20);
  
  historyContainer.innerHTML = '';
  
  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'bg-gray-800 p-4 rounded mb-2 cursor-pointer hover:bg-gray-700';
    
    const method = entry.request.method as HttpMethod;
    const methodColor = methodColors[method] || 'text-gray-400';
    
    item.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <span class="font-semibold ${methodColor}">${method}</span>
        <span class="text-sm text-gray-400">${new Date(entry.timestamp).toLocaleString()}</span>
      </div>
      <div class="text-sm mb-1">${entry.request.url}</div>
      <div class="text-sm ${entry.response.status >= 200 && entry.response.status < 300 ? 'text-green-400' : 'text-red-400'}">
        ${entry.response.status} ${entry.response.statusText}
      </div>
    `;
    
    item.onclick = () => {
      const tab = tabManager.getActiveTab();
      if (tab) {
        tab.request = entry.request;
        tab.response = entry.response;
        loadTabById(tabManager.getActiveTabId());
      }
      historyModal.classList.add('hidden');
    };
    
    historyContainer.appendChild(item);
  });
  
  historyModal.classList.remove('hidden');
});

clearHistoryBtn?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
    await window.electron.clearHistory();
    historyContainer.innerHTML = '<div class="text-gray-400 text-center py-8">History cleared</div>';
  }
});

closeHistoryBtn?.addEventListener('click', () => {
  historyModal.classList.add('hidden');
});

projectDashboardBtn?.addEventListener('click', () => {
  projectModal.classList.remove('hidden');
  renderProjectListUI();
});

closeProjectModalBtn?.addEventListener('click', () => {
  projectModal.classList.add('hidden');
});

createProjectBtn?.addEventListener('click', () => {
  openProjectForm();
});

addProjectVariableBtn?.addEventListener('click', () => {
  addKeyValue(projectVariables, projectVariablesContainer, () => {});
});

saveProjectFormBtn?.addEventListener('click', async () => {
  const name = projectNameInput.value.trim();
  if (!name) {
    alert('Project name is required');
    return;
  }
  
  const variableRows = projectVariablesContainer.querySelectorAll('.flex');
  const variables: KeyValue[] = [];
  variableRows.forEach(row => {
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const inputs = row.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
    variables.push({
      key: inputs[0].value,
      value: inputs[1].value,
      enabled: checkbox.checked
    });
  });
  
  const project: Project = editingProjectId
    ? { ...projects.find(p => p.id === editingProjectId)!, updatedAt: Date.now() }
    : {
        id: Date.now().toString(),
        name,
        folders: [],
        requests: [],
        variables: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
  
  project.name = name;
  project.description = projectDescInput.value.trim();
  project.baseUrl = projectBaseUrlInput.value.trim();
  project.variables = variables;
  
  await saveProject(project);
  
  projectFormModal.classList.add('hidden');
  projectModal.classList.remove('hidden');
  
  renderProjectListUI();
});

cancelProjectFormBtn?.addEventListener('click', () => {
  projectFormModal.classList.add('hidden');
  projectModal.classList.remove('hidden');
});

importProjectBtn?.addEventListener('click', async () => {
  const project = await window.electron.importProject();
  if (project) {
    await loadProjects();
    projectModal.classList.add('hidden');
  }
});

saveFolderBtn?.addEventListener('click', () => {
  const name = folderNameInput.value.trim();
  if (!name) {
    alert('Folder name is required');
    return;
  }
  
  if (!currentProject) return;
  
  const newFolder = createFolder(name, currentProject.id, currentFolderParentId || undefined);
  addFolderToProject(currentProject, newFolder, currentFolderParentId || undefined);
  
  markUnsavedChanges();
  autoSaveProject();
  renderSidebarUI();
  folderModal.classList.add('hidden');
});

cancelFolderBtn?.addEventListener('click', () => {
  folderModal.classList.add('hidden');
});

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges && !autoSaveEnabled) {
    e.preventDefault();
    e.returnValue = '';
    
    const save = confirm('You have unsaved changes. Do you want to save your project before closing?');
    if (save && currentProject) {
      saveProject(currentProject);
    }
  }
});

// Network info modal event listeners
networkInfoBtn?.addEventListener('click', () => {
  networkInfoModal.classList.remove('hidden');
});

closeNetworkInfoBtn?.addEventListener('click', () => {
  networkInfoModal.classList.add('hidden');
});

// Response tab event listeners
responseBodyTab?.addEventListener('click', () => switchResponseTab('body'));
responseHeadersTab?.addEventListener('click', () => switchResponseTab('headers'));

// Initialize
loadProjects().then(() => {
  const request: Request = {
    id: Date.now().toString(),
    name: 'Untitled Request',
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  tabManager.createTab(request);
  switchTab('params');
  switchResponseTab('body');
});