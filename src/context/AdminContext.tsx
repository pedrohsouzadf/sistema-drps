import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiGet } from '../services/api';
import { useAuth } from './AuthContext';

interface AdminContextType {
  allCompanies: any[];
  allAppointments: any[];
  allLectures: any[];
  stats: any;
  loading: boolean;
  refreshData: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [allLectures, setAllLectures] = useState<any[]>([]);
  const [stats, setStats] = useState({ companies: 0, responses: 0, pendingAppts: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (role !== 'psicologo') return;

    const [comps, appts, lects, resps] = await Promise.all([
      apiGet<any[]>('/empresas').catch(() => []),
      apiGet<any[]>('/agendamentos').catch(() => []),
      apiGet<any[]>('/palestras').catch(() => []),
      apiGet<any[]>('/respostas').catch(() => []),
    ]);

    // Agrupa respostas por empresa_id e injeta em cada empresa
    const respByEmpresa: Record<string, any[]> = {};
    (resps || []).forEach((r: any) => {
      if (!respByEmpresa[r.empresa_id]) respByEmpresa[r.empresa_id] = [];
      respByEmpresa[r.empresa_id].push(r);
    });
    const compsEnriquecidas = (comps || []).map((c: any) => ({
      ...c,
      respostas: respByEmpresa[c.id] || [],
    }));

    setAllCompanies(compsEnriquecidas);
    setAllAppointments(appts || []);
    setAllLectures(lects || []);

    setStats({
      companies: compsEnriquecidas.length,
      responses: (resps || []).length,
      pendingAppts: (appts || []).filter((a: any) => a.status === 'pendente').length,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  return (
    <AdminContext.Provider value={{ allCompanies, allAppointments, allLectures, stats, loading, refreshData: fetchData }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
