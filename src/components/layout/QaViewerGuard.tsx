
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useFMSAuth } from '@/context/FMSAuthContext';

const QA_VIEWER_ALLOWED = new Set([
  '/',
  '/receiving',
  '/bom',
  '/batch-sheet',
  '/traceability',
  '/suppliers',
]);

const RECEIVING_USER_ALLOWED = new Set([
  '/dashboard',
  '/receiving',
]);

export const QaViewerGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { fmsUser } = useFMSAuth();
  const location = useLocation();

  // Existing QA viewer permissions remain unchanged
  if (fmsUser?.role === 'qa_viewer' && !QA_VIEWER_ALLOWED.has(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  // New receiving user: Dashboard and Receiving Log only
  if (
    fmsUser?.role === 'receiving_user' &&
    !RECEIVING_USER_ALLOWED.has(location.pathname)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
