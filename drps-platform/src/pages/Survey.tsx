import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { QUESTIONS } from '../services/questions';
import { ChevronLeft, ChevronRight, CheckCircle, ClipboardList, ShieldCheck, HelpCircle, Loader2 as Spinner } from 'lucide-react';

interface Company {
  id: string;
  nome: string;
  slug?: string;
}

const Survey: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { slug } = useParams<{ slug?: string }>();
  const [step, setStep] = useState<'company' | 'info' | 'questions' | 'success'>('company');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [cargo, setCargo] = useState('');
  const [setor, setSetor] = useState('');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentTopicIdx, setCurrentTopicIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchingCompany, setFetchingCompany] = useState(!!slug);

  const topics = Array.from(new Set(QUESTIONS.map(q => q.topic)));

  useEffect(() => {
    const fetchInitialData = async () => {
      if (slug) {
        const { data, error } = await supabase
          .from('empresas')
          .select('id, nome')
          .eq('slug', slug)
          .single();
        
        if (data && !error) {
          setSelectedCompany(data.id);
          setStep('info');
        }
        setFetchingCompany(false);
      } else {
        const { data } = await supabase.from('empresas').select('id, nome').order('nome');
        if (data) setCompanies(data);
      }
    };
    fetchInitialData();
  }, [slug]);

  const handleNextStep = () => {
    if (step === 'company' && !selectedCompany) return alert('Selecione uma empresa para continuar.');
    if (step === 'info' && (!cargo || !setor)) return alert('Por favor, preencha seu cargo e setor.');
    
    if (step === 'company') setStep('info');
    else if (step === 'info') setStep('questions');
  };

  const handleNextTopic = async () => {
    const currentTopic = topics[currentTopicIdx];
    const topicQuestions = QUESTIONS.map((q, i) => ({ ...q, i })).filter(q => q.topic === currentTopic);
    const unanswered = topicQuestions.filter(q => answers[q.i] === undefined);

    if (unanswered.length > 0) return alert('Por favor, responda todas as perguntas deste bloco antes de prosseguir.');

    if (currentTopicIdx < topics.length - 1) {
      setCurrentTopicIdx(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      await handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    const responseArray = QUESTIONS.map((_, i) => answers[i]);
    
    const { error } = await supabase.from('respostas').insert({
      empresa_id: selectedCompany,
      cargo,
      setor,
      respostas: responseArray
    });

    setLoading(false);
    if (error) alert('Erro ao processar respostas: ' + error.message);
    else setStep('success');
  };

  const currentTopic = topics[currentTopicIdx];
  const topicQuestions = QUESTIONS.map((q, i) => ({ ...q, i })).filter(q => q.topic === currentTopic);
  const totalQuestions = QUESTIONS.length;
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  if (fetchingCompany) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <Spinner className="animate-spin text-brand-primary" size={40} />
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-[48px] p-16 text-center shadow-2xl border border-slate-100 animate-in zoom-in duration-500">
          <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <CheckCircle size={48} />
          </div>
          <h2 className="text-4xl font-serif text-slate-800 mb-4">Diagnóstico Concluído!</h2>
          <p className="text-slate-500 text-lg mb-10 leading-relaxed max-w-md mx-auto">
            Suas respostas foram integradas ao sistema de forma <strong className="text-brand-primary">100% anônima</strong>. Agradecemos sua contribuição.
          </p>
          <button 
            onClick={() => window.location.href = '/'} 
            className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 hover:scale-105 transition-all"
          >
            Finalizar Sessão
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12">
      <div className="max-w-3xl mx-auto w-full px-4">
        {/* Progresso Flutuante — só visível durante as perguntas */}
        <div className={`sticky top-4 z-50 mb-8 transition-all ${step === 'questions' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-5 shadow-lg flex items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                <span>Progresso do Diagnóstico</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-primary transition-all duration-700 ease-out shadow-[0_0_10px_rgba(29,78,107,0.3)]" 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
            <div className="shrink-0 text-right">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bloco</p>
               <p className="text-lg font-serif text-brand-primary leading-none">{currentTopicIdx + 1}/{topics.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
          {step === 'company' && (
            <div className="p-12 space-y-8 animate-in slide-in-from-bottom-8 duration-500">
              <div className="flex flex-col items-center text-center max-w-md mx-auto mb-10">
                 <div className="w-20 h-20 bg-brand-light rounded-3xl flex items-center justify-center text-brand-primary mb-6 shadow-sm">
                   <ClipboardList size={40} />
                 </div>
                 <h2 className="text-3xl font-serif text-slate-800 mb-2">Seja bem-vindo</h2>
                 <p className="text-slate-500 text-sm">Para iniciar a avaliação dos riscos psicossociais, selecione a sua empresa abaixo.</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Organização</label>
                <select 
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all text-slate-800 font-medium"
                >
                  <option value="">Selecione sua empresa...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => window.location.href = '/'} className="flex-1 py-5 text-slate-400 font-bold hover:text-slate-600 transition-colors">Sair</button>
                <button 
                  onClick={handleNextStep} 
                  className="flex-[2] py-5 bg-slate-900 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Próximo Passo
                </button>
              </div>
            </div>
          )}

          {step === 'info' && (
            <div className="p-12 space-y-10 animate-in slide-in-from-bottom-8 duration-500">
              <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-[32px] flex gap-5">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-800 text-sm mb-1">Diagnóstico Totalmente Anônimo</h4>
                  <p className="text-emerald-700/70 text-xs leading-relaxed">
                    Sua identidade está protegida. As informações de cargo e setor são utilizadas exclusivamente para análise estatística por grupos, impossibilitando a identificação individual.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cargo / Função</label>
                  <input 
                    type="text" 
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ex: Analista Sênior"
                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Departamento / Setor</label>
                  <input 
                    type="text" 
                    value={setor}
                    onChange={(e) => setSetor(e.target.value)}
                    placeholder="Ex: Recursos Humanos"
                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={() => slug ? (window.location.href = '/') : setStep('company')} className="flex-1 py-5 text-slate-400 font-bold hover:text-slate-600 transition-colors">Voltar</button>
                <button 
                  onClick={handleNextStep} 
                  className="flex-[2] py-5 bg-brand-primary text-white font-bold rounded-2xl shadow-xl shadow-brand-primary/20 hover:scale-[1.02] transition-all"
                >
                  Começar Avaliação
                </button>
              </div>
            </div>
          )}

          {step === 'questions' && (
            <div className="space-y-0 animate-in slide-in-from-bottom-8 duration-500">
              <div className="p-12 bg-slate-50 border-b border-slate-200">
                <h3 className="text-xs font-bold text-brand-primary uppercase tracking-[0.2em] mb-3">Tópico Atual</h3>
                <h2 className="text-3xl font-serif text-slate-800 leading-tight">
                  {currentTopic.replace(/^Tópico \d+ - /, '')}
                </h2>
              </div>

              <div className="p-12 space-y-12">
                {topicQuestions.map((q, i) => (
                  <div key={q.i} className="space-y-6">
                    <div className="flex items-start gap-4">
                      <span className="w-8 h-8 bg-brand-light text-brand-primary rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                        {i + 1}
                      </span>
                      <p className="text-xl text-slate-800 font-medium leading-relaxed">{q.text}</p>
                    </div>
                    
                    <div className="grid grid-cols-5 gap-3">
                      {[0, 1, 2, 3, 4].map(val => (
                        <label key={val} className="group cursor-pointer">
                          <input 
                            type="radio" 
                            name={`q${q.i}`} 
                            className="hidden" 
                            checked={answers[q.i] === val}
                            onChange={() => setAnswers(prev => ({ ...prev, [q.i]: val }))}
                          />
                          <div className={`relative flex flex-col items-center py-5 rounded-2xl transition-all duration-300 ${
                            answers[q.i] === val 
                              ? 'bg-slate-900 text-white shadow-xl -translate-y-1' 
                              : 'bg-slate-50 text-slate-400 hover:bg-white hover:border-slate-200 border border-transparent'
                          }`}>
                            <span className="text-lg font-bold mb-1">{val}</span>
                            <span className="text-[8px] font-bold uppercase tracking-tighter opacity-60">
                              {val === 0 ? 'Nunca' : val === 4 ? 'Sempre' : ''}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-200 flex gap-4">
                <button 
                  onClick={() => currentTopicIdx === 0 ? setStep('info') : setCurrentTopicIdx(prev => prev - 1)}
                  className="flex-1 py-5 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-all"
                >
                  <ChevronLeft size={20} /> Bloco Anterior
                </button>
                <button 
                  onClick={handleNextTopic}
                  disabled={loading}
                  className="flex-[2] py-5 bg-slate-900 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-slate-200 hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {loading ? <Spinner className="animate-spin" /> : currentTopicIdx === topics.length - 1 ? 'Finalizar Diagnóstico' : 'Próximo Bloco'} 
                  {!loading && <ChevronRight size={20} />}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Rodapé Survey */}
        <div className="mt-8 flex justify-center items-center gap-4 text-slate-400">
          <HelpCircle size={16} />
          <p className="text-[10px] font-bold uppercase tracking-widest">Apoio Técnico DRPS · Saúde Mental</p>
        </div>
      </div>
    </div>
  );
};

export default Survey;
