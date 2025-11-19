export {};

declare global {
  interface Window {
    electron: {
      fetchUrl: (url: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    };
  }
}

const fetchButton = document.getElementById('fetch') as HTMLButtonElement;
const urlInput = document.getElementById('url') as HTMLInputElement;
const resultDiv = document.getElementById('result') as HTMLDivElement;

fetchButton.addEventListener('click', async () => {
  try {
    const response = await window.electron.fetchUrl(urlInput.value);
    if (response.success) {
      resultDiv.textContent = response.data || '';
    } else {
      resultDiv.textContent = `Error: ${response.error}`;
    }
  } catch (error) {
    console.error(error);
    resultDiv.textContent = 'An error occurred';
  }
});