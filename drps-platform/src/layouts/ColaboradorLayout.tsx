import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar as CalendarIcon, PlayCircle, LogOut, Activity, Menu, X 
} from 'lucide-react';

const ColaboradorLayout: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
  };

  const menuItems = [
    { icon: <Activity size={20}/>, label: "Início", path: "/colaborador" },
    { icon: <CalendarIcon size={20}/>, label: "Minha Agenda", path: "/colaborador/agenda" },
    { icon: <PlayCircle size={20}/>, label: "Palestras", path: "/colaborador/palestras" },
  ];

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans relative">
      {/* Overlay Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col shrink-0 transition-transform duration-300 lg:static lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center shrink-0 shadow-lg">
              <Activity size={24} className="text-white" />
            </div>
            <div className="hidden lg:block text-orange-500 font-bold italic">DRPS</div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-white/40 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="">
            <p className="text-xs font-bold text-white uppercase tracking-tighter truncate">{profile?.full_name}</p>
            <span className="inline-block bg-brand-primary text-[9px] px-2 py-0.5 rounded-full font-bold text-white/80 uppercase mt-1 tracking-widest">
              {profile?.empresas?.nome || 'Colaborador'}
            </span>
          </div>
        </div>

        <div className="px-4 py-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Menu</div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button 
              key={item.path}
              onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 ${location.pathname === item.path ? 'bg-white/10 text-white shadow-xl scale-[1.02]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon} <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold">
            <LogOut size={18} /> <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-xl"
            >
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Área do Colaborador</h2>
              <h3 className="text-xl font-serif text-slate-800 capitalize truncate">
                {menuItems.find(i => i.path === location.pathname)?.label || 'Bem-vindo'}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-right hidden md:block">
               <p className="text-sm font-bold text-slate-800">{profile?.full_name}</p>
               <p className="text-xs text-brand-medium font-medium">Colaborador</p>
             </div>
             <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center text-brand-primary font-bold shadow-inner relative group cursor-pointer" onClick={handleLogout}>
               {profile?.full_name?.[0]}
               <div className="absolute -bottom-8 right-0 bg-slate-900 text-white text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                 Sair do Sistema
               </div>
             </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ColaboradorLayout;
