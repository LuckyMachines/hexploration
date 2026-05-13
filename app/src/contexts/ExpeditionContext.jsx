import { createContext, useContext } from 'react';
import { useExpeditionViewModel } from '../hooks/useExpeditionViewModel';

const ExpeditionContext = createContext(null);

export function ExpeditionProvider({ gameId, children }) {
  const view = useExpeditionViewModel(gameId);
  return (
    <ExpeditionContext.Provider value={view}>
      {children}
    </ExpeditionContext.Provider>
  );
}

export function useExpedition() {
  const context = useContext(ExpeditionContext);
  if (!context) {
    throw new Error('useExpedition must be used inside ExpeditionProvider');
  }
  return context;
}
