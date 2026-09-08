import ChainQueryProvider from '../components/shared/ChainQueryProvider';
import GamePage from './GamePage';

export default function GameClientPage() {
  return (
    <ChainQueryProvider>
      <GamePage />
    </ChainQueryProvider>
  );
}
