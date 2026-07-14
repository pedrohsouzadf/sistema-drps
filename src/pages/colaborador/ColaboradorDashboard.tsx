import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Video, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';

const ColaboradorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const slug = profile?.empresas?.slug;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <h3 className="text-3xl font-serif text-slate-800">Olá, {profile?.full_name?.split(' ')[0]}</h3>
        <p className="text-slate-500 text-lg">O que você gostaria de fazer hoje?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
        <DashboardActionCard
          title="Assistir Palestras"
          description="Acesse os conteúdos de desenvolvimento disponibilizados pela sua empresa."
          icon={<Video size={32} />}
          onClick={() => navigate('/colaborador/palestras')}
          color="brand"
        />

        <DashboardActionCard
          title="Minha Agenda"
          description="Visualize suas consultas agendadas ou solicite um novo atendimento."
          icon={<CalendarIcon size={32} />}
          onClick={() => navigate('/colaborador/agenda')}
          color="indigo"
        />
      </div>
    </div>
  );
};

const DashboardActionCard = ({ title, description, icon, onClick, color }: any) => {
  const colorStyles: any = {
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white',
    brand: 'bg-brand-light text-brand-primary group-hover:bg-brand-primary group-hover:text-white',
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white',
  };

  return (
    <button 
      onClick={onClick}
      className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group text-left flex flex-col h-full relative overflow-hidden"
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-colors duration-300 ${colorStyles[color]}`}>
        {icon}
      </div>
      <h4 className="text-2xl font-serif text-slate-800 mb-3">{title}</h4>
      <p className="text-slate-500 text-sm leading-relaxed flex-1">{description}</p>
      <div className="mt-8 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-800 transition-colors">Acessar</span>
        <ArrowRight className="text-slate-300 group-hover:text-slate-800 group-hover:translate-x-2 transition-all" />
      </div>
    </button>
  );
};

export default ColaboradorDashboard;