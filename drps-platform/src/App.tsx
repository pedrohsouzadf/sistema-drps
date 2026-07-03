import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminProvider } from './context/AdminContext';
import { ColaboradorProvider } from './context/ColaboradorContext';
import { AdminGuard, ColaboradorGuard } from './components/RouteGuards';

import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Survey from './pages/Survey';

import AdminLayout from './layouts/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminCompanyReport from './pages/admin/AdminCompanyReport';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSchedule from './pages/admin/AdminSchedule';
import AdminContent from './pages/admin/AdminContent';

import ColaboradorLayout from './layouts/ColaboradorLayout';
import ColaboradorDashboard from './pages/colaborador/ColaboradorDashboard';
import ColaboradorSchedule from './pages/colaborador/ColaboradorSchedule';
import ColaboradorContent from './pages/colaborador/ColaboradorContent';

const AuthRedirect = () => {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role === 'psicologo') return <Navigate to="/admin" replace />;
  if (role === 'colaborador') return <Navigate to="/colaborador" replace />;
  return <Landing />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuthRedirect />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/responder" element={<Survey onBack={() => window.location.href = '/'} />} />
          <Route path="/responder/:slug" element={<Survey onBack={() => window.location.href = '/'} />} />

          {/* Rotas Administrativas */}
          <Route element={<AdminGuard />}>
            <Route element={<AdminProvider><AdminLayout /></AdminProvider>}>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/clientes" element={<AdminCompanies />} />
              <Route path="/admin/clientes/:empresaId/relatorio" element={<AdminCompanyReport />} />
              <Route path="/admin/usuarios" element={<AdminUsers />} />
              <Route path="/admin/agenda" element={<AdminSchedule />} />
              <Route path="/admin/palestras" element={<AdminContent />} />
            </Route>
          </Route>

          {/* Rotas do Colaborador */}
          <Route element={<ColaboradorGuard />}>
            <Route element={<ColaboradorProvider><ColaboradorLayout /></ColaboradorProvider>}>
              <Route path="/colaborador" element={<ColaboradorDashboard />} />
              <Route path="/colaborador/agenda" element={<ColaboradorSchedule />} />
              <Route path="/colaborador/palestras" element={<ColaboradorContent />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
