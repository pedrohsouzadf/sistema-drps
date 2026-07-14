import React from 'react';
import { Building2, Users, Clock, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';

const AdminOverview: React.FC = () => {
  const { stats, allAppointments } = useAdmin();
  const navigate = useNavigate();

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Empresas" value={stats.companies} icon={<Building2 />} trend="+2 este mês" color="indigo" />
        <StatCard label="Respostas Totais" value={stats.responses} icon={<Users />} trend="Público Geral" color="emerald" />
        <StatCard label="Consultas Pendentes" value={stats.pendingAppts} icon={<Clock />} trend="Ação Requerida" color="amber" />
      </div>

      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-serif text-slate-800">Próximos Compromissos</h3>
          <button onClick={() => navigate('/admin/agenda')} className="text-brand-medium text-xs font-bold hover:underline">Ver Agenda Completa</button>
        </div>
        <div className="space-y-4">
          {allAppointments
            .filter(a => a.status === 'confirmado' && a.data_hora && new Date(a.data_hora) > new Date())
            .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
            .slice(0, 4)
            .map(appt => (
              <div key={appt.id} className="group flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-white transition-all cursor-pointer" onClick={() => navigate('/admin/agenda')}>
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-brand-primary group-hover:scale-110 transition-transform"><CalendarIcon size={20}/></div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{appt.empresas?.nome}</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {new Date(appt.data_hora).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })} • {new Date(appt.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            ))}
          {allAppointments.filter(a => a.status === 'confirmado' && a.data_hora).length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum compromisso confirmado agendado.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, trend, color }: any) => {
  const colorClasses: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600'
  };
  return (
    <div className="bg-white p-7 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all">
      <div className={`w-12 h-12 ${colorClasses[color]} rounded-2xl flex items-center justify-center mb-5 shadow-sm`}>{icon}</div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-serif text-slate-800">{value}</p>
        <span className="text-[10px] font-bold text-slate-400">{trend}</span>
      </div>
    </div>
  );
};

export default AdminOverview;
