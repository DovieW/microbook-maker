import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import './style.css';
import './motion-controls.css';
import { installDisclosureMotion } from './motion';
async function start() {
  if (import.meta.env.VITE_HOSTED === '1') {
    const { startHosted } = await import('./hosted/runtime');
    await startHosted();
  }
  installDisclosureMotion();
  createRoot(document.getElementById('root')!).render(<App />);
}
void start().catch((error) => {
  document.getElementById('root')!.textContent =
    'MicroBook could not start. Reload this page. ' + String(error?.message || '');
});
