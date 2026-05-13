import GameBrowser from '../components/game/GameBrowser';
import FirstExpeditionGuide from '../components/game/FirstExpeditionGuide';
import SystemHealth from '../components/shared/SystemHealth';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
      <SurveyTabletFrame
        title="Xenovoya"
        subtitle="Survey targets, system status, and live survey access"
        status="SURVEY READY"
      >
        <div className="space-y-6">
          <FirstExpeditionGuide />
          <SystemHealth />
          <GameBrowser />
        </div>
      </SurveyTabletFrame>
    </div>
  );
}
