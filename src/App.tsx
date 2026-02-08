import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/login/LoginPage';
import ChapterFSDashboard from './pages/chapter/fs/ChapterFSDashboard';
import MemberLedger from './pages/chapter/fs/MemberLedger';
import RecordTransaction from './pages/chapter/fs/RecordTransaction';
import FSHandover from './pages/chapter/fs/FSHandover';
import ChapterFSReports from './pages/chapter/fs/ChapterFSReports';
import MemberRegister from './pages/chapter/fs/MemberRegister';
import PendingContributions from './pages/chapter/fs/PendingContributions';
import ChapterTreasurerDashboard from './pages/chapter/treasurer/ChapterTreasurerDashboard';
import Reconciliation from './pages/chapter/treasurer/Reconciliation';
import BankTransactions from './pages/chapter/treasurer/BankTransactions';
import ForwardToNational from './pages/chapter/treasurer/ForwardToNational';
import ChapterTreasurerReports from './pages/chapter/treasurer/ChapterTreasurerReports';

import NationalFSDashboard from './pages/national/fs/NationalFSDashboard';
import ChapterTransfers from './pages/national/fs/ChapterTransfers';
import NationalHandover from './pages/national/fs/NationalHandover';
import NationalFSReports from './pages/national/fs/NationalFSReports';

import NationalTreasurerDashboard from './pages/national/treasurer/NationalTreasurerDashboard';
import NationalReconciliation from './pages/national/treasurer/NationalReconciliation';
import NationalBankTransactions from './pages/national/treasurer/NationalBankTransactions';
import NationalTreasurerReports from './pages/national/treasurer/NationalTreasurerReports';

import NationalMemberLedger from './pages/national/NationalMemberLedger';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium">Authenticating...</p>
      </div>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role_code)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function RoleRedirect() {
  const { profile, loading } = useAuth();

  if (loading) return null;

  switch (profile?.role_code) {
    case 'CHAPTER_FS':
      return <Navigate to="/chapter/fs" replace />;
    case 'CHAPTER_TREASURER':
      return <Navigate to="/chapter/treasurer" replace />;
    case 'NATIONAL_FS':
      return <Navigate to="/national/fs" replace />;
    case 'NATIONAL_TREASURER':
      return <Navigate to="/national/treasurer" replace />;
    default:
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full p-8 bg-surface border border-border rounded-3xl text-center space-y-4">
            <h1 className="text-2xl font-black text-primary">Access Denied</h1>
            <p className="text-muted-foreground">Your account does not have a valid role assigned. Please contact the National Administrator.</p>
            <button
              onClick={() => window.location.href = '/login'}
              className="px-6 py-3 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-opacity"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
  }
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={
          <ProtectedRoute>
            <RoleRedirect />
          </ProtectedRoute>
        } />

        {/* Chapter FS Routes */}
        <Route path="/chapter/fs" element={
          <ProtectedRoute allowedRoles={['CHAPTER_FS']}>
            <ChapterFSDashboard />
          </ProtectedRoute>
        } />
        <Route path="/chapter/fs/ledger" element={
          <ProtectedRoute allowedRoles={['CHAPTER_FS']}>
            <MemberLedger />
          </ProtectedRoute>
        } />
        <Route path="/chapter/fs/record" element={
          <ProtectedRoute allowedRoles={['CHAPTER_FS']}>
            <RecordTransaction />
          </ProtectedRoute>
        } />
        <Route path="/chapter/fs/handover" element={
          <ProtectedRoute allowedRoles={['CHAPTER_FS']}>
            <FSHandover />
          </ProtectedRoute>
        } />
        <Route path="/chapter/fs/members" element={
          <ProtectedRoute allowedRoles={['CHAPTER_FS']}>
            <MemberRegister />
          </ProtectedRoute>
        } />
        <Route path="/chapter/fs/reports" element={
          <ProtectedRoute allowedRoles={['CHAPTER_FS']}>
            <ChapterFSReports />
          </ProtectedRoute>
        } />
        <Route path="/chapter/fs/pending/:purposeId" element={
          <ProtectedRoute allowedRoles={['CHAPTER_FS']}>
            <PendingContributions />
          </ProtectedRoute>
        } />

        {/* Chapter Treasurer Routes */}
        <Route path="/chapter/treasurer" element={
          <ProtectedRoute allowedRoles={['CHAPTER_TREASURER']}>
            <ChapterTreasurerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/chapter/treasurer/reconciliation" element={
          <ProtectedRoute allowedRoles={['CHAPTER_TREASURER']}>
            <Reconciliation />
          </ProtectedRoute>
        } />
        <Route path="/chapter/treasurer/bank" element={
          <ProtectedRoute allowedRoles={['CHAPTER_TREASURER']}>
            <BankTransactions />
          </ProtectedRoute>
        } />
        <Route path="/chapter/treasurer/forward" element={
          <ProtectedRoute allowedRoles={['CHAPTER_TREASURER']}>
            <ForwardToNational />
          </ProtectedRoute>
        } />
        <Route path="/chapter/treasurer/reports" element={
          <ProtectedRoute allowedRoles={['CHAPTER_TREASURER']}>
            <ChapterTreasurerReports />
          </ProtectedRoute>
        } />

        {/* National FS Routes */}
        <Route path="/national/fs" element={
          <ProtectedRoute allowedRoles={['NATIONAL_FS']}>
            <NationalFSDashboard />
          </ProtectedRoute>
        } />
        <Route path="/national/fs/transfers" element={
          <ProtectedRoute allowedRoles={['NATIONAL_FS']}>
            <ChapterTransfers />
          </ProtectedRoute>
        } />
        <Route path="/national/fs/handover" element={
          <ProtectedRoute allowedRoles={['NATIONAL_FS']}>
            <NationalHandover />
          </ProtectedRoute>
        } />
        <Route path="/national/fs/reports" element={
          <ProtectedRoute allowedRoles={['NATIONAL_FS']}>
            <NationalFSReports />
          </ProtectedRoute>
        } />
        <Route path="/national/fs/ledger" element={
          <ProtectedRoute allowedRoles={['NATIONAL_FS']}>
            <NationalMemberLedger />
          </ProtectedRoute>
        } />

        {/* National Treasurer Routes */}
        <Route path="/national/treasurer" element={
          <ProtectedRoute allowedRoles={['NATIONAL_TREASURER']}>
            <NationalTreasurerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/national/treasurer/reconciliation" element={
          <ProtectedRoute allowedRoles={['NATIONAL_TREASURER']}>
            <NationalReconciliation />
          </ProtectedRoute>
        } />
        <Route path="/national/treasurer/bank" element={
          <ProtectedRoute allowedRoles={['NATIONAL_TREASURER']}>
            <NationalBankTransactions />
          </ProtectedRoute>
        } />
        <Route path="/national/treasurer/reports" element={
          <ProtectedRoute allowedRoles={['NATIONAL_TREASURER']}>
            <NationalTreasurerReports />
          </ProtectedRoute>
        } />
        <Route path="/national/treasurer/ledger" element={
          <ProtectedRoute allowedRoles={['NATIONAL_TREASURER']}>
            <NationalMemberLedger />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
