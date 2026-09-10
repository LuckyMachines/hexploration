import FirstExpeditionGuide from './FirstExpeditionGuide';
import GameBrowser from './GameBrowser';
import SystemHealth from '../shared/SystemHealth';
import SocialHub from '../social/SocialHub';

export default function LiveClientStack() {
  return (
    <div className="space-y-5">
      <FirstExpeditionGuide />
      <SystemHealth />
      <SocialHub />
      <GameBrowser />
    </div>
  );
}
