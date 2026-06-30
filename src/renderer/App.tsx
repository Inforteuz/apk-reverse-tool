import { useEffect } from 'react';
import { useAppStore } from './store';
import Welcome from './components/Welcome';
import Analyzing from './components/Analyzing';
import Results from './components/Results';

export default function App() {
  const currentScreen = useAppStore(state => state.currentScreen);
  const loadHistory = useAppStore(state => state.loadHistory);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="relative h-screen w-screen flex flex-col bg-bg text-default overflow-hidden">
      {/* macOS-style draggable title bar */}
      <div className="drag-region h-7 w-full flex-shrink-0 z-20" />

      {/* Screen router */}
      <div className="relative flex-1 flex flex-col min-h-0">
        {currentScreen === 'welcome'   && <Welcome />}
        {currentScreen === 'analyzing' && <Analyzing />}
        {currentScreen === 'results'   && <Results />}
      </div>

      <div id="toast-container" className="toast-container" aria-live="assertive" />
    </div>
  );
}
