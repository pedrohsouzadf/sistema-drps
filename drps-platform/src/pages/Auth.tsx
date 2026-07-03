import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Lock, Mail, Loader2, ArrowLeft, Building2, User, CheckCircle } from 'lucide-react';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    if (roleParam === 'colaborador' && mode === 'register') {
      supabase.from('empresas').select('id, nome').order('nome').then(({ data }) => {
        if (data) setCompanies(data);
      });
    }
  }, [roleParam, mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('E-mail ainda não confirmado. Verifique sua caixa de entrada e clique no link de confirmação.');
      } else if (error.message.toLowerCase().includes('invalid login credentials') || error.message.toLowerCase().includes('invalid credentials')) {
        setError('E-mail ou senha incorretos. Verifique seus dados e tente novamente.');
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Passa full_name, role e empresa_id via metadata — o trigger no banco cria o perfil automaticamente
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'colaborador',
          empresa_id: empresaId || '',
        },
      },
    });

    if (signUpError) {
      const msg = signUpError.message.includes('already registered')
        ? 'Este e-mail já possui cadastro. Faça login na aba "Já tenho conta".'
        : signUpError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError('Não foi possível criar o usuário. Tente novamente.');
      setLoading(false);
      return;
    }

    if (data.session) {
      navigate('/');
    } else {
      setSuccess('Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de fazer login.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl border border-slate-100 text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-serif text-slate-800 mb-3">Cadastro realizado!</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">{success}</p>
          <button
            onClick={() => { setSuccess(null); setMode('login'); }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:scale-[1.02] transition-all"
          >
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
        <div className="bg-white rounded-[40px] p-10 shadow-2xl border border-slate-100">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors mb-8 text-sm font-bold uppercase tracking-widest"
          >
            <ArrowLeft size={16} /> Voltar
          </button>

          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-brand-light rounded-3xl text-brand-primary mb-6 shadow-sm">
              <Lock size={28} />
            </div>
            <h2 className="text-3xl font-serif text-slate-800">
              {roleParam === 'psicologo' ? 'Portal do Psicólogo' : 'Área do Colaborador'}
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              {mode === 'login' ? 'Insira suas credenciais de acesso' : 'Crie sua conta para acessar os conteúdos'}
            </p>
          </div>

          {roleParam === 'colaborador' && (
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
              <button
                onClick={() => { setMode('login'); setError(null); }}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Já tenho conta
              </button>
              <button
                onClick={() => { setMode('register'); setError(null); }}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${mode === 'register' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Primeiro acesso
              </button>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm mb-6 border border-rose-100 text-center font-medium animate-in fade-in duration-300">
              {error}
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-5">
            {mode === 'register' && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Empresa</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <select
                      required
                      value={empresaId}
                      onChange={(e) => setEmpresaId(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all text-slate-800"
                    >
                      <option value="">Selecione sua empresa...</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all"
                />
              </div>
              {mode === 'register' && (
                <p className="text-[10px] text-slate-400 ml-1">Mínimo de 6 caracteres</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200 disabled:opacity-50 mt-2"
            >
              {loading
                ? <Loader2 className="animate-spin" size={22} />
                : mode === 'login' ? 'Entrar no Sistema' : 'Criar Conta e Entrar'
              }
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-slate-300 font-bold uppercase tracking-widest">
            DRPS · NR-01 Diagnóstico
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
