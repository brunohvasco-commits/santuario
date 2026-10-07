import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSession } from './supabase';
import { AuthPage } from './pages/AuthPage';
import { Lobby } from './pages/Lobby';
import { GamePage } from './pages/GamePage';
import './styles.css';

function RequireAuth({ children }: { children: JSX.Element }) {
  const session = useSession();
  const loc = useLocation();
  if (session === undefined) return <div className="loading">Abrindo o santuário…</div>;
  if (!session) return <Navigate to={`/entrar?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<AuthPage />} />
      <Route path="/" element={<RequireAuth><Lobby /></RequireAuth>} />
      <Route path="/jogo/:id" element={<RequireAuth><GamePage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
