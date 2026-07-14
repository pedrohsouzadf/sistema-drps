import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiGet } from '../services/api';
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

    const [appts, lects] = await Promise.all([
      apiGet<any[]>(`/agendamentos?colaborador_id=${profile.id}`),
      apiGet<any[]>(`/palestras?empresa_id=${profile.empresa_id}`),
    ]);

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
