import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { apiGet, apiPost, apiDelete } from '../../services/api';
import {
  Search, UserPlus, Building2, Shield, Trash2, X,
  Loader2 as Spinner, CheckCircle, AlertCircle, AlertTriangle,
} from 'lucide-react';

type Notification = { type: 'success' | 'error' | 'warning'; message: string };

const safeJson = async (res: Response): Promise<any> => {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return null;
  try { return await res.json(); } catch { return null; }
};

const AdminUsers: React.FC = () => {
  const { allCompanies } = useAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [emailsUnavailable, setEmailsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<Notification | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'colaborador',
    empresa_id: '',
  });

  const notify = (n: Notification) => {
    setNotification(n);
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const fetchProfiles = async () => {
    setLoading(true);

    const [profilesData, authData] = await Promise.all([
      apiGet<any[]>('/profiles').catch(() => []),
      apiGet<any>('/api/list-users').catch(() => ({ users: [], missingKey: true })),
    ]);

    const missingKey = !!authData?.missingKey;
    const emailMap = new Map<string, string>(
      (authData?.users || []).map((u: any) => [u.id, u.email])
    );
    setEmailsUnavailable(missingKey);
    setProfiles(
      (profilesData || []).map((p: any) => ({
        ...p,
        email: p.email || emailMap.get(p.id) || null,
      }))
    );
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiPost('/api/create-user', {
        email: formData.email,
        password: formData.password,
        nome: formData.full_name,
        tipo: formData.role,
        empresa_id: formData.empresa_id || undefined,
      });
      setShowModal(false);
      setFormData({ email: '', password: '', full_name: '', role: 'colaborador', empresa_id: '' });
      notify({ type: 'success', message: 'Usuário criado com sucesso.' });
      fetchProfiles();
    } catch (err: any) {
      notify({ type: 'error', message: err.message });
    }
    setIsSubmitting(false);
  };

  const handleDeleteUser = async (profileId: string) => {
    setIsDeleting(true);
    try {
      await apiDelete(`/api/delete-user/${profileId}`);
      setDeleteConfirm(null);
      notify({ type: 'success', message: 'Usuário removido com sucesso.' });
      fetchProfiles();
    } catch (err: any) {
      notify({ type: 'error', message: 'Erro ao remover: ' + err.message });
    }
    setIsDeleting(false);
  };

  const filteredProfiles = profiles.filter(p => {
    const term = searchTerm.toLowerCase();
    const name    = (p.nome || p.full_name || '').toLowerCase();
    const role    = (p.tipo || p.role || '').toLowerCase();
    const company = (p.empresa_nome || p.empresas?.nome || '').toLowerCase();
    return name.includes(term) || role.includes(term) || company.includes(term);
  });

  const roleLabel: Record<string, string> = {
    psicologo: 'Psicólogo',
    colaborador: 'Colaborador',
    empresa_gestor: 'Gestor de RH',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Notificação inline */}
      {notification && (
        <div className={`flex items-start gap-3 p-4 rounded-2xl border text-sm font-medium animate-in fade-in duration-300 ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          notification.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {notification.type === 'success' && <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />}
          {notification.type === 'warning' && <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />}
          {notification.type === 'error'   && <AlertCircle  size={16} className="text-rose-500   mt-0.5 shrink-0" />}
          <span className="flex-1">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="opacity-50 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-serif text-slate-800">Gestão de Usuários</h3>
          <p className="text-slate-500 text-sm font-medium">Controle quem acessa a plataforma e a quais empresas pertencem.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome ou papel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-primary transition-all w-64"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2"
          >
            <UserPlus size={18} /> Novo Usuário
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-5 rounded-[24px] flex gap-4">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm shrink-0">
          <Shield size={20} />
        </div>
        <div>
          <h4 className="font-bold text-amber-800 text-sm mb-1">Criação de usuários via painel</h4>
          <p className="text-amber-700/80 text-xs leading-relaxed">
            A criação de usuários é feita via AWS Cognito. Use o formulário abaixo ou crie diretamente pelo{' '}
            <strong>AWS Console → Cognito → User Pools → drps-users</strong>.
            Colaboradores também podem se auto-cadastrar em <strong>/login?role=colaborador</strong>.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="animate-spin text-brand-primary" size={40} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Papel</th>
                <th className="px-6 py-4">Empresa</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProfiles.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-brand-primary font-bold border border-slate-200 uppercase text-sm">
                        {(p.nome || p.full_name)?.[0] || '?'}
                      </div>
                      <p className="font-bold text-slate-800">{p.nome || p.full_name || 'Sem Nome'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-500">
                    {p.email ? (
                      p.email
                    ) : emailsUnavailable ? (
                      <span className="text-amber-500 text-xs font-medium italic">
                        Configure SUPABASE_SERVICE_ROLE_KEY
                      </span>
                    ) : (
                      <span className="text-slate-300 italic text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      p.tipo === 'psicologo' ? 'bg-indigo-50 text-indigo-600' : 'bg-brand-light text-brand-primary'
                    }`}>
                      {roleLabel[p.tipo] || p.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm">
                    {p.tipo === 'psicologo' ? (
                      <span className="text-slate-300 italic text-xs">Acesso Global</span>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <Building2 size={14} className="text-slate-400" />
                        {p.empresa_nome || allCompanies.find(c => c.id === p.empresa_id)?.nome || <span className="text-slate-300 italic text-xs">Não vinculada</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {deleteConfirm === p.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-rose-500 font-bold">Remover?</span>
                        <button
                          onClick={() => handleDeleteUser(p.id)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 disabled:opacity-50"
                        >
                          {isDeleting ? <Spinner size={12} className="animate-spin" /> : 'Sim'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(p.id)}
                        className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        title="Remover acesso"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Criar Usuário */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-serif text-slate-800">Novo Usuário</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input
                  required type="text" value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Ex: Maria da Silva"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                <input
                  required type="email" value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="maria@empresa.com"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha Temporária</label>
                <input
                  required type="password" minLength={6} value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Papel de Acesso</label>
                  <select
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none mt-1"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="empresa_gestor">Gestor de RH</option>
                    <option value="psicologo">Psicólogo (Admin)</option>
                  </select>
                </div>
                {formData.role !== 'psicologo' && (
                  <div className="animate-in fade-in duration-300">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Empresa</label>
                    <select
                      required
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none mt-1"
                      value={formData.empresa_id}
                      onChange={e => setFormData({ ...formData, empresa_id: e.target.value })}
                    >
                      <option value="">Selecione...</option>
                      {allCompanies.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <button
                disabled={isSubmitting}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-2 mt-2 hover:scale-[1.02] transition-all shadow-xl shadow-slate-200"
              >
                {isSubmitting ? <Spinner className="animate-spin" /> : 'Criar e Vincular Usuário'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
