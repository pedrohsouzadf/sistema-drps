import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, Plus, Trash2, LayoutGrid, List, X, Loader2 as Spinner, Users, Copy, FileText, Pencil, UserPlus, Upload } from 'lucide-react';
import { calculateResults } from '../../services/riskCalculator';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../../services/api';
import ImportSpreadsheetModal from '../../components/ImportSpreadsheetModal';

const AdminCompanies: React.FC = () => {
  const navigate = useNavigate();
  const { allCompanies, refreshData } = useAdmin();
  const { profile } = useAuth();
  const [viewType, setViewType] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [showModal, setShowModal] = useState(false);
  const [showColabModal, setShowColabModal] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState<any>(null);

  // Formulários
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCompany, setNewCompany] = useState({ nome: '', cnpj: '', total_funcionarios: '', slug: '' });
  const [editCompany, setEditCompany] = useState({ nome: '', cnpj: '', total_funcionarios: '', slug: '' });
  const [newColab, setNewColab] = useState({ email: '', full_name: '', password: '' });
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Colaboradores da empresa no modal
  const [colabProfiles, setColabProfiles] = useState<any[]>([]);
  const [colabLoading, setColabLoading] = useState(false);

  const filteredCompanies = allCompanies.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Busca colaboradores reais quando o modal abre
  useEffect(() => {
    if (!showColabModal) { setColabProfiles([]); return; }
    setColabLoading(true);
    apiGet<any[]>(`/profiles?empresa_id=${showColabModal.id}`)
      .then(data => { setColabProfiles(data || []); setColabLoading(false); })
      .catch(() => setColabLoading(false));
  }, [showColabModal]);

  const handleCopyLink = (slug: string) => {
    if (!slug) {
      alert('Esta empresa não possui um slug cadastrado. Por favor, edite o cadastro e adicione um slug para gerar o link.');
      return;
    }
    navigator.clipboard.writeText(`https://drps-platform.vercel.app/responder/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const openEditModal = (e: React.MouseEvent, company: any) => {
    e.stopPropagation();
    setEditCompany({
      nome: company.nome || '',
      cnpj: company.cnpj || '',
      total_funcionarios: company.total_funcionarios?.toString() || '',
      slug: company.slug || '',
    });
    setShowEditModal(company);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiPut(`/empresas/${showEditModal.id}`, {
        nome: editCompany.nome,
        cnpj: editCompany.cnpj || null,
        total_funcionarios: parseInt(editCompany.total_funcionarios) || null,
        slug: editCompany.slug || editCompany.nome.toLowerCase().replace(/ /g, '-'),
      });
      setShowEditModal(null); refreshData();
    } catch (e: any) { alert(e.message); }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    setDeleteError(null);
    try {
      await apiDelete(`/empresas/${showDeleteModal.id}`);
      setShowDeleteModal(null);
      setDeleteError(null);
      refreshData();
    } catch (e: any) {
      setDeleteError('Não foi possível excluir a empresa. Tente novamente.');
    }
    setIsSubmitting(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiPost('/empresas', {
        nome: newCompany.nome,
        cnpj: newCompany.cnpj || null,
        total_funcionarios: parseInt(newCompany.total_funcionarios) || null,
        slug: newCompany.slug || newCompany.nome.toLowerCase().replace(/ /g, '-'),
      });
      setShowModal(false);
      setNewCompany({ nome: '', cnpj: '', total_funcionarios: '', slug: '' });
      refreshData();
    } catch (e: any) { alert(e.message); }
    setIsSubmitting(false);
  };

  const handleAddColab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColab.password || newColab.password.length < 6) return alert('A senha deve ter pelo menos 6 caracteres.');
    setIsSubmitting(true);
    try {
      await apiPost('/api/create-user', {
        email: newColab.email,
        password: newColab.password,
        nome: newColab.full_name,
        tipo: 'colaborador',
        empresa_id: showColabModal.id,
      });
      setNewColab({ email: '', full_name: '', password: '' });
      const data = await apiGet<any[]>(`/profiles?empresa_id=${showColabModal.id}`);
      setColabProfiles(data || []);
    } catch (err: any) {
      alert(err.message);
    }
    setIsSubmitting(false);
  };

  const getScoreInfo = (responses: any[]) => {
    if (!responses || responses.length === 0) return { score: 0, label: 'N/A', color: '#94a3b8', risk: 'Baixo' };
    const answers = responses.map((r: any) => r.respostas);
    const results = calculateResults(answers);
    const avgScore = results.reduce((acc, curr) => acc + curr.average, 0) / results.length;
    if (avgScore <= 1.66) return { score: avgScore, label: 'Baixa', color: '#22c55e', risk: 'Baixo' };
    if (avgScore <= 2.32) return { score: avgScore, label: 'Média', color: '#f59e0b', risk: 'Médio' };
    return { score: avgScore, label: 'Alta', color: '#ef4444', risk: 'Crítico' };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h3 className="text-2xl font-serif text-slate-800">Seus Clientes</h3><p className="text-slate-500 text-sm font-medium">Gestão técnica de empresas e diagnóstico consolidado.</p></div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 mr-2">
            <button onClick={() => setViewType('grid')} className={`p-2 rounded-lg transition-all ${viewType === 'grid' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-400'}`}><LayoutGrid size={18} /></button>
            <button onClick={() => setViewType('table')} className={`p-2 rounded-lg transition-all ${viewType === 'table' ? 'bg-white shadow-sm text-brand-primary' : 'text-slate-400'}`}><List size={18} /></button>
          </div>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none w-64" /></div>
          <button onClick={() => setShowModal(true)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2"><Plus size={18} /> Novo Cliente</button>
        </div>
      </div>

      {viewType === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filteredCompanies.map(c => {
            const scoreInfo = getScoreInfo(c.respostas);
            return (
              <div key={c.id} onClick={() => navigate(`/admin/clientes/${c.id}/relatorio`)} className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden cursor-pointer">
                <div className="absolute top-0 left-0 h-1.5 w-full" style={{ backgroundColor: scoreInfo.color }}></div>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-2 items-center">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand-light group-hover:text-brand-primary transition-colors"><Building2 size={28} /></div>
                    <div className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: scoreInfo.color }}>RISCO {scoreInfo.risk}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => openEditModal(e, c)} className="p-2 rounded-xl text-slate-400 hover:text-brand-primary hover:bg-slate-50 transition-all" title="Editar"><Pencil size={15} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(c); }} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all" title="Excluir"><Trash2 size={15} /></button>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${c.respostas?.length > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{c.respostas?.length > 0 ? 'Ativa' : 'Aguardando'}</div>
                  </div>
                </div>
                <h4 className="text-xl font-serif text-slate-800 mb-1">{c.nome}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-6">
                  <span><Users size={14} className="inline-block -mt-px" /> {c.respostas?.length || 0} Respostas</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); handleCopyLink(c.slug); }} className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${copiedSlug !== null && copiedSlug === c.slug ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                    {copiedSlug !== null && copiedSlug === c.slug ? '✓ Copiado!' : '🔗 Link'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowImportModal(c); }} className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5">
                    <Upload size={13} /> Importar
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/clientes/${c.id}/relatorio`); }} className="w-full py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                    Relatório
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase"><tr><th className="px-6 py-4">Empresa</th><th className="px-6 py-4">Score</th><th className="px-6 py-4">Link Questionário</th><th className="px-6 py-4">Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCompanies.sort((a, b) => getScoreInfo(b.respostas).score - getScoreInfo(a.respostas).score).map(c => {
                const scoreInfo = getScoreInfo(c.respostas);
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-brand-primary">{c.nome}</td>
                    <td className="px-6 py-4"><span className="px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase" style={{ backgroundColor: scoreInfo.color }}>{scoreInfo.score > 0 ? scoreInfo.score.toFixed(2) : 'N/A'}</span></td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      <div className="flex items-center gap-2">/responder/{c.slug}<button onClick={() => handleCopyLink(c.slug)} className="text-brand-primary hover:text-brand-accent transition-colors"><Copy size={14} /></button></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3 items-center">
                        <button onClick={() => setShowColabModal(c)} className="text-slate-400 hover:text-brand-primary transition-colors" title="Colaboradores"><Users size={18} /></button>
                        <button onClick={() => setShowImportModal(c)} className="text-slate-400 hover:text-brand-primary transition-colors" title="Importar Planilha"><Upload size={18} /></button>
                        <button onClick={() => navigate(`/admin/clientes/${c.id}/relatorio`)} className="text-slate-400 hover:text-brand-primary transition-colors" title="Relatório"><FileText size={18} /></button>
                        <button onClick={(e) => openEditModal(e, c)} className="text-slate-400 hover:text-brand-primary transition-colors" title="Editar"><Pencil size={18} /></button>
                        <button onClick={() => setShowDeleteModal(c)} className="text-slate-400 hover:text-rose-500 transition-colors" title="Excluir"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova Empresa */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-serif text-slate-800">Novo Cliente</h3><button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-500"><X /></button></div>
            <form onSubmit={handleSave} className="space-y-4">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome da Empresa *</label><input required type="text" value={newCompany.nome} onChange={e => setNewCompany({ ...newCompany, nome: e.target.value })} placeholder="Ex: EMS Corp" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Slug (ex: ems-corp)</label><input type="text" value={newCompany.slug} onChange={e => setNewCompany({ ...newCompany, slug: e.target.value })} placeholder="ems-corp" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary" /></div>
              <button disabled={isSubmitting} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-4">{isSubmitting ? <Spinner className="animate-spin" /> : 'Cadastrar Empresa'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Empresa */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-serif text-slate-800">Editar Cliente</h3><button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:text-rose-500"><X /></button></div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome da Empresa *</label><input required type="text" value={editCompany.nome} onChange={e => setEditCompany({ ...editCompany, nome: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CNPJ</label><input type="text" value={editCompany.cnpj} onChange={e => setEditCompany({ ...editCompany, cnpj: e.target.value })} placeholder="00.000.000/0000-00" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Total de Funcionários</label><input type="number" value={editCompany.total_funcionarios} onChange={e => setEditCompany({ ...editCompany, total_funcionarios: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Slug</label><input type="text" value={editCompany.slug} onChange={e => setEditCompany({ ...editCompany, slug: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary" /></div>
              <button disabled={isSubmitting} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-4">{isSubmitting ? <Spinner className="animate-spin" /> : 'Salvar Alterações'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-serif text-slate-800">Excluir Cliente</h3>
              <button onClick={() => { setShowDeleteModal(null); setDeleteError(null); }} className="text-slate-400 hover:text-rose-500"><X /></button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-6 space-y-2">
              <p className="text-sm text-rose-800 font-semibold">
                Tem certeza que deseja excluir <span className="font-black">{showDeleteModal.nome}</span>?
              </p>
              <p className="text-xs text-rose-700 leading-relaxed">
                Todos os dados vinculados — respondentes, agendamentos e resultados do diagnóstico — serão permanentemente removidos. Essa ação não pode ser desfeita.
              </p>
            </div>

            {deleteError && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-xs text-amber-800 font-medium">
                ⚠ {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(null); setDeleteError(null); }}
                className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex-1 py-3.5 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? <Spinner className="animate-spin" size={16} /> : <><Trash2 size={16} /> Excluir permanentemente</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar Planilha */}
      {showImportModal && (
        <ImportSpreadsheetModal
          company={showImportModal}
          onClose={() => setShowImportModal(null)}
          onSuccess={() => { refreshData(); setShowImportModal(null); }}
        />
      )}

      {/* Modal Gerenciar Colaboradores */}
      {showColabModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <div><h3 className="text-2xl font-serif text-slate-800">Colaboradores</h3><p className="text-slate-500 text-xs font-bold uppercase">{showColabModal.nome}</p></div>
              <button onClick={() => setShowColabModal(null)} className="text-slate-400 hover:text-rose-500"><X /></button>
            </div>

            <form onSubmit={handleAddColab} className="space-y-3 mb-8">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adicionar Colaborador</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome</label><input required type="text" value={newColab.full_name} onChange={e => setNewColab({ ...newColab, full_name: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary text-sm" /></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label><input required type="email" value={newColab.email} onChange={e => setNewColab({ ...newColab, email: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary text-sm" /></div>
              </div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha Temporária</label><input required type="password" minLength={6} value={newColab.password} onChange={e => setNewColab({ ...newColab, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary text-sm" /></div>
              <button disabled={isSubmitting} className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm">
                {isSubmitting ? <Spinner className="animate-spin" size={16} /> : <><UserPlus size={16} /> Adicionar Colaborador</>}
              </button>
            </form>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-2">Colaboradores Vinculados ({colabProfiles.length})</p>
              {colabLoading ? (
                <div className="flex justify-center py-4"><Spinner className="animate-spin text-slate-300" size={20} /></div>
              ) : colabProfiles.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">Nenhum colaborador vinculado ainda.</p>
              ) : (
                colabProfiles.map(p => (
                  <div key={p.id} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-brand-primary font-bold text-xs border border-slate-100">
                        {p.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{p.full_name}</p>
                        <p className="text-[10px] text-slate-400">{p.email || '—'}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold bg-white px-2 py-0.5 rounded border border-slate-100 text-slate-400">ATIVO</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCompanies;
