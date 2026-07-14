import React from 'react';
import { Video, PlayCircle, Clock } from 'lucide-react';
import { useColaborador } from '../../context/ColaboradorContext';

const ColaboradorContent: React.FC = () => {
  const { lectures } = useColaborador();
  
  if (lectures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Video size={48} />
        </div>
        <h3 className="text-2xl font-serif text-slate-800 mb-2">Nenhuma palestra disponível</h3>
        <p className="text-slate-400 text-sm max-w-sm text-center font-medium">
          Sua empresa ainda não disponibilizou vídeos gravados. Assim que houver novo conteúdo, ele aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h3 className="text-2xl font-serif text-slate-800">Sua Videoteca Exclusiva</h3>
        <p className="text-slate-500 text-sm font-medium">Assista aos treinamentos e palestras realizados para sua organização.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {lectures.map(lect => (
          <div key={lect.id} className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all group relative border-b-8 border-b-brand-accent">
            <div className="aspect-video bg-slate-900 flex items-center justify-center relative overflow-hidden">
              <Video size={56} className="text-white/10 group-hover:scale-110 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
              <button
                onClick={() => lect.url_video && window.open(lect.url_video, '_blank')}
                className="absolute inset-0 m-auto w-20 h-20 bg-brand-accent text-white rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
              >
                <PlayCircle size={40} fill="currentColor" />
              </button>
              {lect.empresa_nome && (
                <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                  {lect.empresa_nome}
                </div>
              )}
              <div className="absolute bottom-4 left-6 flex items-center gap-2 text-white/60">
                 <Clock size={14} />
                 <span className="text-[10px] font-bold uppercase tracking-widest">45 min</span>
              </div>
            </div>
            
            <div className="p-8">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-serif text-slate-800 text-2xl leading-tight group-hover:text-brand-accent transition-colors">{lect.titulo}</h4>
              </div>
              <p className="text-slate-500 text-sm line-clamp-3 mb-8 leading-relaxed font-medium">
                {lect.descricao || 'Conteúdo exclusivo focado no desenvolvimento humano e bem-estar organizacional da sua equipe.'}
              </p>
              
              <a 
                href={lect.url_video} 
                target="_blank" 
                className="w-full py-4 bg-slate-50 text-slate-800 rounded-[20px] font-bold text-sm hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-3"
              >
                Assistir Agora <PlayCircle size={18} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColaboradorContent;
