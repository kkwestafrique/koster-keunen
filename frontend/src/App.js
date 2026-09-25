import React, { Suspense, lazy } from 'react';
import '@/App.css';
import * as Sentry from '@sentry/react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext';
import { TourProvider } from '@/contexts/TourContext';
import TourOverlay from '@/components/common/TourOverlay';
import RouteErrorFallback from '@/components/common/RouteErrorFallback';
import { Toaster } from '@/components/ui/toaster';

// Real, measured finding: the single main.js bundle was 893.67 KB
// gzipped (CRA's own recommended threshold is ~244 KB) with zero code
// splitting anywhere -- every one of these pages was downloaded
// upfront, on every single visit, regardless of role or which page the
// user actually needed. React.lazy() here means each page's code only
// loads the moment its route is actually visited. Login and the other
// public/auth pages are included too, not just the authenticated ones
// -- the very first thing a new visitor needs is only the login
// page's own code, not the whole app bundled in ahead of it.
const Login = lazy(() => import('@/pages/Login'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const SetUpPassword = lazy(() => import('@/pages/SetUpPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const ActorsList = lazy(() => import('@/pages/actors/ActorsList'));
const ActorDetail = lazy(() => import('@/pages/actors/ActorDetail'));
const BeekeepersList = lazy(() => import('@/pages/beekeepers/BeekeepersList'));
const BeekeeperDetail = lazy(() => import('@/pages/beekeepers/BeekeeperDetail'));
const VillagesList = lazy(() => import('@/pages/villages/VillagesList'));
const ConnectionsList = lazy(() => import('@/pages/connections/ConnectionsList'));
const CompanyProfile = lazy(() => import('@/pages/company/CompanyProfile'));
const ContractsList = lazy(() => import('@/pages/contracts/ContractsList'));
const ContractWizard = lazy(() => import('@/pages/contracts/ContractWizard'));
const ContractDetail = lazy(() => import('@/pages/contracts/ContractDetail'));
const TransactionsList = lazy(() => import('@/pages/transactions/TransactionsList'));
const ProcessingTransactionsList = lazy(() => import('@/pages/transactions/ProcessingTransactionsList'));
const ReceiveStockForm = lazy(() => import('@/pages/transactions/ReceiveStockForm'));
const ProcessStockForm = lazy(() => import('@/pages/transactions/ProcessStockForm'));
const SendStockForm = lazy(() => import('@/pages/transactions/SendStockForm'));
const TransactionDetail = lazy(() => import('@/pages/transactions/TransactionDetail'));
const StocksList = lazy(() => import('@/pages/stocks/StocksList'));
const LossList = lazy(() => import('@/pages/stocks/LossList'));
const BulkUploads = lazy(() => import('@/pages/bulkUploads/BulkUploads'));
const Report = lazy(() => import('@/pages/report/Report'));
const ExchangeRates = lazy(() => import('@/pages/exchangeRates/ExchangeRates'));
const AdminPanel = lazy(() => import('@/pages/admin/AdminPanel'));
const UserProfile = lazy(() => import('@/pages/UserProfile'));
const StockDetail = lazy(() => import('@/pages/stocks/StockDetail'));
const ActivityLog = lazy(() => import('@/pages/ActivityLog'));
const BeekeeperCharter = lazy(() => import('@/pages/BeekeeperCharter'));

// Same visual language as ProtectedRoute's existing "Loading..." state
// just below, so a route-chunk fetch looks identical to the auth-check
// wait that was already there -- no new, unfamiliar loading state
// introduced.
function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9fafc] text-[#7089b4]">
      Loading...
    </div>
  );
}

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
  // Per-route boundary: a render error inside this specific page no
  // longer takes the whole app down with it. See
  // RouteErrorFallback.jsx for the full reasoning and an honest note
  // on what this does and doesn't fully fix.
  return <Sentry.ErrorBoundary fallback={<RouteErrorFallback />}>{children}</Sentry.ErrorBoundary>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/set-up-password" element={<SetUpPassword />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      {/* Actor profile (self / company profile) */}
      <Route path="/company-profile" element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />

      {/* Commercial partners > Actors */}
      <Route
        path="/actors/actual"
        element={<ProtectedRoute><ActorsList testId="actors-table" /></ProtectedRoute>}
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
        element={<ProtectedRoute><BeekeepersList fixedStatus="Achieved" title="Beekeepers — Achieved" testId="beekeepers-achieved-table" /></ProtectedRoute>}
      />
      <Route path="/beekeepers/:id" element={<ProtectedRoute><BeekeeperDetail /></ProtectedRoute>} />

      <Route path="/villages" element={<ProtectedRoute><VillagesList /></ProtectedRoute>} />
      <Route path="/connections" element={<ProtectedRoute><ConnectionsList /></ProtectedRoute>} />

      {/* Contracts */}
      <Route path="/contracts" element={<ProtectedRoute><ContractsList /></ProtectedRoute>} />
      <Route path="/contracts/new" element={<ProtectedRoute><ContractWizard /></ProtectedRoute>} />
      <Route path="/contracts/:id" element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />

      {/* Transactions */}
      <Route path="/transactions/received/new" element={<ProtectedRoute><ReceiveStockForm /></ProtectedRoute>} />
      <Route path="/transactions/processing/new" element={<ProtectedRoute><ProcessStockForm /></ProtectedRoute>} />
      <Route path="/transactions/send/new" element={<ProtectedRoute><SendStockForm /></ProtectedRoute>} />
      {/* /send/new is not a real page (canonical route is /transactions/send/new,
          matching /send's own action button) — alias it instead of silently
          falling through to the dashboard via the catch-all route below. */}
      <Route path="/send/new" element={<Navigate to="/transactions/send/new" replace />} />
      <Route path="/transactions/:direction/:id" element={<ProtectedRoute><TransactionDetail /></ProtectedRoute>} />
      {/* List page routes match the audit's actual top-level paths — Received
          lives at /transactions itself (not /transactions/received), Processing
          at /process, Send at /send. Create/detail sub-routes above are
          untouched for now — that's later-step scope. */}
      <Route
        path="/transactions"
        element={<ProtectedRoute><TransactionsList direction="Received" title="Received transactions" actionLabel="Receive stock" testId="transactions-received-table" /></ProtectedRoute>}
      />
      <Route
        path="/process"
        element={<ProtectedRoute><ProcessingTransactionsList /></ProtectedRoute>}
      />
      <Route
        path="/send"
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
        element={<ProtectedRoute><LossList /></ProtectedRoute>}
      />

      <Route path="/bulk-uploads" element={<ProtectedRoute><BulkUploads /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
      <Route path="/exchange-rates" element={<ProtectedRoute><ExchangeRates /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
      <Route path="/user-profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
      <Route path="/stocks/detail/:id" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
      <Route path="/activity-log" element={<ProtectedRoute><ActivityLog /></ProtectedRoute>} />
      <Route path="/beekeeper-charter" element={<ProtectedRoute><BeekeeperCharter /></ProtectedRoute>} />

      <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <UnsavedChangesProvider>
            <TourProvider>
              <Suspense fallback={<RouteLoadingFallback />}>
                <AppRoutes />
              </Suspense>
              <TourOverlay />
            </TourProvider>
          </UnsavedChangesProvider>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </div>
  );
}

export default App;
