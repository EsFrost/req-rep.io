import { KeyValue } from '../../shared/types';

export function createKeyValueRow(
  key: string = '',
  value: string = '',
  enabled: boolean = true,
  onDelete: () => void,
  onChange?: () => void,
  sensitive: boolean = false,
  showSensitiveToggle: boolean = false
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'flex gap-2 items-center mb-2';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = enabled;
  checkbox.className = 'w-5 h-5 rounded border border-gray-700 accent-[rgb(7,14,29)] cursor-pointer bg-[rgba(7,14,29,1.0)]';
  if (onChange) {
    checkbox.addEventListener('change', onChange);
  }
  
  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.value = key;
  keyInput.placeholder = 'Key';
  keyInput.className = 'flex-1 bg-[rgba(7,14,29,0.7)] text-white p-2 rounded border border-gray-700';
  if (onChange) {
    keyInput.addEventListener('input', onChange);
  }
  
  const valueInput = document.createElement('input');
  valueInput.type = sensitive ? 'password' : 'text';
  valueInput.value = value;
  valueInput.placeholder = 'Value';
  valueInput.className = 'flex-1 bg-[rgba(7,14,29,0.7)] text-white p-2 rounded border border-gray-700';
  if (onChange) {
    valueInput.addEventListener('input', onChange);
  }
  
  // Add sensitive toggle if needed
  if (showSensitiveToggle) {
    const sensitiveBtn = document.createElement('button');
    sensitiveBtn.type = 'button';
    sensitiveBtn.className = sensitive 
      ? 'bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded text-xl'
      : 'bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded text-xl';
    sensitiveBtn.textContent = '🔒';
    sensitiveBtn.title = 'Mark as sensitive (encrypted storage)';
    sensitiveBtn.onclick = () => {
      const newSensitive = !sensitive;
      sensitiveBtn.className = newSensitive
        ? 'bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded text-xl'
        : 'bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded text-xl';
      valueInput.type = newSensitive ? 'password' : 'text';
      if (onChange) onChange();
    };
    row.appendChild(sensitiveBtn);
  }
  
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '×';
  deleteBtn.className = "px-3 py-2text-xl font-bold overflow-hidden border border-gray-400 rounded-md px-4 py-2 text-lg cursor-pointer bg-[rgba(17,24,39,0.3)] backdrop-blur-xs shadow-[0_8px_32px_rgba(0,0,0,0.1),_inset_0_1px_0_rgba(255,255,255,0.5),_inset_0_-1px_0_rgba(255,255,255,0.1),_inset_0_0_5px_2.5px_rgba(255,255,255,0.25)] transition-all duration-500 ease-in-out hover:backdrop-blur-md hover:shadow-[0_8px_32px_rgba(0,0,0,0.1),_inset_0_1px_0_rgba(255,255,255,0.5),_inset_0_-1px_0_rgba(255,255,255,0.1),_inset_0_0_10px_5px_rgba(255,255,255,0.5)] before:content-[''] before:absolute before:top-0 before:left-[-100%] before:w-[50%] before:h-full before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:skew-x-[-25deg] before:transition-all before:duration-500 before:ease-in-out hover:before:left-[150%] active:shadow-[0_8px_32px_rgba(0,0,0,0.1),_inset_0_1px_0_rgba(255,255,255,0.5),_inset_0_-1px_0_rgba(255,255,255,0.1),_inset_0_0_15px_7.5px_rgba(255,255,255,0.75)] active:duration-10";
  deleteBtn.onclick = onDelete;
  
  row.appendChild(checkbox);
  row.appendChild(keyInput);
  row.appendChild(valueInput);
  row.appendChild(deleteBtn);
  
  return row;
}

export function renderKeyValueList(
  container: HTMLDivElement,
  items: KeyValue[],
  onUpdate: () => void
): void {
  container.innerHTML = '';
  items.forEach((item, index) => {
    const row = createKeyValueRow(item.key, item.value, item.enabled, () => {
      items.splice(index, 1);
      renderKeyValueList(container, items, onUpdate);
      onUpdate();
    }, onUpdate);
    container.appendChild(row);
  });
}

export function addKeyValue(
  items: KeyValue[],
  container: HTMLDivElement,
  onUpdate: () => void
): void {
  items.push({ key: '', value: '', enabled: true });
  renderKeyValueList(container, items, onUpdate);
}