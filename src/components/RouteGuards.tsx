import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AdminGuard: React.FC = () => {
  const { user, role, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (role !== 'psicologo') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export const ColaboradorGuard: React.FC = () => {
  const { user, role, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (role !== 'colaborador') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
