import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import {
  ChatView,
  BoardView,
  GitView,
  FilesView,
  TimelineView,
  ReviewQueueView,
  SettingsView,
} from './views';
import { initGateway } from './lib/gateway';

// Error display component
function ErrorDisplay({ error }: { error: Error }) {
  return (
    <div className="p-10 text-[var(--color-error)] bg-[var(--color-bg-primary)] min-h-screen font-mono">
      <h1 className="text-xl font-bold mb-4">OpenClaw Dashboard - Error</h1>
      <pre className="bg-[var(--color-bg-secondary)] p-4 rounded-lg overflow-auto text-sm">
        {error.message}
        {'\n'}
        {error.stack}
      </pre>
      <button
        onClick={() => window.location.reload()}
        className="mt-5 px-4 py-2 bg-[var(--color-accent)] text-white rounded-md cursor-pointer hover:bg-[var(--color-accent-hover)] transition-colors"
      >
        Reload
      </button>
    </div>
  );
}

function App() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Initialize gateway after store is ready
    initGateway();
    
    const handleError = (e: ErrorEvent) => {
      console.error('[App] Global error:', e.error);
      setError(e.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <HashRouter>
      <div className="flex flex-col w-screen h-screen overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <Header />
        <div className="flex-1 flex w-full overflow-hidden relative">
          <Routes>
            <Route path="/" element={<ChatView />} />
            <Route path="/board" element={<BoardView />} />
            <Route path="/git" element={<GitView />} />
            <Route path="/files" element={<FilesView />} />
            <Route path="/timeline" element={<TimelineView />} />
            <Route path="/reviews" element={<ReviewQueueView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
