import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
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
    
    const { data: comps } = await supabase.from('empresas').select('*, respostas(*)');
    const { data: appts, error: apptError } = await supabase
      .from('agendamentos')
      .select('*, empresas(nome), colaborador:profiles!colaborador_id(full_name)');

    let finalAppts = appts;
    if (apptError) {
      console.error('agendamentos join error (tentando sem join):', apptError.message);
      const { data: apptsFallback } = await supabase
        .from('agendamentos')
        .select('*, empresas(nome)');
      finalAppts = apptsFallback;
    }
    const { data: lects } = await supabase.from('palestras').select('*, empresas(nome)').order('criado_em', { ascending: false });
    
    setAllCompanies(comps || []);
    setAllAppointments(finalAppts || []);
    setAllLectures(lects || []);
    
    const totalRespostas = comps?.reduce((acc, c) => acc + (c.respostas?.length || 0), 0) || 0;
    setStats({
      companies: comps?.length || 0,
      responses: totalRespostas,
      pendingAppts: finalAppts?.filter(a => a.status === 'pendente').length || 0
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
