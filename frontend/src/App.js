import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import ActorsList from '@/pages/actors/ActorsList';
import ActorDetail from '@/pages/actors/ActorDetail';
import BeekeepersList from '@/pages/beekeepers/BeekeepersList';
import BeekeeperDetail from '@/pages/beekeepers/BeekeeperDetail';
import VillagesList from '@/pages/villages/VillagesList';
import ConnectionsList from '@/pages/connections/ConnectionsList';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa] text-[#7089b4]">
        Loading...
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route
        path="/actors/potential"
        element={<ProtectedRoute><ActorsList fixedStatus="Inactive" title="Actors — Potential" testId="actors-potential-table" /></ProtectedRoute>}
      />
      <Route
        path="/actors/actual"
        element={<ProtectedRoute><ActorsList fixedStatus="Active" title="Actors — Actual" testId="actors-actual-table" /></ProtectedRoute>}
      />
      <Route path="/actors/:id" element={<ProtectedRoute><ActorDetail /></ProtectedRoute>} />
      <Route
        path="/beekeepers"
        element={<ProtectedRoute><BeekeepersList title="Beekeepers" testId="beekeepers-table" /></ProtectedRoute>}
      />
      <Route
        path="/beekeepers/potential"
        element={<ProtectedRoute><BeekeepersList fixedStatus="Potential" title="Beekeepers — Potential" testId="beekeepers-potential-table" /></ProtectedRoute>}
      />
      <Route
        path="/beekeepers/actual"
        element={<ProtectedRoute><BeekeepersList fixedStatus="Actual" title="Beekeepers — Actual" testId="beekeepers-actual-table" /></ProtectedRoute>}
      />
      <Route path="/beekeepers/:id" element={<ProtectedRoute><BeekeeperDetail /></ProtectedRoute>} />
      <Route path="/villages" element={<ProtectedRoute><VillagesList /></ProtectedRoute>} />
      <Route path="/connections" element={<ProtectedRoute><ConnectionsList /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </div>
  );
}

export default App;
