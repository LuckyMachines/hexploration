import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import { UIScaleProvider } from './contexts/UIScaleContext';
import { PlayerSessionProvider } from './contexts/PlayerSessionContext';
import ChainQueryProvider from './components/shared/ChainQueryProvider';
import App from './App';
import { initAnalytics } from './lib/analytics';
import { initUXTelemetry } from './lib/uxTelemetry';
import { initSessionTelemetry, markSessionMilestone } from './lib/sessionTelemetry';
import './fonts.css';
import './index.css';

initAnalytics();
initUXTelemetry();
initSessionTelemetry();
markSessionMilestone('app-start');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UIScaleProvider>
      <WalletProvider>
        <ChainQueryProvider>
          <PlayerSessionProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </PlayerSessionProvider>
        </ChainQueryProvider>
      </WalletProvider>
    </UIScaleProvider>
  </React.StrictMode>,
);
