import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import { UIScaleProvider } from './contexts/UIScaleContext';
import App from './App';
import { initAnalytics } from './lib/analytics';
import './fonts.css';
import './index.css';

initAnalytics();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UIScaleProvider>
      <WalletProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </WalletProvider>
    </UIScaleProvider>
  </React.StrictMode>,
);
