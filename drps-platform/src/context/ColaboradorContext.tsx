import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

interface ColaboradorContextType {
  appointments: any[];
  lectures: any[];
  loading: boolean;
  refreshData: () => Promise<void>;
}

const ColaboradorContext = createContext<ColaboradorContextType | undefined>(undefined);

export const ColaboradorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, profile } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (role !== 'colaborador' || !profile?.id) return;

    // Filtra apenas os agendamentos do colaborador logado
    const { data: appts } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('colaborador_id', profile.id);

    const { data: lects } = await supabase
      .from('palestras')
      .select('*')
      .eq('empresa_id', profile.empresa_id)
      .order('criado_em', { ascending: false });

    setAppointments(appts || []);
    setLectures(lects || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [role, profile]);

  return (
    <ColaboradorContext.Provider value={{ appointments, lectures, loading, refreshData: fetchData }}>
      {children}
    </ColaboradorContext.Provider>
  );
};

export const useColaborador = () => {
  const context = useContext(ColaboradorContext);
  if (context === undefined) {
    throw new Error('useColaborador must be used within a ColaboradorProvider');
  }
  return context;
};
