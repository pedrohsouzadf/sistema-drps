import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Clock, ExternalLink, Calendar as CalendarIcon, X, Loader2 as Spinner, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useColaborador } from '../../context/ColaboradorContext';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPost, apiPatch } from '../../services/api';

interface Slot {
  horario: string;
  dataHora: string;
  disponivel: boolean;
}

interface DiaSlots {
  data: string;
  label: string;
  slots: Slot[];
}

// Configuração de dias e horários disponíveis
// dayOfWeek: 1=Segunda, 5=Sexta
const DAY_CONFIGS = [
  { dayOfWeek: 1, times: ['15:00', '15:40', '16:20', '17:00', '17:40'], labelPrefix: 'Seg' },
  { dayOfWeek: 5, times: ['10:00', '10:40', '11:20'], labelPrefix: 'Sex' },
];

const BRT_OFFSET_H = 3; // UTC-3 (Brasil, fixo desde 2019)

/** Retorna os próximos `count` dias disponíveis (segundas e sextas) */
function getNextAvailableDays(count: number): Array<{ date: Date; config: typeof DAY_CONFIGS[0] }> {
  const result: Array<{ date: Date; config: typeof DAY_CONFIGS[0] }> = [];
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  for (let i = 0; i < 90 && result.length < count; i++) {
    const dow = d.getDay();
    const config = DAY_CONFIGS.find(c => c.dayOfWeek === dow);
    if (config) {
      const lastTime = config.times[config.times.length - 1];
      const [h, m] = lastTime.split(':').map(Number);
      const lastSlot = new Date(d);
      lastSlot.setHours(h, m, 0, 0);
      if (lastSlot > now) result.push({ date: new Date(d), config });
    }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

function slotToUTC(date: Date, brtTime: string): string {
  const [brtH, brtM] = brtTime.split(':').map(Number);
  const utcH = brtH + BRT_OFFSET_H;
  const y  = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  const h  = String(utcH).padStart(2, '0');
  const min = String(brtM).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${min}:00.000Z`;
}

const isoPrefix = (iso: string) => new Date(iso).toISOString().substring(0, 16);

const SlotSkeleton: React.FC = () => (
  <div className="space-y-3 mt-2">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
    ))}
  </div>
);

const ColaboradorSchedule: React.FC = () => {
  const { appointments, refreshData } = useColaborador();
  const { profile } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [contato, setContato] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [slotsData, setSlotsData] = useState<DiaSlots[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const confirmed = appointments.filter(a => a.status === 'confirmado');
  const pending   = appointments.filter(a => a.status === 'pendente');
  const others    = appointments.filter(a => a.status === 'realizado' || a.status === 'cancelado');

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setSlotsError(null);

    const availableDays = getNextAvailableDays(8);
    if (availableDays.length === 0) { setSlotsData([]); setLoadingSlots(false); return; }

    const startDate = new Date(availableDays[0].date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(availableDays[availableDays.length - 1].date);
    endDate.setHours(23, 59, 59, 999);

    let occupied: any[] = [];
    try {
      occupied = await apiGet<any[]>('/agendamentos');
      occupied = occupied.filter(
        a => a.status !== 'cancelado' &&
             a.data_hora >= startDate.toISOString() &&
             a.data_hora <= endDate.toISOString()
      );
    } catch {
      setSlotsError('Nao foi possivel carregar os horarios disponiveis. Tente novamente.');
      setLoadingSlots(false);
      return;
    }

    const occupiedKeys = new Set(
      occupied.filter(a => a.data_hora).map(a => isoPrefix(a.data_hora))
    );

    const dias: DiaSlots[] = availableDays.map(({ date, config }) => {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const slots: Slot[] = config.times.map(brtTime => {
        const dataHora = slotToUTC(date, brtTime);
        return { horario: brtTime, dataHora, disponivel: !occupiedKeys.has(isoPrefix(dataHora)) };
      });
      return { data: `${date.getFullYear()}-${mm}-${dd}`, label: `${config.labelPrefix} ${dd}/${mm}`, slots };
    });

    setSlotsData(dias);
    setLoadingSlots(false);
  }, []);

  useEffect(() => {
    if (showModal) { setActiveDayIdx(0); setSelectedSlot(null); loadSlots(); }
  }, [showModal, loadSlots]);

  const resetModal = () => {
    setAssunto(''); setObservacoes(''); setContato(''); setSelectedSlot(null);
    setSubmitError(null); setSlotsData([]); setSlotsError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!assunto)      { setSubmitError('Selecione um assunto para continuar.'); return; }
    if (!contato.trim()) { setSubmitError('Informe um contato (WhatsApp ou telefone).'); return; }
    if (!selectedSlot) { setSubmitError('Selecione um horario disponivel para continuar.'); return; }
    setIsSubmitting(true);
    try {
      await apiPost('/agendamentos', {
        colaborador_id: profile.id,
        colaborador_nome: profile.nome || profile.full_name,
        empresa_id: profile.empresa_id,
        empresa_nome: profile.empresa_nome,
        tipo: assunto,
        contato: contato.trim(),
        data_hora: selectedSlot,
      });
      setShowModal(false); resetModal(); refreshData();
    } catch (e: any) {
      if (e.message.includes('409') || e.message.includes('reservado')) {
        setSubmitError('Este horario acabou de ser reservado. Por favor, escolha outro horario.');
        setSelectedSlot(null); loadSlots();
      } else {
        setSubmitError('Erro ao enviar solicitacao: ' + e.message);
      }
    }
    setIsSubmitting(false);
  };

  const handleCancel = async (apptId: string) => {
    setIsCancelling(true);
    const appt = appointments.find(a => a.id === apptId);
    try {
      await apiPatch('/agendamentos/cancelar', { colaborador_id: profile.id, data_hora: appt?.data_hora });
      setCancelConfirm(null); refreshData();
    } catch (e) { console.error(e); }
    setIsCancelling(false);
  };

  const formatDataHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      + ' as ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const CancelButtons = ({ apptId, label }: { apptId: string; label: string }) => (
    cancelConfirm === apptId ? (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-rose-500 font-bold whitespace-nowrap">{label}?</span>
        <button onClick={() => handleCancel(apptId)} disabled={isCancelling} className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[11px] font-bold hover:bg-rose-600 disabled:opacity-50">
          {isCancelling ? <Spinner size={12} className="animate-spin" /> : 'Sim'}
        </button>
        <button onClick={() => setCancelConfirm(null)} className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-[11px] font-bold hover:bg-slate-50">Nao</button>
      </div>
    ) : (
      <button onClick={() => setCancelConfirm(apptId)} className="text-[11px] text-slate-400 hover:text-rose-500 font-bold flex items-center gap-1 transition-colors">
        <XCircle size={13} /> {label}
      </button>
    )
  );

  const isEmpty = appointments.length === 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-serif text-slate-800">Minha Agenda</h3>
          <p className="text-slate-500 text-sm font-medium">Suas consultas agendadas e solicitacoes em aberto.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl shadow-slate-200 hover:scale-[1.02] transition-all flex items-center gap-2">
          <Plus size={20} /> Solicitar Consulta
        </button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-700">
          <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <CalendarIcon size={48} />
          </div>
          <h3 className="text-2xl font-serif text-slate-800 mb-2">Nenhuma consulta agendada</h3>
          <p className="text-slate-400 text-sm max-w-sm text-center mb-8 font-medium">
            Solicite uma sessao escolhendo um horario disponivel. O psicologo confirmara em breve.
          </p>
          <button onClick={() => setShowModal(true)} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-2">
            <Plus size={20} /> Solicitar Consulta
          </button>
        </div>
      ) : (
        <div className="space-y-8">

          {confirmed.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultas Agendadas</p>
              {confirmed.sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()).map(appt => {
                const d = new Date(appt.data_hora);
                return (
                  <div key={appt.id} className="bg-white rounded-[24px] border-2 border-emerald-100 shadow-sm overflow-hidden">
                    <div className="flex items-stretch">
                      <div className="bg-emerald-500 text-white flex flex-col items-center justify-center px-6 py-5 shrink-0 min-w-[80px]">
                        <span className="text-2xl font-black leading-none">{d.toLocaleDateString('pt-BR', { day: '2-digit' })}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{d.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                        <span className="text-xs font-bold mt-2 opacity-80">{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Confirmado</span>
                          </div>
                          <p className="font-bold text-slate-800">{appt.tipo}</p>
                          <p className="text-sm text-slate-500 capitalize mt-0.5">
                            {d.toLocaleDateString('pt-BR', { weekday: 'long' })}
                            {appt.observacoes && ` · "${appt.observacoes}"`}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          {appt.link_reuniao ? (
                            <a href={appt.link_reuniao} target="_blank" className="bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 whitespace-nowrap">
                              Entrar na Sala <ExternalLink size={14} />
                            </a>
                          ) : (
                            <span className="flex items-center gap-1.5 text-slate-400 text-xs font-bold whitespace-nowrap">
                              <Clock size={14} /> Link em breve
                            </span>
                          )}
                          <CancelButtons apptId={appt.id} label="Desmarcar consulta" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pending.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando Confirmacao</p>
              {pending.map(appt => (
                <div key={appt.id} className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                    <Clock size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800">{appt.tipo}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600">Pendente</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      {appt.data_hora ? formatDataHora(appt.data_hora) : 'Horario a confirmar'}
                    </p>
                    {appt.observacoes && <p className="text-xs text-slate-400 mt-0.5 truncate">"{appt.observacoes}"</p>}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className="text-xs text-amber-500 font-bold flex items-center gap-1">
                      <Clock size={13} /> Aguardando psicologo
                    </span>
                    <CancelButtons apptId={appt.id} label="Cancelar solicitacao" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {others.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historico</p>
              {others.map(appt => (
                <div key={appt.id} className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5 flex items-center gap-4 opacity-60">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <CalendarIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-slate-700">{appt.tipo}</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {appt.data_hora
                        ? new Date(appt.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                        : 'Data nao registrada'}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${appt.status === 'cancelado' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                    {appt.status === 'cancelado' ? 'Cancelado' : 'Realizado'}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">

            <div className="flex justify-between items-center px-10 pt-10 pb-6 shrink-0">
              <h3 className="text-2xl font-serif text-slate-800">Solicitar Consulta</h3>
              <button onClick={() => { setShowModal(false); resetModal(); }} className="text-slate-400 hover:text-rose-500 transition-colors"><X /></button>
            </div>

            <div className="overflow-y-auto px-10 pb-10 space-y-5">
              {submitError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">
                  <span className="mt-0.5 shrink-0">&#9888;</span>
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assunto</label>
                  <select value={assunto} onChange={e => setAssunto(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1">
                    <option value="" disabled>Selecionar opcao</option>
                    <option value="Bem-estar e saude emocional">Bem-estar e saude emocional</option>
                    <option value="Estresse ou sobrecarga no trabalho">Estresse ou sobrecarga no trabalho</option>
                    <option value="Relacionamento com colegas ou lideranca">Relacionamento com colegas ou lideranca</option>
                    <option value="Ansiedade, tristeza ou desmotivacao">Ansiedade, tristeza ou desmotivacao</option>
                    <option value="Conciliacao entre vida pessoal e profissional">Conciliacao entre vida pessoal e profissional</option>
                    <option value="Conversa preventiva / check-in periodico">Conversa preventiva / check-in periodico</option>
                    <option value="Prefiro nao especificar">Prefiro nao especificar</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Observacoes (opcional)</label>
                  <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                    placeholder="Descreva brevemente o motivo ou algo que queira compartilhar..."
                    rows={2} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1 resize-none text-sm" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contato — WhatsApp ou Telefone *</label>
                  <input
                    type="tel"
                    required
                    value={contato}
                    onChange={e => setContato(e.target.value)}
                    placeholder="(61) 9 9999-9999"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1 text-sm"
                  />
                  <p className="text-[10px] text-slate-400 ml-1 mt-1">Usado apenas para lembrete da consulta. Nao sera compartilhado.</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Horario Disponivel</label>
                  <p className="text-[10px] text-slate-400 ml-1 mt-0.5">Segundas 15:00-17:40 · Sextas 10:00-12:00</p>

                  {loadingSlots && <SlotSkeleton />}

                  {!loadingSlots && slotsError && (
                    <div className="mt-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-rose-700 font-medium">{slotsError}</p>
                      <button type="button" onClick={loadSlots} className="shrink-0 flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors">
                        <RefreshCw size={12} /> Tentar novamente
                      </button>
                    </div>
                  )}

                  {!loadingSlots && !slotsError && slotsData.length > 0 && (
                    <div className="mt-2 space-y-3">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {slotsData.map((dia, i) => (
                          <button key={dia.data} type="button"
                            onClick={() => { setActiveDayIdx(i); setSelectedSlot(null); }}
                            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                              activeDayIdx === i
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-white hover:border-slate-300'
                            }`}>
                            {dia.label}
                          </button>
                        ))}
                      </div>

                      {slotsData[activeDayIdx] && (
                        <div className="grid grid-cols-5 gap-2">
                          {slotsData[activeDayIdx].slots.map(slot => {
                            const isSelected = selectedSlot === slot.dataHora;
                            return (
                              <button key={slot.dataHora} type="button" disabled={!slot.disponivel}
                                onClick={() => setSelectedSlot(slot.dataHora)}
                                className={`flex flex-col items-center py-3 px-1 rounded-xl border text-xs font-bold transition-all ${
                                  !slot.disponivel
                                    ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                    : isSelected
                                      ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105'
                                      : 'bg-white border-slate-200 text-slate-700 hover:border-brand-primary hover:text-brand-primary'
                                }`}>
                                <span className="text-sm">{slot.horario}</span>
                                {!slot.disponivel && <span className="text-[9px] font-bold text-slate-300 mt-0.5">Ocupado</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {selectedSlot && (
                        <p className="text-[11px] text-brand-primary font-bold ml-1">
                          &#10003; {formatDataHora(selectedSlot)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button disabled={isSubmitting}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-2 hover:bg-slate-800 transition-colors disabled:opacity-60">
                  {isSubmitting ? <Spinner className="animate-spin" size={18} /> : 'Enviar Solicitacao'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColaboradorSchedule;
