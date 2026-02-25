import { useState } from 'react';
import './App.css';

import ImportTab from './components/tabs/ImportTab';
import RecommendedTab from './components/tabs/RecommendedTab';
import AdoptionTab from './components/tabs/AdoptionTab';
import ViralTab from './components/tabs/ViralTab';

const TABS = [
  { key: 'import', label: 'Remplissage BDD', component: ImportTab },
  { key: 'recommended', label: 'Followers', component: RecommendedTab },
  { key: 'adoption', label: 'Produit specifique', component: AdoptionTab },
  { key: 'viral', label: 'Viral', component: ViralTab },
];

function App() {
  const [activeTab, setActiveTab] = useState('import');

  return (
    <div className="app">
      <header className="app-header">
        <h1>NoSQL Analyseur</h1>
        <p>Comparaison PostgreSQL vs Neo4j — Analyse d'influence sociale</p>
      </header>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {TABS.map((tab) => (
        <div key={tab.key} style={{ display: activeTab === tab.key ? 'block' : 'none' }}>
          <tab.component />
        </div>
      ))}
    </div>
  );
}

export default App;
