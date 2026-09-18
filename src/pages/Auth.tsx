import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { apiGet } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Loader2, ArrowLeft, Building2, User, CheckCircle, KeyRound, ShieldCheck } from 'lucide-react';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { signIn, signUp } = useAuth();

  useEffect(() => {
    if (roleParam === 'colaborador' && mode === 'register') {
      apiGet<any[]>('/empresas').then(data => setCompanies(data || []));
    }
  }, [roleParam, mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (e: any) {
      setError(e.message.includes('Incorrect') ? 'E-mail ou senha incorretos.' : e.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await resetPassword({ username: email });
      setMode('reset');
    } catch (e: any) {
      setError(e.message || 'Não foi possível enviar o código. Verifique o e-mail informado.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await confirmResetPassword({ username: email, confirmationCode: resetCode, newPassword });
      setSuccess('Senha alterada com sucesso! Faça login com sua nova senha.');
      setMode('login');
      setResetCode('');
      setNewPassword('');
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('Invalid verification code')) {
        setError('Código inválido. Verifique seu e-mail e tente novamente.');
      } else if (msg.includes('Password does not conform')) {
        setError('A senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula e número.');
      } else {
        setError(msg || 'Não foi possível redefinir a senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const empresaNome = companies.find(c => c.id === empresaId)?.nome;
      await signUp(email, password, fullName, empresaId, empresaNome);
      navigate('/');
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  // Full-screen success only for register flow
  if (success && mode === 'register') {
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

  // ── Forgot password: enter email ──────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-[40px] p-10 shadow-2xl border border-slate-100">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors mb-8 text-sm font-bold uppercase tracking-widest"
            >
              <ArrowLeft size={16} /> Voltar
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-brand-light rounded-3xl text-brand-primary mb-6 shadow-sm">
                <KeyRound size={28} />
              </div>
              <h2 className="text-3xl font-serif text-slate-800">Esqueci minha senha</h2>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Informe seu e-mail cadastrado. Enviaremos um código para redefinir sua senha.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm mb-6 border border-rose-100 text-center font-medium animate-in fade-in duration-300">
                {error}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200 disabled:opacity-50 mt-2"
              >
                {loading ? <Loader2 className="animate-spin" size={22} /> : 'Enviar código por e-mail'}
              </button>
            </form>

            <p className="mt-10 text-center text-xs text-slate-300 font-bold uppercase tracking-widest">
              DRPS · NR-01 Diagnóstico
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset password: enter code + new password ──────────────────────
  if (mode === 'reset') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-[40px] p-10 shadow-2xl border border-slate-100">
            <button
              onClick={() => { setMode('forgot'); setError(null); }}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors mb-8 text-sm font-bold uppercase tracking-widest"
            >
              <ArrowLeft size={16} /> Voltar
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-brand-light rounded-3xl text-brand-primary mb-6 shadow-sm">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-3xl font-serif text-slate-800">Nova senha</h2>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Verifique seu e-mail <span className="font-semibold text-slate-700">{email}</span> e insira o código recebido.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm mb-6 border border-rose-100 text-center font-medium animate-in fade-in duration-300">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Código de verificação</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input
                    type="text"
                    required
                    autoFocus
                    inputMode="numeric"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all tracking-[0.4em] text-lg font-bold text-center"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nova senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-brand-primary focus:bg-white transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-400 ml-1">Mínimo 8 caracteres, com maiúscula, minúscula e número</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200 disabled:opacity-50 mt-2"
              >
                {loading ? <Loader2 className="animate-spin" size={22} /> : 'Redefinir senha'}
              </button>
            </form>

            <p className="mt-10 text-center text-xs text-slate-300 font-bold uppercase tracking-widest">
              DRPS · NR-01 Diagnóstico
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Login / Register ───────────────────────────────────────────────
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
                onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Já tenho conta
              </button>
              <button
                onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
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

          {success && mode === 'login' && (
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl text-sm mb-6 border border-emerald-100 text-center font-medium flex items-center justify-center gap-2 animate-in fade-in duration-300">
              <CheckCircle size={16} /> {success}
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

          {mode === 'login' && (
            <div className="mt-5 text-center">
              <button
                onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }}
                className="text-xs text-slate-400 hover:text-brand-primary transition-colors underline underline-offset-2"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-slate-300 font-bold uppercase tracking-widest">
            DRPS · NR-01 Diagnóstico
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
