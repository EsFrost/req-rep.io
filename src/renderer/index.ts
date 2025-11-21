import hljs from 'highlight.js';
import { Request, HttpResponse, HttpMethod, KeyValue, Collection, Environment, BodyType, AuthType } from '../shared/types';

declare global {
  interface Window {
    electron: {
      sendRequest: (request: Request) => Promise<HttpResponse>;
      saveCollection: (collection: Collection) => Promise<void>;
      loadCollections: () => Promise<Collection[]>;
      deleteCollection: (id: string) => Promise<void>;
      saveEnvironment: (environment: Environment) => Promise<void>;
      loadEnvironments: () => Promise<Environment[]>;
      deleteEnvironment: (id: string) => Promise<void>;
      setActiveEnvironment: (id: string) => Promise<void>;
      getHistory: (limit?: number) => Promise<any[]>;
      clearHistory: () => Promise<void>;
      exportRequest: (request: Request) => Promise<void>;
      importRequest: () => Promise<Request | null>;
    };
  }
}

type DisplayFormat = 'raw' | 'json' | 'html' | 'xml';
type TabType = 'params' | 'headers' | 'body' | 'auth';

interface Tab {
  id: string;
  name: string;
  request: Request;
  response: HttpResponse | null;
}

let tabs: Tab[] = [];
let activeTabId: string = '';
let saveDebounceTimer: number | null = null;

// UI Elements
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

const saveRequestBtn = document.getElementById('save-request') as HTMLButtonElement;
const loadRequestBtn = document.getElementById('load-request') as HTMLButtonElement;
const viewHistoryBtn = document.getElementById('view-history') as HTMLButtonElement;
const historyModal = document.getElementById('history-modal') as HTMLDivElement;
const historyContainer = document.getElementById('history-container') as HTMLDivElement;
const clearHistoryBtn = document.getElementById('clear-history') as HTMLButtonElement;
const closeHistoryBtn = document.getElementById('close-history') as HTMLButtonElement;

// State
let currentFormat: DisplayFormat = 'raw';
let currentMethod: HttpMethod = 'GET';
let lastResponse: HttpResponse | null = null;
let currentTab: TabType = 'params';
let queryParams: KeyValue[] = [];
let headers: KeyValue[] = [];
let formFields: KeyValue[] = [];

const methodColors: Record<HttpMethod, string> = {
  'GET': 'text-green-600',
  'POST': 'text-yellow-600',
  'PUT': 'text-blue-600',
  'PATCH': 'text-pink-600',
  'DELETE': 'text-red-600',
  'HEAD': 'text-green-400',
  'OPTIONS': 'text-purple-600'
};

// Debounced save function
function debouncedSaveCurrentTab(): void {
  if (saveDebounceTimer !== null) {
    clearTimeout(saveDebounceTimer);
  }
  
  saveDebounceTimer = window.setTimeout(() => {
    saveCurrentTab();
    saveDebounceTimer = null;
  }, 500);
}

// Create default request
function createDefaultRequest(): Request {
  return {
    id: Date.now().toString(),
    name: 'Untitled Request',
    method: 'GET',
    url: '',
    headers: [],
    queryParams: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// Create new tab
function createNewTab(): void {
  const tab: Tab = {
    id: Date.now().toString(),
    name: 'New Request',
    request: createDefaultRequest(),
    response: null
  };
  
  tabs.push(tab);
  activeTabId = tab.id;
  renderTabs();
  loadTab(tab.id);
}

// Render tabs
function renderTabs(): void {
  tabsContainer.innerHTML = '';
  
  tabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = `flex items-center gap-2 px-4 py-2 rounded-t cursor-pointer ${
      activeTabId === tab.id ? 'bg-gray-800 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-750'
    }`;
    
    const tabName = document.createElement('span');
    tabName.textContent = tab.name;
    tabName.className = 'text-sm';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'text-lg hover:text-red-400 ml-2';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    };
    
    tabElement.onclick = () => {
      activeTabId = tab.id;
      renderTabs();
      loadTab(tab.id);
    };
    
    tabElement.appendChild(tabName);
    if (tabs.length > 1) {
      tabElement.appendChild(closeBtn);
    }
    
    tabsContainer.appendChild(tabElement);
  });
}

// Close tab
function closeTab(tabId: string): void {
  if (tabs.length === 1) return; // Don't close the last tab
  
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;
  
  tabs.splice(index, 1);
  
  if (activeTabId === tabId) {
    activeTabId = tabs[Math.max(0, index - 1)].id;
  }
  
  renderTabs();
  loadTab(activeTabId);
}

// Save current tab state
function saveCurrentTab(): void {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  
  tab.request = buildRequest();
  tab.response = lastResponse;
  
  // Update tab name based on URL
  if (tab.request.url) {
    try {
      const url = new URL(tab.request.url);
      const urlPath = url.pathname.split('/').filter(p => p).join('/') || url.hostname;
      tab.name = `${tab.request.method} ${urlPath.substring(0, 20)}${urlPath.length > 20 ? '...' : ''}`;
    } catch {
      tab.name = `${tab.request.method} Request`;
    }
  } else {
    tab.name = 'New Request';
  }
  
  renderTabs();
}

// Load tab
function loadTab(tabId: string): void {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  
  const request = tab.request;
  
  // Populate URL
  urlInput.value = request.url;
  
  // Set method
  if (isHttpMethod(request.method)) {
    currentMethod = request.method;
    updateMethodButton();
  }
  
  // Populate query params
  queryParams = request.queryParams || [];
  renderParams();
  
  // Populate headers
  headers = request.headers || [];
  renderHeaders();
  
  // Populate body
  if (request.body) {
    bodyTypeSelect.value = request.body.type;
    bodyTypeSelect.dispatchEvent(new Event('change'));
    
    switch (request.body.type) {
      case 'raw':
      case 'x-www-form-urlencoded':
        bodyRawTextarea.value = request.body.raw || '';
        break;
      case 'json':
        bodyJsonTextarea.value = typeof request.body.json === 'string' 
          ? request.body.json 
          : JSON.stringify(request.body.json, null, 2);
        break;
      case 'form-data':
        formFields = request.body.formData || [];
        renderFormFields();
        break;
    }
  } else {
    bodyTypeSelect.value = 'none';
    bodyTypeSelect.dispatchEvent(new Event('change'));
  }
  
  // Populate auth
  if (request.auth) {
    authTypeSelect.value = request.auth.type;
    authTypeSelect.dispatchEvent(new Event('change'));
    
    switch (request.auth.type) {
      case 'basic':
        if (request.auth.basic) {
          (document.getElementById('auth-basic-username') as HTMLInputElement).value = request.auth.basic.username || '';
          (document.getElementById('auth-basic-password') as HTMLInputElement).value = request.auth.basic.password || '';
        }
        break;
      case 'bearer':
        if (request.auth.bearer) {
          (document.getElementById('auth-bearer-token') as HTMLInputElement).value = request.auth.bearer.token || '';
        }
        break;
      case 'api-key':
        if (request.auth.apiKey) {
          (document.getElementById('auth-apikey-key') as HTMLInputElement).value = request.auth.apiKey.key || '';
          (document.getElementById('auth-apikey-value') as HTMLInputElement).value = request.auth.apiKey.value || '';
          (document.getElementById('auth-apikey-addto') as HTMLSelectElement).value = request.auth.apiKey.addTo || 'header';
        }
        break;
    }
  } else {
    authTypeSelect.value = 'none';
    authTypeSelect.dispatchEvent(new Event('change'));
  }
  
  // Load response if available
  if (tab.response) {
    lastResponse = tab.response;
    displayResponse(tab.response);
  } else {
    lastResponse = null;
    resultDiv.innerHTML = '<div class="text-gray-400 p-4">No response yet</div>';
    statusCodeSpan.textContent = '-';
    statusCodeSpan.className = 'text-gray-500';
    responseTimeSpan.textContent = '-';
    responseSizeSpan.textContent = '-';
  }
}

// New tab event listener
newTabBtn?.addEventListener('click', () => {
  createNewTab();
});

// Input event listener with debounce
urlInput?.addEventListener('input', () => debouncedSaveCurrentTab());

// Tab Management
function switchTab(tab: TabType) {
  currentTab = tab;
  
  [paramsTab, headersTab, bodyTab, authTab].forEach(t => {
    t.classList.remove('border-blue-500', 'text-blue-500');
    t.classList.add('border-transparent', 'text-gray-400');
  });
  
  [paramsPanel, headersPanel, bodyPanel, authPanel].forEach(p => p.classList.add('hidden'));
  
  switch (tab) {
    case 'params':
      paramsTab.classList.add('border-blue-500', 'text-blue-500');
      paramsTab.classList.remove('text-gray-400');
      paramsPanel.classList.remove('hidden');
      break;
    case 'headers':
      headersTab.classList.add('border-blue-500', 'text-blue-500');
      headersTab.classList.remove('text-gray-400');
      headersPanel.classList.remove('hidden');
      break;
    case 'body':
      bodyTab.classList.add('border-blue-500', 'text-blue-500');
      bodyTab.classList.remove('text-gray-400');
      bodyPanel.classList.remove('hidden');
      break;
    case 'auth':
      authTab.classList.add('border-blue-500', 'text-blue-500');
      authTab.classList.remove('text-gray-400');
      authPanel.classList.remove('hidden');
      break;
  }
}

paramsTab?.addEventListener('click', () => switchTab('params'));
headersTab?.addEventListener('click', () => switchTab('headers'));
bodyTab?.addEventListener('click', () => switchTab('body'));
authTab?.addEventListener('click', () => switchTab('auth'));

// Method Management
const updateMethodButton = () => {
  Object.values(methodColors).forEach(color => methodText.classList.remove(color));
  methodText.classList.add(methodColors[currentMethod]);
  methodText.textContent = currentMethod;
};

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

function isHttpMethod(method: string): method is HttpMethod {
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method);
}

// Key-Value Pair Management
function createKeyValueRow(
  key: string = '',
  value: string = '',
  enabled: boolean = true,
  onDelete: () => void
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'flex gap-2 items-center mb-2';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = enabled;
  checkbox.className = 'w-5 h-5';
  checkbox.addEventListener('change', debouncedSaveCurrentTab);
  
  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.value = key;
  keyInput.placeholder = 'Key';
  keyInput.className = 'flex-1 bg-gray-800 text-white p-2 rounded border border-gray-700';
  keyInput.addEventListener('input', debouncedSaveCurrentTab);
  
  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.value = value;
  valueInput.placeholder = 'Value';
  valueInput.className = 'flex-1 bg-gray-800 text-white p-2 rounded border border-gray-700';
  valueInput.addEventListener('input', debouncedSaveCurrentTab);
  
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '×';
  deleteBtn.className = 'bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-xl font-bold';
  deleteBtn.onclick = onDelete;
  
  row.appendChild(checkbox);
  row.appendChild(keyInput);
  row.appendChild(valueInput);
  row.appendChild(deleteBtn);
  
  return row;
}

function addParam() {
  const index = queryParams.length;
  queryParams.push({ key: '', value: '', enabled: true });
  
  const row = createKeyValueRow('', '', true, () => {
    queryParams.splice(index, 1);
    renderParams();
    debouncedSaveCurrentTab();
  });
  
  paramsContainer.appendChild(row);
}

function renderParams() {
  paramsContainer.innerHTML = '';
  queryParams.forEach((param, index) => {
    const row = createKeyValueRow(param.key, param.value, param.enabled, () => {
      queryParams.splice(index, 1);
      renderParams();
      debouncedSaveCurrentTab();
    });
    paramsContainer.appendChild(row);
  });
}

function addHeader() {
  const index = headers.length;
  headers.push({ key: '', value: '', enabled: true });
  
  const row = createKeyValueRow('', '', true, () => {
    headers.splice(index, 1);
    renderHeaders();
    debouncedSaveCurrentTab();
  });
  
  headersContainer.appendChild(row);
}

function renderHeaders() {
  headersContainer.innerHTML = '';
  headers.forEach((header, index) => {
    const row = createKeyValueRow(header.key, header.value, header.enabled, () => {
      headers.splice(index, 1);
      renderHeaders();
      debouncedSaveCurrentTab();
    });
    headersContainer.appendChild(row);
  });
}

function addFormField() {
  const index = formFields.length;
  formFields.push({ key: '', value: '', enabled: true });
  
  const row = createKeyValueRow('', '', true, () => {
    formFields.splice(index, 1);
    renderFormFields();
    debouncedSaveCurrentTab();
  });
  
  bodyFormDataContainer.appendChild(row);
}

function renderFormFields() {
  bodyFormDataContainer.innerHTML = '';
  formFields.forEach((field, index) => {
    const row = createKeyValueRow(field.key, field.value, field.enabled, () => {
      formFields.splice(index, 1);
      renderFormFields();
      debouncedSaveCurrentTab();
    });
    bodyFormDataContainer.appendChild(row);
  });
}

addParamBtn?.addEventListener('click', addParam);
addHeaderBtn?.addEventListener('click', addHeader);
addFormFieldBtn?.addEventListener('click', addFormField);

// Body Type Management
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

// Add debounced save to body textareas
bodyRawTextarea?.addEventListener('input', debouncedSaveCurrentTab);
bodyJsonTextarea?.addEventListener('input', debouncedSaveCurrentTab);

// Auth Type Management
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

// Add debounced save to auth inputs
document.getElementById('auth-basic-username')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-basic-password')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-bearer-token')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-apikey-key')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-apikey-value')?.addEventListener('input', debouncedSaveCurrentTab);
document.getElementById('auth-apikey-addto')?.addEventListener('change', debouncedSaveCurrentTab);

// Response Display
const getStatusText = (code: number): string => {
  const statusTexts: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 405: 'Method Not Allowed',
    500: 'Internal Server Error', 502: 'Bad Gateway',
    503: 'Service Unavailable', 504: 'Gateway Timeout'
  };
  return statusTexts[code] || 'Unknown';
};

const detectLanguage = (data: string): string => {
  const trimmed = data.trim();
  
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {}
  }
  
  if (trimmed.startsWith('<?xml') || 
      (trimmed.startsWith('<') && trimmed.includes('</') && trimmed.endsWith('>'))) {
    return 'xml';
  }
  
  if (trimmed.toLowerCase().includes('<!doctype html') || 
      trimmed.toLowerCase().includes('<html')) {
    return 'html';
  }
  
  return 'plaintext';
};

const displayResponse = (response: HttpResponse) => {
  lastResponse = response;
  resultDiv.innerHTML = '';
  
  const codeBlock = document.createElement('pre');
  codeBlock.style.margin = '0';
  codeBlock.style.width = '100%';
  codeBlock.style.overflow = 'visible';
  
  const codeElement = document.createElement('code');
  codeElement.style.display = 'block';
  codeElement.style.padding = '1rem';
  codeElement.style.whiteSpace = 'pre';
  codeElement.style.overflowWrap = 'normal';
  codeElement.style.wordBreak = 'normal';
  
  const data = response.body;
  
  switch (currentFormat) {
    case 'raw':
      const detectedLang = detectLanguage(data);
      codeElement.className = `language-${detectedLang}`;
      codeElement.textContent = data;
      break;
      
    case 'json':
      try {
        const parsed = JSON.parse(data);
        const formatted = JSON.stringify(parsed, null, 2);
        codeElement.className = 'language-json';
        codeElement.textContent = formatted;
      } catch {
        codeElement.className = 'language-plaintext';
        codeElement.textContent = 'Invalid JSON: ' + data;
      }
      break;
      
    case 'html':
      codeElement.className = 'language-html';
      codeElement.textContent = data;
      break;
      
    case 'xml':
      codeElement.className = 'language-xml';
      codeElement.textContent = data;
      break;
  }
  
  codeBlock.appendChild(codeElement);
  resultDiv.appendChild(codeBlock);
  hljs.highlightElement(codeElement);
  
  // Update stats
  statusCodeSpan.textContent = `${response.status} ${response.statusText}`;
  statusCodeSpan.className = response.status >= 200 && response.status < 300 
    ? 'text-green-400 font-semibold' 
    : 'text-red-400 font-semibold';
  
  responseTimeSpan.textContent = `${response.time.toFixed(0)}ms`;
  responseSizeSpan.textContent = `${(response.size / 1024).toFixed(2)}KB`;
};

formatSelect?.addEventListener('change', () => {
  currentFormat = formatSelect.value as DisplayFormat;
  if (lastResponse) {
    displayResponse(lastResponse);
  }
});

// Build Request
function buildRequest(): Request {
  // Get query params from inputs
  const paramRows = paramsContainer.querySelectorAll('.flex');
  const currentParams: KeyValue[] = [];
  paramRows.forEach(row => {
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const inputs = row.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
    currentParams.push({
      key: inputs[0].value,
      value: inputs[1].value,
      enabled: checkbox.checked
    });
  });
  
  // Get headers from inputs
  const headerRows = headersContainer.querySelectorAll('.flex');
  const currentHeaders: KeyValue[] = [];
  headerRows.forEach(row => {
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const inputs = row.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
    currentHeaders.push({
      key: inputs[0].value,
      value: inputs[1].value,
      enabled: checkbox.checked
    });
  });
  
  // Build body
  const bodyType = bodyTypeSelect.value as BodyType;
  let body: Request['body'];
  
  if (bodyType === 'none') {
    body = undefined;
  } else if (bodyType === 'raw' || bodyType === 'x-www-form-urlencoded') {
    body = { type: bodyType, raw: bodyRawTextarea.value };
  } else if (bodyType === 'json') {
    body = { type: bodyType, json: bodyJsonTextarea.value };
  } else if (bodyType === 'form-data') {
    const formRows = bodyFormDataContainer.querySelectorAll('.flex');
    const formData: KeyValue[] = [];
    formRows.forEach(row => {
      const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
      const inputs = row.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
      formData.push({
        key: inputs[0].value,
        value: inputs[1].value,
        enabled: checkbox.checked
      });
    });
    body = { type: bodyType, formData };
  }
  
  // Build auth
  const authType = authTypeSelect.value as AuthType;
  let auth: Request['auth'];
  
  if (authType === 'none') {
    auth = undefined;
  } else if (authType === 'basic') {
    const username = (document.getElementById('auth-basic-username') as HTMLInputElement).value;
    const password = (document.getElementById('auth-basic-password') as HTMLInputElement).value;
    auth = { type: authType, basic: { username, password } };
  } else if (authType === 'bearer') {
    const token = (document.getElementById('auth-bearer-token') as HTMLInputElement).value;
    auth = { type: authType, bearer: { token } };
  } else if (authType === 'api-key') {
    const key = (document.getElementById('auth-apikey-key') as HTMLInputElement).value;
    const value = (document.getElementById('auth-apikey-value') as HTMLInputElement).value;
    const addTo = (document.getElementById('auth-apikey-addto') as HTMLSelectElement).value as 'header' | 'query';
    auth = { type: authType, apiKey: { key, value, addTo } };
  }
  
  return {
    id: Date.now().toString(),
    name: 'Untitled Request',
    method: currentMethod,
    url: urlInput.value,
    headers: currentHeaders,
    body,
    auth,
    queryParams: currentParams,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// Send Request
fetchButton?.addEventListener('click', async () => {
  try {
    fetchButton.disabled = true;
    fetchButton.textContent = 'Sending...';
    
    saveCurrentTab(); // Save immediately before sending
    
    const request = buildRequest();
    const response = await window.electron.sendRequest(request);
    
    displayResponse(response);
    saveCurrentTab(); // Save after response
  } catch (error) {
    console.error(error);
    statusCodeSpan.textContent = 'Error';
    statusCodeSpan.className = 'text-red-400 font-semibold';
    resultDiv.textContent = `Error: ${(error as Error).message}`;
  } finally {
    fetchButton.disabled = false;
    fetchButton.textContent = 'Send';
  }
});

// Save Request
saveRequestBtn?.addEventListener('click', async () => {
  const request = buildRequest();
  
  // Use a default name based on method and URL
  try {
    const url = new URL(request.url);
    const urlPath = url.pathname.split('/').filter(p => p).join('_') || url.hostname.replace(/\./g, '_');
    request.name = `${request.method}_${urlPath}`;
  } catch {
    // If URL is invalid, just use method and timestamp
    request.name = `${request.method}_${Date.now()}`;
  }
  
  try {
    await window.electron.exportRequest(request);
  } catch (error) {
    console.error('Failed to export request:', error);
  }
});

// Load Request
loadRequestBtn?.addEventListener('click', async () => {
  try {
    const request = await window.electron.importRequest();
    
    if (!request) {
      return;
    }
    
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      tab.request = request;
      tab.response = null;
      loadTab(activeTabId);
    }
    
  } catch (error) {
    console.error('Failed to load request:', error);
  }
});

// View History
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
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab) {
        tab.request = entry.request;
        tab.response = entry.response;
        loadTab(activeTabId);
      }
      historyModal.classList.add('hidden');
    };
    
    historyContainer.appendChild(item);
  });
  
  historyModal.classList.remove('hidden');
});

// Clear history
clearHistoryBtn?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
    await window.electron.clearHistory();
    historyContainer.innerHTML = '<div class="text-gray-400 text-center py-8">History cleared</div>';
  }
});

// Close history modal
closeHistoryBtn?.addEventListener('click', () => {
  historyModal.classList.add('hidden');
});

// Initialize
createNewTab();
switchTab('params');