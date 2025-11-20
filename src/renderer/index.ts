import hljs from 'highlight.js';
import { FetchResponse, HttpMethod } from '../shared/types';

declare global {
  interface Window {
    electron: {
      fetchUrl: (url: string) => Promise<FetchResponse>;
    };
  }
}

type DisplayFormat = 'raw' | 'json' | 'html' | 'xml';

const fetchButton = document.getElementById('fetch') as HTMLButtonElement;
const urlInput = document.getElementById('url') as HTMLInputElement;
const resultDiv = document.getElementById('result') as HTMLDivElement;
const formatSelect = document.getElementById('format-select') as HTMLSelectElement;
const methodButton = document.getElementById('method-button') as HTMLButtonElement;
const methodText = document.getElementById('method-text') as HTMLSpanElement;
const methodDropdown = document.getElementById('method-dropdown') as HTMLDivElement;
const statusCodeSpan = document.getElementById('status-code') as HTMLSpanElement;

let currentFormat: DisplayFormat = 'raw';
let currentMethod: HttpMethod = 'GET';
let lastResponse: string = '';

const methodColors: Record<HttpMethod, string> = {
  'GET': 'text-green-600',
  'POST': 'text-yellow-600',
  'PUT': 'text-blue-600',
  'PATCH': 'text-pink-600',
  'DELETE': 'text-red-600',
  'HEAD': 'text-green-400',
  'OPTIONS': 'text-purple-600'
};

const updateMethodButton = () => {
  // Remove all color classes from methodText
  Object.values(methodColors).forEach(color => {
    methodText.classList.remove(color);
  });
  // Add the current method's color
  methodText.classList.add(methodColors[currentMethod]);
  methodText.textContent = currentMethod;
};

// Toggle dropdown
methodButton?.addEventListener('click', (e) => {
  e.stopPropagation();
  methodDropdown.classList.toggle('hidden');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!methodDropdown.contains(e.target as Node) && e.target !== methodButton) {
    methodDropdown.classList.add('hidden');
  }
});

// Handle method selection
const methodOptions = methodDropdown.querySelectorAll('[data-method]');
methodOptions.forEach(option => {
  option.addEventListener('click', () => {
    currentMethod = option.getAttribute('data-method') as HttpMethod;
    updateMethodButton();
    methodDropdown.classList.add('hidden');
  });
});

const getStatusText = (code: number): string => {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };
  return statusTexts[code] || 'Unknown';
};

const detectLanguage = (data: string): string => {
  const trimmed = data.trim();
  
  // Check for JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }
  
  // Check for XML
  if (trimmed.startsWith('<?xml') || 
      (trimmed.startsWith('<') && trimmed.includes('</') && trimmed.endsWith('>'))) {
    return 'xml';
  }
  
  // Check for HTML
  if (trimmed.toLowerCase().includes('<!doctype html') || 
      trimmed.toLowerCase().includes('<html')) {
    return 'html';
  }
  
  return 'plaintext';
};

const displayResponse = (data: string) => {
  lastResponse = data;
  resultDiv.innerHTML = '';
  
  const codeBlock = document.createElement('pre');
  const codeElement = document.createElement('code');
  
  switch (currentFormat) {
    case 'raw':
      // Auto-detect language for syntax highlighting
      const detectedLang = detectLanguage(data);
      codeElement.className = `language-${detectedLang}`;
      codeElement.textContent = data;
      codeBlock.appendChild(codeElement);
      resultDiv.appendChild(codeBlock);
      hljs.highlightElement(codeElement);
      break;
      
    case 'json':
      try {
        const parsed = JSON.parse(data);
        const formatted = JSON.stringify(parsed, null, 2);
        codeElement.className = 'language-json';
        codeElement.textContent = formatted;
        codeBlock.appendChild(codeElement);
        resultDiv.appendChild(codeBlock);
        hljs.highlightElement(codeElement);
      } catch {
        codeElement.className = 'language-plaintext';
        codeElement.textContent = 'Invalid JSON: ' + data;
        codeBlock.appendChild(codeElement);
        resultDiv.appendChild(codeBlock);
        hljs.highlightElement(codeElement);
      }
      break;
      
    case 'html':
      codeElement.className = 'language-html';
      codeElement.textContent = data;
      codeBlock.appendChild(codeElement);
      resultDiv.appendChild(codeBlock);
      hljs.highlightElement(codeElement);
      break;
      
    case 'xml':
      codeElement.className = 'language-xml';
      codeElement.textContent = data;
      codeBlock.appendChild(codeElement);
      resultDiv.appendChild(codeBlock);
      hljs.highlightElement(codeElement);
      break;
  }
};

formatSelect?.addEventListener('change', () => {
  currentFormat = formatSelect.value as DisplayFormat;
  if (lastResponse) {
    displayResponse(lastResponse);
  }
});

fetchButton?.addEventListener('click', async () => {
  try {
    const response = await window.electron.fetchUrl(urlInput.value);
    if (response.success && response.statusCode) {
      const statusText = getStatusText(response.statusCode);
      statusCodeSpan.textContent = `${response.statusCode} ${statusText}`;
      
      // Green for 2xx status codes, red for others
      if (response.statusCode >= 200 && response.statusCode < 300) {
        statusCodeSpan.className = 'text-green-400 font-semibold';
      } else {
        statusCodeSpan.className = 'text-red-400 font-semibold';
      }
      
      displayResponse(response.data || '');
    } else {
      // Show error status
      statusCodeSpan.textContent = 'Error';
      statusCodeSpan.className = 'text-red-400 font-semibold';
      resultDiv.textContent = `Error: ${response.error}`;
    }
  } catch (error) {
    console.error(error);
    statusCodeSpan.textContent = 'Error';
    statusCodeSpan.className = 'text-red-400 font-semibold';
    resultDiv.textContent = 'An error occurred';
  }
});