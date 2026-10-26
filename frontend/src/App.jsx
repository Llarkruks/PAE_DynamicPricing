import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Simulator from './pages/Simulator';
import Analytics from './pages/Analytics';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen font-['Inter'] text-on-surface relative overflow-hidden bg-transparent">
        <Sidebar />
        <div className="relative z-10 w-full flex">
          <Routes>
            <Route path="/" element={<Navigate to="/simulator" replace />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
