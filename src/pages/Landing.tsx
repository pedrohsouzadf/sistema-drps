import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Lock, User } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] p-12 max-w-lg w-full text-center shadow-2xl animate-in fade-in zoom-in duration-500 border border-slate-100">
        <div className="inline-block bg-brand-light text-brand-primary text-[11px] font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-6">
          NR-01 · Saúde Mental Organizacional
        </div>
        <h1 className="text-4xl text-brand-primary leading-tight mb-2 font-serif">
          Diagnóstico de Riscos Psicossociais
        </h1>
        <p className="text-sm text-brand-text2 mb-9">
          DRPS — Avaliação estruturada conforme a NR-01
        </p>
        
        <div className="h-px bg-slate-100 my-8"></div>
        
        <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-6">
          Como deseja acessar?
        </p>
        
        <div className="space-y-4">
          <button 
            onClick={() => navigate('/responder')}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200"
          >
            <ClipboardList size={22} />
            Responder Questionário
          </button>
          
          <button 
            onClick={() => navigate('/login?role=colaborador')}
            className="w-full py-5 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <User size={22} />
            Área do Colaborador
          </button>

          <button 
            onClick={() => navigate('/login?role=psicologo')}
            className="w-full py-5 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Lock size={22} />
            Painel da Empresa / Psicólogo
          </button>
        </div>
        
        <p className="mt-10 text-[10px] text-slate-300 uppercase tracking-widest font-bold">
          Tecnologia e Diagnóstico NR-01
        </p>
      </div>
    </div>
  );
};

export default Landing;
