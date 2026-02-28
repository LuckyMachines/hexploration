import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletProvider } from './contexts/WalletContext';
import { UIScaleProvider } from './contexts/UIScaleContext';
import App from './App';
import './fonts.css';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UIScaleProvider>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WalletProvider>
      </QueryClientProvider>
    </UIScaleProvider>
  </React.StrictMode>,
);
