import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AdminGuard: React.FC = () => {
  const { session, role, loading } = useAuth();

  if (loading) return null;
  
  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (role !== 'psicologo') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export const ColaboradorGuard: React.FC = () => {
  const { session, role, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (role !== 'colaborador') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
