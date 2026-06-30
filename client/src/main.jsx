import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './components/ToastProvider.jsx';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import { LightboxProvider } from './components/LightboxProvider.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <LightboxProvider>
          <App />
        </LightboxProvider>
      </ConfirmProvider>
    </ToastProvider>
  </React.StrictMode>
);
