import FirstExpeditionGuide from './FirstExpeditionGuide';
import GameBrowser from './GameBrowser';
import ChainQueryProvider from '../shared/ChainQueryProvider';
import SystemHealth from '../shared/SystemHealth';

export default function LiveClientStack() {
  return (
    <ChainQueryProvider>
      <div className="space-y-5">
        <FirstExpeditionGuide />
        <SystemHealth />
        <GameBrowser />
      </div>
    </ChainQueryProvider>
  );
}
