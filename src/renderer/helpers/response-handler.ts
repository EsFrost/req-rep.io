import hljs from 'highlight.js';
import { HttpResponse } from '../../shared/types';

export type DisplayFormat = 'raw' | 'json' | 'html' | 'xml';

export const getStatusText = (code: number): string => {
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

export const detectLanguage = (data: string): string => {
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

export const displayResponse = (
  response: HttpResponse,
  currentFormat: DisplayFormat,
  resultDiv: HTMLDivElement,
  statusCodeSpan: HTMLSpanElement,
  responseTimeSpan: HTMLSpanElement,
  responseSizeSpan: HTMLSpanElement
): void => {
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
  codeElement.style.setProperty('background-color', 'rgba(7,14,29,0.7)', 'important');
  
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
  
  statusCodeSpan.textContent = `${response.status} ${response.statusText}`;
  statusCodeSpan.className = response.status >= 200 && response.status < 300 
    ? 'text-green-400 font-semibold' 
    : 'text-red-400 font-semibold';
  
  responseTimeSpan.textContent = `${response.time.toFixed(0)}ms`;
  responseSizeSpan.textContent = `${(response.size / 1024).toFixed(2)}KB`;
};