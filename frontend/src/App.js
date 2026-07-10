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
import CompanyProfile from '@/pages/company/CompanyProfile';
import ContractsList from '@/pages/contracts/ContractsList';
import TransactionsList from '@/pages/transactions/TransactionsList';
import StocksList from '@/pages/stocks/StocksList';
import BulkUploads from '@/pages/bulkUploads/BulkUploads';
import Report from '@/pages/report/Report';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafc] text-[#7089b4]">
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

      {/* Actor profile (self / company profile) */}
      <Route path="/company-profile" element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />

      {/* Commercial partners > Actors */}
      <Route
        path="/actors/potential"
        element={<ProtectedRoute><ActorsList fixedStatus="Inactive" title="Actors — Potential" testId="actors-potential-table" /></ProtectedRoute>}
      />
      <Route
        path="/actors/actual"
        element={<ProtectedRoute><ActorsList fixedStatus="Active" title="Actors — Actual" testId="actors-actual-table" /></ProtectedRoute>}
      />
      <Route path="/actors/:id" element={<ProtectedRoute><ActorDetail /></ProtectedRoute>} />

      {/* Commercial partners > Beekeepers */}
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

      {/* Contracts */}
      <Route path="/contracts" element={<ProtectedRoute><ContractsList /></ProtectedRoute>} />

      {/* Transactions */}
      <Route
        path="/transactions/received"
        element={<ProtectedRoute><TransactionsList direction="Received" title="Received transactions" actionLabel="Receive stock" testId="transactions-received-table" /></ProtectedRoute>}
      />
      <Route
        path="/transactions/processing"
        element={<ProtectedRoute><TransactionsList direction="Processing" title="Processing transactions" actionLabel="Process stock" testId="transactions-processing-table" /></ProtectedRoute>}
      />
      <Route
        path="/transactions/send"
        element={<ProtectedRoute><TransactionsList direction="Send" title="Send transactions" actionLabel="Send stock" testId="transactions-send-table" /></ProtectedRoute>}
      />

      {/* Stocks */}
      <Route
        path="/stocks/raw-material"
        element={<ProtectedRoute><StocksList stockType="Raw Material" title="Raw material stocks" actionLabel="Receive stock" testId="stocks-raw-material-table" /></ProtectedRoute>}
      />
      <Route
        path="/stocks/final-product"
        element={<ProtectedRoute><StocksList stockType="Final Product" title="Final product stocks" actionLabel="Add stock" testId="stocks-final-product-table" /></ProtectedRoute>}
      />
      <Route
        path="/stocks/loss"
        element={<ProtectedRoute><StocksList stockType="Loss" title="Loss" actionLabel="Record loss" testId="stocks-loss-table" /></ProtectedRoute>}
      />

      <Route path="/bulk-uploads" element={<ProtectedRoute><BulkUploads /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />

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
