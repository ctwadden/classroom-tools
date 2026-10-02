import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if('serviceWorker' in navigator)window.addEventListener('load',()=>{navigator.serviceWorker.register('/field/sw.js',{scope:'/field/'}).catch(()=>{/* Online capture still works if the browser disallows installation. */});});
