import { useState } from 'react';
import { DashboardShell } from '../../../widgets/dashboard-shell';
import { StormStory } from '../../../widgets/storm-story';

export const DashboardPage = () => {
  const [view, setView] = useState<'story' | 'trends'>('story');
  return (
    <main className="app-shell" id="main-content">
      <a className="skip-link" href="#weather-view">Skip navigation</a>
      <nav className="weather-navigation" aria-label="Weather views">
        <span className="weather-brand">Huntshaw <span>Weather observatory</span></span>
        <div className="button-row">
          <button className={view === 'story' ? 'button-primary' : 'button-secondary'} aria-pressed={view === 'story'} onClick={() => setView('story')}>Storm story</button>
          <button className={view === 'trends' ? 'button-primary' : 'button-secondary'} aria-pressed={view === 'trends'} onClick={() => setView('trends')}>Explore trends</button>
        </div>
      </nav>
      <div id="weather-view">{view === 'story' ? <StormStory /> : <DashboardShell />}</div>
    </main>
  );
};
