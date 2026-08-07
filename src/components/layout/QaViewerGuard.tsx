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

export const QaViewerGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { fmsUser } = useFMSAuth();
  const location = useLocation();

  if (fmsUser?.role === 'qa_viewer' && !QA_VIEWER_ALLOWED.has(location.pathname)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};
