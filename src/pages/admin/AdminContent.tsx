import React, { useState } from 'react';
import { Plus, Video, PlayCircle, ExternalLink, Trash2, X, Loader2 as Spinner, Link, Upload, Pencil } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { apiPost, apiPut, apiDelete } from '../../services/api';

const AdminContent: React.FC = () => {
  const { allLectures, allCompanies, refreshData } = useAdmin();
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [newLecture, setNewLecture] = useState({ empresa_id: '', titulo: '', descricao: '', url_video: '', tipo_video: 'url' });
  const [editLecture, setEditLecture] = useState({ titulo: '', descricao: '', url_video: '' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    let finalUrl = newLecture.url_video;

    if (newLecture.tipo_video === 'upload' && videoFile) {
      const { url, publicUrl } = await apiPost<any>('/upload-url', {
        empresa_id: newLecture.empresa_id,
        fileName: videoFile.name,
        contentType: videoFile.type,
      });
      await fetch(url, { method: 'PUT', body: videoFile, headers: { 'Content-Type': videoFile.type } });
      finalUrl = publicUrl;
    }

    try {
      await apiPost('/palestras', {
        empresa_id: newLecture.empresa_id,
        titulo: newLecture.titulo,
        descricao: newLecture.descricao,
        url_video: finalUrl,
      });
      setShowModal(false);
      setNewLecture({ empresa_id: '', titulo: '', descricao: '', url_video: '', tipo_video: 'url' });
      setVideoFile(null);
      refreshData();
    } catch (e: any) { alert(e.message); }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await apiDelete(`/palestras/${showDeleteModal.id}`);
      setShowDeleteModal(null); refreshData();
    } catch (e: any) { alert(e.message); }
    setIsSubmitting(false);
  };

  const openEditModal = (lect: any) => {
    setEditLecture({ titulo: lect.titulo || '', descricao: lect.descricao || '', url_video: lect.url_video || '' });
    setShowEditModal(lect);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiPut(`/palestras/${showEditModal.id}`, editLecture);
      setShowEditModal(null); refreshData();
    } catch (e: any) { alert(e.message); }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-serif text-slate-800">Hub de Conteúdo Multimídia</h3>
          <p className="text-slate-500 text-sm font-medium">Gestão de gravações e treinamentos por empresa.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-brand-accent text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-accent/20 hover:scale-105 transition-all flex items-center gap-2">
          <Plus size={20} /> Nova Palestra
        </button>
      </div>

      {allLectures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-700">
          <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner"><Video size={48} /></div>
          <h3 className="text-2xl font-serif text-slate-800 mb-2">Nenhuma palestra cadastrada ainda</h3>
          <p className="text-slate-400 text-sm max-w-sm text-center mb-8 font-medium">Adicione conteúdos exclusivos para desenvolvimento organizacional dos seus clientes.</p>
          <button onClick={() => setShowModal(true)} className="bg-brand-accent text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-brand-accent/20 hover:scale-105 transition-all flex items-center gap-2">
            <Plus size={20} /> Nova Palestra
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allLectures.map(lect => (
            <div key={lect.id} className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all group relative border-b-4 border-b-brand-accent">
              <div className="aspect-video bg-slate-900 flex items-center justify-center relative overflow-hidden">
                <Video size={56} className="text-white/10 group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
                <button className="absolute inset-0 m-auto w-16 h-16 bg-brand-accent text-white rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                  <PlayCircle size={32} fill="currentColor" />
                </button>
                <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest">{lect.empresa_nome}</div>
                <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => openEditModal(lect)} className="w-8 h-8 bg-white/90 text-slate-700 hover:bg-white rounded-full flex items-center justify-center shadow" title="Editar">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setShowDeleteModal(lect)} className="w-8 h-8 bg-rose-500/90 hover:bg-rose-500 text-white rounded-full flex items-center justify-center shadow" title="Excluir">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="p-7">
                <h4 className="font-serif text-slate-800 text-xl leading-tight group-hover:text-brand-accent transition-colors mb-3">{lect.titulo}</h4>
                <p className="text-slate-500 text-sm line-clamp-2 mb-6 leading-relaxed">{lect.descricao || 'Conteúdo exclusivo de desenvolvimento.'}</p>
                <div className="flex items-center justify-between pt-5 border-t border-slate-50">
                  <span className="bg-slate-50 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">Saúde Mental</span>
                  <a href={lect.url_video} target="_blank" className="bg-brand-light text-brand-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-primary hover:text-white transition-all flex items-center gap-2">
                    Ver palestra <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Palestra */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-serif text-slate-800">Nova Palestra</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-500"><X /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Empresa Destino</label>
                <select required value={newLecture.empresa_id} onChange={e => setNewLecture({ ...newLecture, empresa_id: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1">
                  <option value="">Selecione...</option>
                  {allCompanies.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Título</label>
                <input required type="text" value={newLecture.titulo} onChange={e => setNewLecture({ ...newLecture, titulo: e.target.value })} placeholder="Ex: Gestão do Estresse no Trabalho" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <input type="text" value={newLecture.descricao} onChange={e => setNewLecture({ ...newLecture, descricao: e.target.value })} placeholder="Breve descrição do conteúdo..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-2">Tipo de Vídeo</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewLecture({ ...newLecture, tipo_video: 'url', url_video: '' })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${newLecture.tipo_video === 'url' ? 'border-brand-primary bg-brand-light text-brand-primary' : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'}`}
                  >
                    <Link size={20} />
                    <span className="text-xs font-bold">Link Externo</span>
                    <span className="text-[10px] text-center leading-tight opacity-70">YouTube, Vimeo...</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewLecture({ ...newLecture, tipo_video: 'upload', url_video: '' }); setVideoFile(null); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${newLecture.tipo_video === 'upload' ? 'border-brand-primary bg-brand-light text-brand-primary' : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'}`}
                  >
                    <Upload size={20} />
                    <span className="text-xs font-bold">Upload de Arquivo</span>
                    <span className="text-[10px] text-center leading-tight opacity-70">MP4, MOV, AVI...</span>
                  </button>
                </div>
              </div>
              {newLecture.tipo_video === 'url' ? (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">URL do Vídeo</label>
                  <input type="url" value={newLecture.url_video} onChange={e => setNewLecture({ ...newLecture, url_video: e.target.value })} placeholder="https://youtube.com/watch?v=..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1" />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-1">Arquivo de Vídeo</label>
                  <label className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${videoFile ? 'border-brand-primary bg-brand-light' : 'border-slate-200 bg-slate-50 hover:border-brand-primary hover:bg-brand-light'}`}>
                    <input type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
                    <Upload size={24} className={videoFile ? 'text-brand-primary' : 'text-slate-300'} />
                    {videoFile ? (
                      <div className="text-center">
                        <p className="text-sm font-bold text-brand-primary">{videoFile.name}</p>
                        <p className="text-[10px] text-slate-400">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-500">Clique para selecionar</p>
                        <p className="text-[10px] text-slate-400">MP4, MOV, AVI — máx. recomendado 500MB</p>
                      </div>
                    )}
                  </label>
                </div>
              )}
              <button disabled={isSubmitting} className="w-full bg-brand-accent text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-4">
                {isSubmitting ? <Spinner className="animate-spin" /> : 'Publicar Conteúdo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Palestra */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-serif text-slate-800">Editar Palestra</h3>
              <button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:text-rose-500"><X /></button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Título *</label>
                <input required type="text" value={editLecture.titulo} onChange={e => setEditLecture({ ...editLecture, titulo: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <input type="text" value={editLecture.descricao} onChange={e => setEditLecture({ ...editLecture, descricao: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">URL do Vídeo</label>
                <input type="url" value={editLecture.url_video} onChange={e => setEditLecture({ ...editLecture, url_video: e.target.value })} placeholder="https://..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1" />
              </div>
              <button disabled={isSubmitting} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-2">
                {isSubmitting ? <Spinner className="animate-spin" /> : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-serif text-slate-800">Excluir Palestra</h3>
              <button onClick={() => setShowDeleteModal(null)} className="text-slate-400 hover:text-rose-500"><X /></button>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-8">
              <p className="text-sm text-rose-700 font-medium">
                Tem certeza que deseja excluir <span className="font-bold">"{showDeleteModal.titulo}"</span>? Esta ação é irreversível.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(null)} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={handleDelete} disabled={isSubmitting} className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all flex items-center justify-center gap-2">
                {isSubmitting ? <Spinner className="animate-spin" size={16} /> : <><Trash2 size={16} /> Excluir</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminContent;
