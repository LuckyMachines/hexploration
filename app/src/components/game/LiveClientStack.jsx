import GameBrowser from './GameBrowser';

export default function LiveClientStack({ crewOpen = false, onCrewToggle = () => {} }) {
  void crewOpen;
  void onCrewToggle;
  return (
    <div className="space-y-4">
      <GameBrowser />
    </div>
  );
}
