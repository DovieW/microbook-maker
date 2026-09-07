import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import './style.css';
async function start() {
  if (import.meta.env.VITE_HOSTED === '1') {
    const { startHosted } = await import('./hosted/runtime');
    await startHosted();
  }
  createRoot(document.getElementById('root')!).render(<App />);
}
void start().catch((error) => {
  document.getElementById('root')!.textContent =
    'MicroBook could not start. Reload this page. ' + String(error?.message || '');
});
