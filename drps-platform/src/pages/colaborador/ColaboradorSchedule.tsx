import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Clock, ExternalLink, Calendar as CalendarIcon, X, Loader2 as Spinner, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useColaborador } from '../../context/ColaboradorContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Slot {
  horario: string;    // "15:00" (BRT display)
  dataHora: string;   // ISO UTC string armazenado no banco
  disponivel: boolean;
}

interface DiaSlots {
  data: string;   // "2026-06-29"
  label: string;  // "Seg 29/06"
  slots: Slot[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SLOT_TIMES_BRT = ['15:00', '15:40', '16:20', '17:00', '17:40'];
const BRT_OFFSET_H = 3; // UTC-3, fixo (Brasil aboliu horário de verão em 2019)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna as próximas `count` segundas onde ao menos um slot ainda não passou. */
function getNextMondays(count: number): Date[] {
  const mondays: Date[] = [];
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  // Avança até a segunda-feira mais próxima (inclusive hoje, se for segunda)
  const dow = d.getDay();
  if (dow === 0) d.setDate(d.getDate() + 1);
  else if (dow > 1) d.setDate(d.getDate() + (8 - dow));

  while (mondays.length < count) {
    // Verifica se o último slot (17:40 BRT) ainda não passou
    const lastSlot = new Date(d);
    lastSlot.setHours(17, 40, 0, 0);
    if (lastSlot > now) mondays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return mondays;
}

/**
 * Gera o ISO UTC de um slot a partir da data (Date local) e horário BRT.
 * Usa getFullYear/Month/Date para evitar cruzamento de datas por timezone.
 */
function slotToUTC(monday: Date, brtTime: string): string {
  const [brtH, brtM] = brtTime.split(':').map(Number);
  const utcH = brtH + BRT_OFFSET_H;
  const y  = monday.getFullYear();
  const mo = String(monday.getMonth() + 1).padStart(2, '0');
  const d  = String(monday.getDate()).padStart(2, '0');
  const h  = String(utcH).padStart(2, '0');
  const m  = String(brtM).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${m}:00.000Z`;
}

/** Normaliza qualquer ISO string para prefixo "YYYY-MM-DDTHH:MM" para comparação. */
const isoPrefix = (iso: string) => new Date(iso).toISOString().substring(0, 16);

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SlotSkeleton: React.FC = () => (
  <div className="space-y-3 mt-2">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
    ))}
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────

const ColaboradorSchedule: React.FC = () => {
  const { appointments, refreshData } = useColaborador();
  const { profile } = useAuth();

  // — modal state —
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // — slots state —
  const [slotsData, setSlotsData] = useState<DiaSlots[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  // — cancelamento —
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const confirmed = appointments.filter(a => a.status === 'confirmado');
  const pending   = appointments.filter(a => a.status === 'pendente');
  const others    = appointments.filter(a => a.status === 'realizado' || a.status === 'cancelado');

  // ── Carrega slots disponíveis ───────────────────────────────────────────────

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setSlotsError(null);

    const mondays = getNextMondays(4);
    if (mondays.length === 0) { setSlotsData([]); setLoadingSlots(false); return; }

    const startDate = new Date(mondays[0]);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(mondays[mondays.length - 1]);
    endDate.setHours(23, 59, 59, 999);

    const { data: occupied, error } = await supabase
      .from('agendamentos')
      .select('data_hora')
      .gte('data_hora', startDate.toISOString())
      .lte('data_hora', endDate.toISOString())
      .neq('status', 'cancelado');

    if (error) {
      setSlotsError('Não foi possível carregar os horários disponíveis. Tente novamente.');
      setLoadingSlots(false);
      return;
    }

    const occupiedKeys = new Set(
      (occupied ?? []).filter(a => a.data_hora).map(a => isoPrefix(a.data_hora))
    );

    const dias: DiaSlots[] = mondays.map(monday => {
      const label = 'Seg ' + monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const slots: Slot[] = SLOT_TIMES_BRT.map(brtTime => {
        const dataHora = slotToUTC(monday, brtTime);
        return { horario: brtTime, dataHora, disponivel: !occupiedKeys.has(isoPrefix(dataHora)) };
      });
      return { data: `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`, label, slots };
    });

    setSlotsData(dias);
    setLoadingSlots(false);
  }, []);

  useEffect(() => {
    if (showModal) {
      setActiveDayIdx(0);
      setSelectedSlot(null);
      loadSlots();
    }
  }, [showModal, loadSlots]);

  // ── Reset e envio ───────────────────────────────────────────────────────────

  const resetModal = () => {
    setAssunto('');
    setObservacoes('');
    setSelectedSlot(null);
    setSubmitError(null);
    setSlotsData([]);
    setSlotsError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!assunto)       { setSubmitError('Selecione um assunto para continuar.'); return; }
    if (!selectedSlot)  { setSubmitError('Selecione um horário disponível para continuar.'); return; }

    setIsSubmitting(true);

    const { error } = await supabase.from('agendamentos').insert({
      colaborador_id: profile.id,
      empresa_id: profile.empresa_id,
      tipo: assunto,
      observacoes,
      data_hora: selectedSlot,
      status: 'pendente',
    });

    if (error) {
      console.error('Erro ao solicitar consulta:', error);
      if (error.code === '23505') {
        // race condition — outro usuário reservou o mesmo slot
        setSubmitError('Este horário acabou de ser reservado. Por favor, escolha outro horário.');
        setSelectedSlot(null);
        loadSlots(); // recarrega disponibilidade atualizada
      } else if (error.code === '23514' || error.message?.includes('agendamentos_tipo_check')) {
        setSubmitError('Não foi possível processar esse assunto. Tente novamente ou entre em contato com o suporte.');
      } else {
        setSubmitError('Erro ao enviar solicitação: ' + error.message);
      }
    } else {
      setShowModal(false);
      resetModal();
      refreshData();
    }
    setIsSubmitting(false);
  };

  const handleCancel = async (apptId: string) => {
    setIsCancelling(true);
    const { error } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', apptId);
    setIsCancelling(false);
    setCancelConfirm(null);
    if (!error) refreshData();
  };

  const formatDataHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const isEmpty = appointments.length === 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-serif text-slate-800">Minha Agenda</h3>
          <p className="text-slate-500 text-sm font-medium">Suas consultas agendadas e solicitações em aberto.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl shadow-slate-200 hover:scale-[1.02] transition-all flex items-center gap-2"
        >
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
            Solicite uma sessão escolhendo um horário disponível. O psicólogo confirmará em breve.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-2"
          >
            <Plus size={20} /> Solicitar Consulta
          </button>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Consultas Confirmadas */}
          {confirmed.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultas Agendadas</p>
              {confirmed
                .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
                .map(appt => {
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
                            {cancelConfirm === appt.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-rose-500 font-bold whitespace-nowrap">Desmarcar?</span>
                                <button onClick={() => handleCancel(appt.id)} disabled={isCancelling} className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[11px] font-bold hover:bg-rose-600 disabled:opacity-50">
                                  {isCancelling ? <Spinner size={12} className="animate-spin" /> : 'Sim'}
                                </button>
                                <button onClick={() => setCancelConfirm(null)} className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-[11px] font-bold hover:bg-slate-50">Não</button>
                              </div>
                            ) : (
                              <button onClick={() => setCancelConfirm(appt.id)} className="text-[11px] text-slate-400 hover:text-rose-500 font-bold flex items-center gap-1 transition-colors">
                                <XCircle size={13} /> Desmarcar consulta
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Solicitações Pendentes */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando Confirmação</p>
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
                      {appt.data_hora ? formatDataHora(appt.data_hora) : 'Horário a confirmar'}
                    </p>
                    {appt.observacoes && <p className="text-xs text-slate-400 mt-0.5 truncate">"{appt.observacoes}"</p>}
                  </div>
                  <span className="text-xs text-amber-500 font-bold shrink-0 flex items-center gap-1">
                    <Clock size={13} /> Aguardando psicólogo
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Histórico */}
          {others.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico</p>
              {others.map(appt => (
                <div key={appt.id} className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5 flex items-center gap-4 opacity-60">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <CalendarIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-slate-700">{appt.tipo}</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {appt.data_hora ? new Date(appt.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Data não registrada'}
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

      {/* ── Modal Solicitar Consulta ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">

            {/* Header fixo */}
            <div className="flex justify-between items-center px-10 pt-10 pb-6 shrink-0">
              <h3 className="text-2xl font-serif text-slate-800">Solicitar Consulta</h3>
              <button onClick={() => { setShowModal(false); resetModal(); }} className="text-slate-400 hover:text-rose-500 transition-colors"><X /></button>
            </div>

            {/* Corpo rolável */}
            <div className="overflow-y-auto px-10 pb-10 space-y-5">

              {submitError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-5">
                {/* Assunto */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assunto</label>
                  <select value={assunto} onChange={e => setAssunto(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1">
                    <option value="" disabled>Selecionar opção</option>
                    <option value="Bem-estar e saúde emocional">Bem-estar e saúde emocional</option>
                    <option value="Estresse ou sobrecarga no trabalho">Estresse ou sobrecarga no trabalho</option>
                    <option value="Relacionamento com colegas ou liderança">Relacionamento com colegas ou liderança</option>
                    <option value="Ansiedade, tristeza ou desmotivação">Ansiedade, tristeza ou desmotivação</option>
                    <option value="Conciliação entre vida pessoal e profissional">Conciliação entre vida pessoal e profissional</option>
                    <option value="Conversa preventiva / check-in periódico">Conversa preventiva / check-in periódico</option>
                    <option value="Prefiro não especificar">Prefiro não especificar</option>
                  </select>
                </div>

                {/* Observações */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Observações (opcional)</label>
                  <textarea
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    placeholder="Descreva brevemente o motivo ou algo que queira compartilhar..."
                    rows={2}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary mt-1 resize-none text-sm"
                  />
                </div>

                {/* Seleção de horário */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Horário Disponível</label>

                  {/* Loading skeleton */}
                  {loadingSlots && <SlotSkeleton />}

                  {/* Erro ao carregar slots */}
                  {!loadingSlots && slotsError && (
                    <div className="mt-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-rose-700 font-medium">{slotsError}</p>
                      <button type="button" onClick={loadSlots} className="shrink-0 flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors">
                        <RefreshCw size={12} /> Tentar novamente
                      </button>
                    </div>
                  )}

                  {/* Slot picker */}
                  {!loadingSlots && !slotsError && slotsData.length > 0 && (
                    <div className="mt-2 space-y-3">
                      {/* Abas dos dias */}
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {slotsData.map((dia, i) => (
                          <button
                            key={dia.data}
                            type="button"
                            onClick={() => { setActiveDayIdx(i); setSelectedSlot(null); }}
                            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                              activeDayIdx === i
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-white hover:border-slate-300'
                            }`}
                          >
                            {dia.label}
                          </button>
                        ))}
                      </div>

                      {/* Chips de horário */}
                      {slotsData[activeDayIdx] && (
                        <div className="grid grid-cols-5 gap-2">
                          {slotsData[activeDayIdx].slots.map(slot => {
                            const isSelected = selectedSlot === slot.dataHora;
                            return (
                              <button
                                key={slot.dataHora}
                                type="button"
                                disabled={!slot.disponivel}
                                onClick={() => setSelectedSlot(slot.dataHora)}
                                className={`flex flex-col items-center py-3 px-1 rounded-xl border text-xs font-bold transition-all ${
                                  !slot.disponivel
                                    ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                    : isSelected
                                      ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105'
                                      : 'bg-white border-slate-200 text-slate-700 hover:border-brand-primary hover:text-brand-primary'
                                }`}
                              >
                                <span className="text-sm">{slot.horario}</span>
                                {!slot.disponivel && <span className="text-[9px] font-bold text-slate-300 mt-0.5">Ocupado</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Indicador do slot selecionado */}
                      {selectedSlot && (
                        <p className="text-[11px] text-brand-primary font-bold ml-1">
                          ✓ {formatDataHora(selectedSlot)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-2 hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? <Spinner className="animate-spin" size={18} /> : 'Enviar Solicitação'}
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
