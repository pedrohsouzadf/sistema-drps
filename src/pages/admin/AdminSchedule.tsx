import React, { useState } from 'react';
import { Clock, ExternalLink, Video, X, CheckCircle2, Loader2 as Spinner, Calendar as CalendarIcon, MapPin, User, AlertCircle, Link, XCircle, Trash2 } from 'lucide-react';
import { apiPatch, apiDelete } from '../../services/api';
import { useAdmin } from '../../context/AdminContext';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'confirmado': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'cancelado':  return 'bg-rose-50 text-rose-600 border-rose-200';
    case 'realizado':  return 'bg-slate-100 text-slate-500 border-slate-200';
    default:           return 'bg-amber-50 text-amber-600 border-amber-200';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmado': return '#10b981';
    case 'cancelado':  return '#f43f5e';
    case 'realizado':  return '#64748b';
    default:           return '#f59e0b';
  }
};

const formatSlot = (slot: string) => {
  const d = new Date(slot);
  return {
    data: d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
};

const AdminSchedule: React.FC = () => {
  const { allAppointments, refreshData } = useAdmin();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [tempLink, setTempLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedSlots, setSelectedSlots] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal de link: pergunta se quer adicionar agora ou depois
  const [linkModal, setLinkModal] = useState<{ appt: any; data_hora: string } | null>(null);
  const [linkStep, setLinkStep] = useState<'ask' | 'input'>('ask');
  const [linkValue, setLinkValue] = useState('');

  const pendingRequests       = allAppointments.filter(a => a.status === 'pendente');
  // Cancelados que tinham data_hora confirmada = foram desmarcados pelo colaborador
  const cancelledByColab      = allAppointments.filter(a => a.status === 'cancelado' && a.data_hora);
  const scheduledAppointments = allAppointments.filter(a => a.status === 'confirmado' || a.status === 'realizado');
  const dayAppointments       = scheduledAppointments.filter(
    appt => appt.data_hora && isSameDay(new Date(appt.data_hora), selectedDate)
  );

  const handleConfirm = async (_apptId: string, data_hora: string, link_reuniao: string) => {
    setIsSubmitting(true);
    const appt = allAppointments.find(a => a.id === _apptId);
    try {
      await apiPatch('/agendamentos/confirmar', {
        colaborador_id: appt?.colaborador_id,
        data_hora,
        status: 'confirmado',
        link_reuniao: link_reuniao || null,
      });
      setLinkModal(null);
      setLinkValue('');
      setLinkStep('ask');
      setSelectedSlots(prev => { const s = { ...prev }; delete s[_apptId]; return s; });
      refreshData();
    } catch (e) { console.error(e); }
    setIsSubmitting(false);
  };

  const openLinkModal = (appt: any) => {
    // Novo fluxo: data_hora já definida pelo colaborador; antigo: selecionada pelo psicólogo
    setLinkModal({ appt, data_hora: appt.data_hora || selectedSlots[appt.id] });
    setLinkStep('ask');
    setLinkValue('');
  };

  const handleCancel = async (apptId: string) => {
    const appt = allAppointments.find(a => a.id === apptId);
    await apiPatch('/agendamentos/cancelar', { colaborador_id: appt?.colaborador_id, data_hora: appt?.data_hora });
    setSelectedSlots(prev => { const s = { ...prev }; delete s[apptId]; return s; });
    refreshData();
  };

  const handleDelete = async (apptId: string) => {
    setIsDeleting(true);
    const appt = allAppointments.find(a => a.id === apptId);
    await apiDelete('/agendamentos', { colaborador_id: appt?.colaborador_id, data_hora: appt?.data_hora });
    setIsDeleting(false);
    setDeleteConfirm(null);
    refreshData();
  };

  const handleUpdateLink = async (apptId: string) => {
    const appt = allAppointments.find(a => a.id === apptId);
    await apiPatch('/agendamentos/link', { colaborador_id: appt?.colaborador_id, data_hora: appt?.data_hora, link_reuniao: tempLink });
    setEditingLink(null);
    refreshData();
  };

  const tileContent = ({ date, view }: any) => {
    if (view === 'month') {
      const apptsOnDay = scheduledAppointments.filter(
        appt => appt.data_hora && isSameDay(new Date(appt.data_hora), date)
      );
      if (apptsOnDay.length > 0) {
        return (
          <div className="flex gap-1 justify-center mt-1">
            {apptsOnDay.map((appt, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusColor(appt.status) }} />
            ))}
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h3 className="text-2xl font-serif text-slate-800">Agenda Global de Consultas</h3>
        <p className="text-slate-500 text-sm font-medium">Gerencie solicitações e consultas confirmadas.</p>
      </div>

      {/* Solicitações Pendentes */}
      {pendingRequests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-xl w-fit">
            <AlertCircle size={16} />
            <span className="text-xs font-black uppercase tracking-widest">
              {pendingRequests.length} Solicitação{pendingRequests.length > 1 ? 'ões' : ''} Pendente{pendingRequests.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {pendingRequests.map(appt => {
              const selected = selectedSlots[appt.id];
              const slots: string[] = appt.preferencias_horario || [];

              return (
                <div key={appt.id} className="bg-white rounded-[24px] border-2 border-amber-100 p-6 flex flex-col gap-4">
                  {/* Cabeçalho */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-800 capitalize">{appt.tipo.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{appt.empresas?.nome}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600">
                      Pendente
                    </span>
                  </div>

                  {(appt.colaborador_nome || appt.colaborador?.full_name) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User size={14} className="text-slate-400 shrink-0" />
                      <span className="font-medium">{appt.colaborador_nome || appt.colaborador?.full_name}</span>
                    </div>
                  )}
                  {appt.contato && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span className="text-slate-400 text-xs">📱</span>
                      <span className="font-medium text-xs">{appt.contato}</span>
                    </div>
                  )}

                  {appt.observacoes && (
                    <p className="text-xs text-slate-400 italic">"{appt.observacoes}"</p>
                  )}

                  {/* Horário — novo fluxo: já definido pelo colaborador */}
                  {appt.data_hora ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Horário solicitado
                      </p>
                      <div className="p-3 rounded-xl border-2 border-brand-primary bg-brand-light">
                        <p className="font-bold text-sm text-brand-primary capitalize leading-tight">
                          {formatSlot(appt.data_hora).data}
                        </p>
                        <p className="text-xs mt-0.5 text-brand-primary/70">
                          às {formatSlot(appt.data_hora).hora}
                        </p>
                      </div>
                    </div>
                  ) : slots.length > 0 ? (
                    /* Fluxo antigo: colaborador enviou preferências, psicólogo escolhe uma */
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Selecione um horário
                      </p>
                      {slots.map((slot, i) => {
                        const { data, hora } = formatSlot(slot);
                        const isSelected = selected === slot;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedSlots(prev => ({ ...prev, [appt.id]: slot }))}
                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                              isSelected
                                ? 'border-brand-primary bg-brand-light'
                                : 'border-slate-200 bg-slate-50 hover:border-brand-primary/40'
                            }`}
                          >
                            <p className={`font-bold text-sm capitalize leading-tight ${isSelected ? 'text-brand-primary' : 'text-slate-700'}`}>
                              {data}
                            </p>
                            <p className={`text-xs mt-0.5 ${isSelected ? 'text-brand-primary/70' : 'text-slate-400'}`}>
                              às {hora}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Nenhuma preferência de horário informada.</p>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => openLinkModal(appt)}
                      disabled={!appt.data_hora && !selected}
                      className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:bg-slate-800"
                    >
                      <CheckCircle2 size={14} /> Confirmar Consulta
                    </button>
                    <button
                      onClick={() => handleCancel(appt.id)}
                      className="px-4 py-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all border border-slate-200"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Consultas Desmarcadas pelo Colaborador */}
      {cancelledByColab.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1.5 rounded-xl w-fit">
            <XCircle size={16} />
            <span className="text-xs font-black uppercase tracking-widest">
              {cancelledByColab.length} Consulta{cancelledByColab.length > 1 ? 's' : ''} Desmarcada{cancelledByColab.length > 1 ? 's' : ''} pelo Colaborador
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cancelledByColab.map(appt => (
              <div key={appt.id} className="bg-white rounded-[24px] border-2 border-rose-100 p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-400 flex items-center justify-center shrink-0">
                  <XCircle size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="font-bold text-slate-800 capitalize">{appt.tipo?.replace('_', ' ')}</p>
                      {(appt.colaborador_nome || appt.colaborador?.full_name) && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User size={11} /> {appt.colaborador_nome || appt.colaborador?.full_name} · {appt.empresa_nome || appt.empresas?.nome}
                        </p>
                      )}
                      {appt.data_hora && (
                        <p className="text-xs text-slate-400 mt-1">
                          Era para: {new Date(appt.data_hora).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} às {new Date(appt.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full shrink-0">
                      Desmarcado
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-rose-50">
                    {deleteConfirm === appt.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Excluir este registro?</span>
                        <button
                          onClick={() => handleDelete(appt.id)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          {isDeleting ? <Spinner size={12} className="animate-spin" /> : 'Sim, excluir'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(appt.id)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-500 font-bold transition-colors"
                      >
                        <Trash2 size={13} /> Excluir registro
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendário — Consultas Confirmadas */}
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm custom-calendar-wrapper">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Consultas Confirmadas</p>
          <Calendar
            onChange={(val) => setSelectedDate(val as Date)}
            value={selectedDate}
            tileContent={tileContent}
            className="w-full border-none font-sans"
            locale="pt-BR"
          />
        </div>

        <div className="flex-1 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-6 pb-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-xl font-serif text-slate-800 capitalize">
                {format(selectedDate, "EEEE", { locale: ptBR })}
              </h4>
              <p className="text-slate-500 font-medium">
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center">
              <CalendarIcon />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {dayAppointments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-10">
                <Clock size={40} className="opacity-20" />
                <p className="font-medium text-sm">Nenhum compromisso confirmado neste dia.</p>
              </div>
            ) : (
              dayAppointments.map(appt => (
                <div key={appt.id} className={`p-5 rounded-2xl border-l-4 ${getStatusStyle(appt.status)}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-bold text-slate-800">{appt.empresas?.nome}</h5>
                      {(appt.colaborador_nome || appt.colaborador?.full_name) && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User size={11} /> {appt.colaborador_nome || appt.colaborador?.full_name}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-white/50">
                      {appt.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-1.5"><Clock size={14} /> {format(new Date(appt.data_hora), 'HH:mm')}</div>
                    <div className="flex items-center gap-1.5 capitalize"><MapPin size={14} /> {appt.tipo.replace('_', ' ')}</div>
                  </div>

                  {editingLink === appt.id ? (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/50">
                      <input
                        autoFocus type="url" placeholder="Link da reunião..."
                        className="flex-1 p-2 border border-slate-300 rounded-lg text-xs outline-none bg-white"
                        value={tempLink} onChange={e => setTempLink(e.target.value)}
                      />
                      <button onClick={() => handleUpdateLink(appt.id)} className="p-2 bg-brand-primary text-white rounded-lg hover:bg-slate-800 transition-colors"><CheckCircle2 size={14} /></button>
                      <button onClick={() => setEditingLink(null)} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-lg border border-slate-200"><X size={14} /></button>
                    </div>
                  ) : appt.link_reuniao ? (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/50">
                      <a href={appt.link_reuniao} target="_blank" className="text-brand-primary hover:underline flex items-center gap-1.5 text-xs font-bold bg-white px-3 py-1.5 rounded-lg shadow-sm">
                        Acessar Reunião <ExternalLink size={14} />
                      </a>
                      <button onClick={() => { setEditingLink(appt.id); setTempLink(appt.link_reuniao); }} className="text-slate-400 hover:text-slate-600 text-xs font-bold underline">
                        Editar Link
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-slate-200/50">
                      <button onClick={() => { setEditingLink(appt.id); setTempLink(''); }} className="px-3 py-1.5 border-2 border-brand-primary text-brand-primary rounded-lg text-[10px] font-bold hover:bg-brand-primary hover:text-white transition-all flex items-center gap-1">
                        <Video size={12} /> Inserir Link da Reunião
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Adicionar link agora ou depois? */}
      {linkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif text-slate-800">Link da Reunião</h3>
              <button onClick={() => setLinkModal(null)} className="text-slate-400 hover:text-rose-500"><X /></button>
            </div>

            {linkStep === 'ask' ? (
              <>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Deseja adicionar o link da reunião agora ou prefere adicionar depois?
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setLinkStep('input')}
                    className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                  >
                    <Link size={16} /> Adicionar Agora
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleConfirm(linkModal.appt.id, linkModal.data_hora, '')}
                    className="w-full py-3.5 border-2 border-slate-200 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-40"
                  >
                    {isSubmitting ? <Spinner className="animate-spin" size={16} /> : 'Adicionar Depois'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-3">Cole o link da videochamada abaixo:</p>
                <input
                  autoFocus
                  type="url"
                  value={linkValue}
                  onChange={e => setLinkValue(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary text-sm mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setLinkStep('ask')} className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
                    Voltar
                  </button>
                  <button
                    disabled={isSubmitting || !linkValue.trim()}
                    onClick={() => handleConfirm(linkModal.appt.id, linkModal.data_hora, linkValue)}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-all"
                  >
                    {isSubmitting ? <Spinner className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> Confirmar</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSchedule;
