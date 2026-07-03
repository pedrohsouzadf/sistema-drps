import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 as Spinner, LayoutDashboard, ListTree, Building, Users, FileText, Download, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { calculateResults, getSeverity, getRiskLevel, calcularClassificacaoGeral, SEVERITY_RANK, RISK_LEVEL_RANK } from '../../services/riskCalculator';
import { QUESTIONS } from '../../services/questions';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { generatePDFReport } from '../../services/pdfGenerator';

type TabType = 'dashboard' | 'topicos' | 'setores' | 'respostas' | 'gerador';

const AdminCompanyReport: React.FC = () => {
  const { empresaId } = useParams<{ empresaId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [filterSector, setFilterSector] = useState('todos');

  // Probabilidade manual: allProbValues[setor][topico] = 1|2|3
  const [probSector, setProbSector] = useState('Todos');
  const [allProbValues, setAllProbValues] = useState<Record<string, Record<string, number>>>({});
  const [probSaving, setProbSaving] = useState<string | null>(null);



  useEffect(() => {
    const fetchData = async () => {
      if (!empresaId) return;
      setLoading(true);
      
      const { data: comp } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', empresaId)
        .single();
        
      const { data: resps } = await supabase
        .from('respostas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('criado_em', { ascending: false });

      if (comp) setCompany(comp);
      if (resps) setResponses(resps);

      setLoading(false);
    };
    fetchData();
  }, [empresaId]);

  // Carrega TODAS as probabilidades da empresa de uma vez
  useEffect(() => {
    if (!empresaId) return;
    supabase
      .from('probabilidades_topico')
      .select('setor, topico, valor')
      .eq('empresa_id', empresaId)
      .then(({ data }) => {
        const vals: Record<string, Record<string, number>> = {};
        (data ?? []).forEach((d: any) => {
          if (!vals[d.setor]) vals[d.setor] = {};
          vals[d.setor][d.topico] = d.valor;
        });
        setAllProbValues(vals);
      });
  }, [empresaId]);

  if (loading) {
    return <div className="flex justify-center py-32"><Spinner className="animate-spin text-brand-primary" size={40} /></div>;
  }

  if (!company) {
    return <div className="p-8 text-center text-slate-500">Empresa não encontrada.</div>;
  }

  const rawAnswers = responses.map(r => r.respostas);
  const topicResults = calculateResults(rawAnswers);

  // Cálculo filtrado por setor — alimenta a aba "Por Tópico"
  const topicSectorResponses = probSector === 'Todos'
    ? responses
    : responses.filter(r => r.setor === probSector);
  const topicSectorResults = calculateResults(topicSectorResponses.map(r => r.respostas));

  // Stats
  const totalResponses = responses.length;
  const uniqueSectors = Array.from(new Set(responses.map(r => r.setor).filter(Boolean)));
  const lastResponseDate = responses.length > 0 ? new Date(responses[0].criado_em).toLocaleDateString('pt-BR') : 'N/A';

  // Matrix counts
  const riskCounts = { 'Crítico': 0, 'Alto': 0, 'Médio': 0, 'Baixo': 0 };
  topicResults.forEach(tr => { riskCounts[tr.risk] = (riskCounts[tr.risk] || 0) + 1; });

  const filteredSectors = filterSector === 'todos' 
    ? uniqueSectors 
    : uniqueSectors.filter(s => s === filterSector);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Crítico': return '#a02828';
      case 'Alto': return '#c45c1a';
      case 'Médio': return '#b07d18';
      case 'Baixo': return '#2a7d4f';
      default: return '#94a3b8';
    }
  };

  const getRiskBg = (risk: string) => {
    switch (risk) {
      case 'Crítico': return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'Alto': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'Médio': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'Baixo': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getProbLabel = (val: number): 'Baixa' | 'Média' | 'Alta' => {
    if (val <= 1.5) return 'Baixa';
    if (val <= 2.4) return 'Média';
    return 'Alta';
  };
  const getProbBg = (val: number) => {
    const label = getProbLabel(val);
    return label === 'Alta' ? 'bg-rose-50 text-rose-600' : label === 'Média' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600';
  };

  const NR01_MATRIX: Record<string, Record<string, string>> = {
    'Baixa': { 'Baixa': 'Baixo', 'Média': 'Baixo', 'Alta': 'Médio'   },
    'Média': { 'Baixa': 'Baixo', 'Média': 'Médio',  'Alta': 'Alto'    },
    'Alta':  { 'Baixa': 'Médio', 'Média': 'Alto',   'Alta': 'Crítico' },
  };
  const getMatrizRisco = (severity: string, prob: number): string =>
    NR01_MATRIX[severity]?.[getProbLabel(prob)] ?? 'Baixo';

  const probValues = allProbValues[probSector] ?? {};

  const handleProbChange = async (topico: string, valor: number) => {
    setAllProbValues(prev => ({
      ...prev,
      [probSector]: { ...(prev[probSector] ?? {}), [topico]: valor },
    }));
    setProbSaving(topico);
    await supabase.from('probabilidades_topico').upsert(
      { empresa_id: empresaId, setor: probSector, topico, valor },
      { onConflict: 'empresa_id,setor,topico' }
    );
    setProbSaving(null);
  };

  // Hierarquia de risco (pior → melhor)
  const RISK_RANK: Record<string, number> = { 'Crítico': 4, 'Alto': 3, 'Médio': 2, 'Baixo': 1 };

  // Matriz Risco do setor = pior nível NR-01 entre os tópicos com probabilidade definida.
  // Retorna null quando nenhum tópico do setor tiver probabilidade salva.
  const getWorstSectorRisk = (sector: string, sectorTopicResults: any[]): string | null => {
    const sectorProbs = allProbValues[sector] ?? {};
    let worst: string | null = null;
    for (const tr of sectorTopicResults) {
      const prob = sectorProbs[tr.topic];
      if (!prob) continue;
      const topicRisk = getMatrizRisco(tr.severity, prob);
      if (worst === null || (RISK_RANK[topicRisk] ?? 0) > (RISK_RANK[worst] ?? 0)) worst = topicRisk;
    }
    return worst;
  };

  // Gravidade específica por setor × tópico — necessária para o pior caso correto no modo Geral
  const sectorTopicSeverities: Record<string, Record<string, string>> = {};
  for (const sector of Object.keys(allProbValues).filter(s => s !== 'Todos')) {
    const sectorResp = responses.filter((r: any) => r.setor === sector).map((r: any) => r.respostas);
    if (sectorResp.length === 0) continue;
    const sectorRes = calculateResults(sectorResp);
    sectorTopicSeverities[sector] = {};
    sectorRes.forEach(r => { sectorTopicSeverities[sector][r.topic] = r.severity; });
  }

  // Pior risco de um tópico entre TODOS os setores avaliados
  // Usa a gravidade específica do setor, não a gravidade global
  // Retorna null se nenhum setor tiver probabilidade definida para o tópico
  const getTopicWorstAcrossSectors = (topicName: string): string | null => {
    const specificSectors = Object.keys(allProbValues).filter(s => s !== 'Todos');
    let worst: string | null = null;
    for (const sector of specificSectors) {
      const prob = allProbValues[sector][topicName];
      if (!prob) continue;
      const severity = sectorTopicSeverities[sector]?.[topicName];
      if (!severity) continue;
      const risk = getMatrizRisco(severity, prob);
      if (worst === null || (RISK_RANK[risk] ?? 0) > (RISK_RANK[worst] ?? 0)) {
        worst = risk;
      }
    }
    return worst;
  };

  // Alteration 3: status de avaliação de um setor
  const getSectorEvalStatus = (sector: string): 'avaliado' | 'parcial' | 'pendente' => {
    const defined = Object.keys(allProbValues[sector] ?? {}).length;
    const total = topicResults.length;
    if (defined === 0) return 'pendente';
    if (defined >= total) return 'avaliado';
    return 'parcial';
  };

  const isGlobalMode = probSector === 'Todos';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <button onClick={() => navigate('/admin/clientes')} className="w-10 h-10 bg-white border border-slate-200 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-serif text-slate-800">{company.nome}</h2>
          <p className="text-slate-500 text-sm font-medium">Relatório Detalhado do Diagnóstico DRPS</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={16} />} label="Dashboard" />
        <TabButton active={activeTab === 'topicos'} onClick={() => setActiveTab('topicos')} icon={<ListTree size={16} />} label="Por Tópico" />
        <TabButton active={activeTab === 'setores'} onClick={() => setActiveTab('setores')} icon={<Building size={16} />} label="Por Setor" />
        <TabButton active={activeTab === 'respostas'} onClick={() => setActiveTab('respostas')} icon={<Users size={16} />} label="Respostas" />
        <TabButton active={activeTab === 'gerador'} onClick={() => setActiveTab('gerador')} icon={<FileText size={16} />} label="Gerar Relatório" />
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]">
        
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Respostas</p><p className="text-3xl font-serif text-slate-800">{totalResponses}</p></div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Setores Identificados</p><p className="text-3xl font-serif text-slate-800">{uniqueSectors.length}</p></div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Última Resposta</p><p className="text-3xl font-serif text-slate-800">{lastResponseDate}</p></div>
            </div>

            {/* Matrix */}
            <div>
              <h3 className="text-lg font-serif text-slate-800 mb-4">Matriz de Risco Geral</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MatrixCard title="Crítico" count={riskCounts['Crítico']} color="rose" />
                <MatrixCard title="Alto" count={riskCounts['Alto']} color="orange" />
                <MatrixCard title="Médio" count={riskCounts['Médio']} color="amber" />
                <MatrixCard title="Baixo" count={riskCounts['Baixo']} color="emerald" />
              </div>
            </div>

            {/* Chart */}
            <div>
              <h3 className="text-lg font-serif text-slate-800 mb-2">Gravidade por Tópico</h3>
              <p className="text-sm text-slate-500 mb-6">Média da pontuação corrigida por tópico (0–4). Quanto maior, maior o risco.</p>
              <div style={{ width: '100%', height: 500 }}>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart 
                    data={[...topicResults]
                      .map(tr => ({ ...tr, topicClean: tr.topic.replace(/^Tópico \d+ [-–] /i, '') }))
                      .sort((a,b) => b.average - a.average)
                    } 
                    layout="vertical" 
                    margin={{ left: 5, right: 80 }}
                  >
                    <XAxis type="number" domain={[0, 4]} hide />
                    <YAxis 
                      dataKey="topicClean" 
                      type="category" 
                      width={220} 
                      tick={{ fontSize: 11, fill: '#1e293b', textAnchor: 'end' }} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <Tooltip 
                      formatter={(value: number) => [value.toFixed(2), 'Pontuação']}
                      cursor={{ fill: '#f8fafc' }} 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    />
                    <Bar dataKey="average" radius={[0, 8, 8, 0]} barSize={24}>
                      {[...topicResults].sort((a,b) => b.average - a.average).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getRiskColor(entry.risk)} />
                      ))}
                      <LabelList 
                        dataKey="risk" 
                        position="right" 
                        content={(props: any) => {
                          const { x, y, width, value } = props;
                          return (
                            <text x={x + width + 10} y={y + 16} fill={getRiskColor(value)} fontSize={10} fontWeight="normal" textAnchor="start" style={{ textTransform: 'uppercase' }}>
                              {value}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'topicos' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-lg font-serif text-slate-800">Análise por Tópico</h3>
                <p className="text-xs text-slate-400 mt-0.5">Gravidade calculada automaticamente · Probabilidade inserida manualmente pelo psicólogo (NR-01)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Setor:</span>
                <select
                  value={probSector}
                  onChange={e => setProbSector(e.target.value)}
                  className="text-sm p-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-brand-primary"
                >
                  <option value="Todos">Geral (Todos os Setores)</option>
                  {uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {!isGlobalMode && responses.filter(r => r.setor === probSector).length < 5 && responses.filter(r => r.setor === probSector).length > 0 && (
              <div className="bg-orange-50 border border-orange-300 rounded-2xl px-5 py-3 flex gap-3 items-start">
                <AlertCircle size={15} className="text-orange-500 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-800">
                  <strong>Amostra reduzida:</strong> o setor <strong>{probSector}</strong> possui apenas <strong>{responses.filter(r => r.setor === probSector).length} respondente(s)</strong>. Resultados com menos de 5 participantes têm validade estatística limitada — interprete com cautela.
                </p>
              </div>
            )}
            {isGlobalMode ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex gap-3 items-start">
                <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>A probabilidade de ocorrência deve ser definida por setor.</strong> Selecione um setor específico no filtro acima para inserir os valores. A coluna Matriz Risco exibe o pior caso entre os setores já avaliados.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex gap-3 items-start">
                <Save size={15} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>Probabilidade de Ocorrência — {probSector}</strong> — insira 1 (Baixa), 2 (Média) ou 3 (Alta) para cada tópico conforme sua análise qualitativa dos critérios de probabilidade. O valor é salvo automaticamente ao alterar.
                </p>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                  <tr>
                    <th className="px-6 py-4">Tópico Avaliado</th>
                    <th className="px-6 py-4">Score</th>
                    <th className="px-6 py-4">Class. Gravidade</th>
                    <th className="px-6 py-4">Prob. (1/2/3)</th>
                    <th className="px-6 py-4">Class. Probabilidade</th>
                    <th className="px-6 py-4 text-right">Matriz Risco NR-01</th>
                  </tr>
                  {isGlobalMode && (
                    <tr className="border-t border-slate-100">
                      <td colSpan={6} className="px-6 py-2 bg-slate-50/60" style={{ fontStyle: 'italic', fontSize: '12px', color: '#888888', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}>
                        No modo Geral, Score e Gravidade são calculados com todos os respondentes da empresa. A coluna Matriz Risco exibe o pior nível identificado entre os setores já avaliados para cada tópico.
                      </td>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...topicSectorResults]
                    .sort((a, b) => b.average - a.average)
                    .map((tr, i) => {
                      const savedProb: number | null = isGlobalMode ? null : (probValues[tr.topic] ?? null);
                      const displayProb = savedProb ?? '';
                      const matrizRisco = isGlobalMode
                        ? getTopicWorstAcrossSectors(tr.topic)
                        : (savedProb !== null ? getMatrizRisco(tr.severity, savedProb) : null);
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-slate-700">
                            {tr.topic.replace(/^Tópico \d+ [-–] /i, '')}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-slate-500">{tr.average.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getRiskBg(tr.risk)}`}>
                              {tr.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {isGlobalMode ? (
                              <span className="w-16 inline-block text-center text-sm text-slate-300 border border-slate-100 rounded-lg py-1.5 bg-slate-50 select-none">—</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  value={displayProb}
                                  onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) handleProbChange(tr.topic, v); }}
                                  className={`w-16 text-center text-sm font-bold border rounded-lg p-1.5 bg-white outline-none focus:border-brand-primary cursor-pointer ${displayProb === '' ? 'border-amber-300 text-slate-400' : 'border-slate-200'}`}
                                  title="1 = Baixa  /  2 = Média  /  3 = Alta"
                                >
                                  <option value="" disabled>—</option>
                                  <option value={1}>1</option>
                                  <option value={2}>2</option>
                                  <option value={3}>3</option>
                                </select>
                                {probSaving === tr.topic && (
                                  <Spinner size={12} className="animate-spin text-slate-400" />
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isGlobalMode || savedProb === null ? (
                              <span className="text-[10px] text-slate-300">—</span>
                            ) : (
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getProbBg(savedProb)}`}>
                                {getProbLabel(savedProb)}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {matrizRisco ? (
                              <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getRiskBg(matrizRisco)}`}>
                                {matrizRisco}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'setores' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-serif text-slate-800">Análise por Setor</h3>
              <div className="flex gap-4 items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Filtro:</span>
                <select value={filterSector} onChange={e => setFilterSector(e.target.value)} className="text-sm p-2 rounded-lg border border-slate-200 bg-white outline-none">
                  <option value="todos">Todos os Setores</option>
                  {uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {uniqueSectors.some(s => { const n = responses.filter(r => r.setor === s).length; return n > 0 && n < 5; }) && (
              <div className="bg-orange-50 border border-orange-300 rounded-2xl px-5 py-3 flex gap-3 items-start">
                <AlertCircle size={15} className="text-orange-500 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-800">
                  <strong>Amostra reduzida em um ou mais setores:</strong> setores com menos de 5 respondentes têm validade estatística limitada. Os resultados correspondentes devem ser interpretados com cautela e complementados com análise qualitativa.
                </p>
              </div>
            )}

            {uniqueSectors.length === 0 ? (
              <p className="text-slate-500">Nenhum setor identificado nas respostas.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="px-6 py-4">Setor</th>
                      <th className="px-6 py-4">Avaliação</th>
                      <th className="px-6 py-4">Respondentes</th>
                      <th className="px-6 py-4">Score Médio</th>
                      <th className="px-6 py-4">Class. Gravidade</th>
                      <th className="px-6 py-4 text-right">Matriz Risco + Alta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSectors.map((sector: any) => {
                      const sectorResponses = responses.filter(r => r.setor === sector).map(r => r.respostas);
                      const sectorResults = calculateResults(sectorResponses);
                      const avgScore = sectorResults.reduce((acc, curr) => acc + curr.average, 0) / sectorResults.length;
                      const severidades = sectorResults.map(r => r.severity);
                      const worstSeverity: Severity = severidades.length > 0
                        ? calcularClassificacaoGeral(severidades, SEVERITY_RANK)
                        : 'Baixa';
                      const worstRisk = getWorstSectorRisk(sector, sectorResults);
                      const evalStatus = getSectorEvalStatus(sector);
                      const evalConfig = {
                        avaliado: { icon: '✅', label: 'Avaliado',  cls: 'bg-emerald-50 text-emerald-700' },
                        parcial:  { icon: '⚠️', label: 'Parcial',   cls: 'bg-amber-50 text-amber-700'   },
                        pendente: { icon: '○',  label: 'Pendente',  cls: 'bg-slate-50 text-slate-400'   },
                      }[evalStatus];

                      return (
                        <tr key={sector} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-slate-700">{sector}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${evalConfig.cls}`}>
                              <span>{evalConfig.icon}</span> {evalConfig.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1.5">
                              {sectorResponses.length}
                              {sectorResponses.length > 0 && sectorResponses.length < 5 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                                  <AlertCircle size={10} /> reduzida
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-slate-500">{avgScore.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getRiskBg(getRiskLevel(worstSeverity))}`}>
                              {worstSeverity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {worstRisk ? (
                              <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getRiskBg(worstRisk)}`}>
                                {worstRisk}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'respostas' && (
          <RespostasTab responses={responses} uniqueSectors={uniqueSectors} />
        )}

        {activeTab === 'gerador' && (
          <GeradorHTMLTab company={company} uniqueSectors={uniqueSectors} responses={responses} allProbValues={allProbValues} />
        )}
      </div>
    </div>
  );
};

// --- Subcomponents for specific tabs ---

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${active ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
  >
    {icon} {label}
  </button>
);

const MatrixCard = ({ title, count, color }: any) => {
  const styles: any = {
    rose: 'bg-rose-50 border-rose-200 text-rose-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
    amber: 'bg-amber-50 border-amber-200 text-amber-600',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600'
  };
  return (
    <div className={`p-6 rounded-2xl border ${styles[color]}`}>
      <p className="text-3xl font-serif mb-1">{count}</p>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Tópicos: {title}</p>
    </div>
  );
};

const RespostasTab = ({ responses, uniqueSectors }: { responses: any[], uniqueSectors: string[] }) => {
  const [filterSector, setFilterSector] = useState('');
  
  const getRespRisk = (answers: number[]) => {
    const res = calculateResults([answers]);
    const avg = res.reduce((acc, curr) => acc + curr.average, 0) / res.length;
    const sev = getSeverity(avg);
    return { risk: getRiskLevel(sev), avg };
  };

  const filtered = responses.filter(r => !filterSector || r.setor === filterSector);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <div className="flex gap-4 items-center">
          <span className="text-xs font-bold text-slate-400 uppercase">Filtros:</span>
          <select value={filterSector} onChange={e => setFilterSector(e.target.value)} className="text-sm p-2 rounded-lg border border-slate-200 outline-none">
            <option value="">Todos os Setores</option>
            {uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={() => setFilterSector('')} className="text-xs text-brand-primary font-bold hover:underline">Limpar tudo</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(r => {
          const info = getRespRisk(r.respostas);
          return (
            <div key={r.id} className="p-5 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800 text-sm mb-1">{r.cargo || 'Cargo não informado'}</p>
                <div className="flex gap-2 items-center text-xs text-slate-500">
                  <span className="bg-slate-100 px-2 py-0.5 rounded">{r.setor || 'N/A'}</span>
                  <span>•</span>
                  <span>{new Date(r.criado_em).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 mb-1">Score: {info.avg.toFixed(2)}</p>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  info.risk === 'Crítico' ? 'bg-rose-50 text-rose-600' :
                  info.risk === 'Alto' ? 'bg-orange-50 text-orange-600' :
                  info.risk === 'Médio' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>{info.risk}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GeradorHTMLTab = ({ company, uniqueSectors, responses, profile, allProbValues }: any) => {
  const [formData, setFormData] = useState({
    cnpj: company.cnpj || '',
    psicologo: '',
    crp: '',
    setor: 'Todos',
    mesAno: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  });

  const handleGenerate = () => {
    let targetResponses = responses;
    if (formData.setor !== 'Todos') {
      targetResponses = responses.filter((r: any) => r.setor === formData.setor);
    }
    if (targetResponses.length === 0) return alert('Não há respostas para o setor selecionado.');
    if (targetResponses.length < 5) {
      const ok = window.confirm(
        `Atenção: o setor "${formData.setor === 'Todos' ? 'Geral' : formData.setor}" possui apenas ${targetResponses.length} respondente(s).\n\n` +
        `Amostras menores que 5 respondentes têm validade estatística limitada e o relatório incluirá um aviso de amostra reduzida.\n\n` +
        `Deseja continuar mesmo assim?`
      );
      if (!ok) return;
    }

    const rawAnswers = targetResponses.map((r: any) => r.respostas);
    const results = calculateResults(rawAnswers);
    const avgScore = results.reduce((acc: number, curr: any) => acc + curr.average, 0) / results.length;
    const overallRisk = getRiskLevel(getSeverity(avgScore));

    // Probabilidades salvas para o setor selecionado
    const sectorProbs: Record<string, number> = (allProbValues ?? {})[formData.setor] ?? {};
    const localProbLabel = (v: number): string => v === 1 ? 'Baixa' : v === 2 ? 'Média' : 'Alta';
    const LOCAL_NR01: Record<string, Record<string, string>> = {
      'Baixa': { 'Baixa': 'Baixo', 'Média': 'Baixo', 'Alta': 'Médio'   },
      'Média': { 'Baixa': 'Baixo', 'Média': 'Médio',  'Alta': 'Alto'    },
      'Alta':  { 'Baixa': 'Médio', 'Média': 'Alto',   'Alta': 'Crítico' },
    };
    const getMatrizRiscoLocal = (severity: string, prob: number): string =>
      LOCAL_NR01[severity]?.[localProbLabel(prob)] ?? 'Baixo';
    const riskToClass = (r: string) =>
      r === 'Crítico' ? 'text-critico' : r === 'Alto' ? 'text-alto' : r === 'Médio' ? 'text-medio' : 'text-baixo';

    const stripPrefix = (t: string) => t.replace(/^Tópico\s+\d+\s+-\s+/i, '');

    const SYNTHETIC: Record<string, Record<string, string>> = {
      'Assédio de qualquer natureza no trabalho': { 'Crítico': 'Comportamentos abusivos graves com risco imediato à integridade dos colaboradores.', 'Alto': 'Ocorrências relevantes de assédio impactam o ambiente. Política formal e canal de denúncia são essenciais.', 'Médio': 'Percepção moderada de condutas inadequadas. Monitoramento ativo e ações educativas necessários.', 'Baixo': 'Baixa incidência percebida; monitoramento para consolidar cultura de respeito.' },
      'Falta de suporte/apoio no trabalho': { 'Crítico': 'Ausência crítica de suporte gera isolamento e risco elevado de adoecimento coletivo.', 'Alto': 'Deficiência significativa de apoio comprometendo saúde mental e desempenho.', 'Médio': 'Suporte percebido como insuficiente. Atenção à liderança empática e cultura de acolhimento.', 'Baixo': 'Suporte razoavelmente presente; monitorar para garantir acolhimento a todos.' },
      'Má gestão de mudanças organizacionais': { 'Crítico': 'Mudanças mal gerenciadas geram insegurança generalizada e risco elevado de adoecimento.', 'Alto': 'Gestão de mudanças ineficiente com impacto na estabilidade emocional da equipe.', 'Médio': 'Processos de mudança com comunicação parcial. Estratégias formais são necessárias.', 'Baixo': 'Impacto moderado de mudanças; monitoramento preventivo do clima recomendado.' },
      'Baixa clareza de papel/função': { 'Crítico': 'Ausência de definição clara de papéis gera conflitos graves e estresse elevado.', 'Alto': 'Ambiguidade de funções relevante, causando sobrecarga e insegurança na equipe.', 'Médio': 'Clareza insuficiente em situações específicas; revisão de atribuições necessária.', 'Baixo': 'Clareza adequada com oportunidades de melhoria no alinhamento de expectativas.' },
      'Baixas recompensas e reconhecimento': { 'Crítico': 'Ausência crítica de reconhecimento com impacto severo na motivação e risco de burnout.', 'Alto': 'Déficit significativo de valorização profissional; riscos de desmotivação crônica.', 'Médio': 'Reconhecimento insuficiente percebido; atenção ao estilo de liderança e feedback.', 'Baixo': 'Nível aceitável de reconhecimento com oportunidades de melhoria nas práticas de valorização.' },
      'Baixo controle no trabalho / Falta de autonomia': { 'Crítico': 'Controle excessivo compromete gravemente o bem-estar e a competência percebida.', 'Alto': 'Baixa autonomia com impacto direto na motivação, criatividade e saúde psicológica.', 'Médio': 'Autonomia parcialmente restrita; revisão dos processos de supervisão recomendada.', 'Baixo': 'Nível de controle equilibrado; monitorar para prevenir microgerenciamento.' },
      'Baixa justiça organizacional': { 'Crítico': 'Percepção crítica de injustiça com risco elevado de desengajamento e adoecimento.', 'Alto': 'Sentimento relevante de desigualdade comprometendo a confiança institucional.', 'Médio': 'Percepção moderada de injustiça; transparência nos processos decisórios requer atenção.', 'Baixo': 'Percepção de equidade razoável; monitoramento preventivo para manter a confiança.' },
      'Eventos violentos ou traumáticos': { 'Crítico': 'Exposição a eventos traumáticos graves; intervenção psicológica imediata necessária.', 'Alto': 'Ocorrências traumáticas com impacto real na saúde mental; suporte especializado prioritário.', 'Médio': 'Histórico de eventos adversos; protocolos de acolhimento e suporte são necessários.', 'Baixo': 'Baixa ocorrência; manter canal de apoio psicológico e protocolos de prevenção ativos.' },
      'Baixa demanda no trabalho (Subcarga)': { 'Crítico': 'Subcarga severa com risco de adoecimento por subutilização e perda de sentido.', 'Alto': 'Subutilização relevante das competências com impacto na motivação e saúde.', 'Médio': 'Trabalho aquém do potencial; revisão de atribuições e desafios recomendada.', 'Baixo': 'Subcarga pontual; monitorar distribuição de tarefas para garantir engajamento.' },
      'Excesso de demandas no trabalho (Sobrecarga)': { 'Crítico': 'Sobrecarga crítica com risco iminente de burnout e adoecimento físico e mental.', 'Alto': 'Excesso de demandas impactando diretamente saúde e qualidade de vida.', 'Médio': 'Carga excessiva em momentos específicos; revisão de processos e dimensionamento necessária.', 'Baixo': 'Sobrecarga eventual e gerenciável; monitorar para evitar que se torne padrão.' },
      'Maus relacionamentos no local de trabalho': { 'Crítico': 'Relações gravemente comprometidas com conflitos recorrentes e riscos à saúde coletiva.', 'Alto': 'Conflitos significativos e clima deteriorado; intervenção imediata na gestão de pessoas.', 'Médio': 'Tensões identificadas; mediação de conflitos e clima organizacional requerem atenção.', 'Baixo': 'Relações satisfatórias; monitoramento preventivo e ações de integração recomendados.' },
      'Trabalho em condições de difícil comunicação': { 'Crítico': 'Falhas críticas de comunicação comprometendo segurança e coesão organizacional.', 'Alto': 'Dificuldades significativas gerando retrabalho, conflitos e riscos à saúde.', 'Médio': 'Comunicação parcialmente prejudicada; revisão dos canais e processos necessária.', 'Baixo': 'Comunicação adequada com pontos de melhoria; monitoramento preventivo recomendado.' },
      'Trabalho remoto e isolado': { 'Crítico': 'Isolamento severo com impacto crítico na saúde mental e senso de pertencimento.', 'Alto': 'Trabalho remoto mal gerenciado gerando desconexão e riscos psicossociais elevados.', 'Médio': 'Isolamento moderado percebido; estratégias de conexão e acompanhamento necessárias.', 'Baixo': 'Trabalho remoto com suporte razoável; monitorar vínculos e sentimento de pertencimento.' },
    };

    const getSyntheticDesc = (topic: string, risk: string) => {
      const key = stripPrefix(topic);
      return SYNTHETIC[key]?.[risk] ?? (risk === 'Crítico' ? 'Fator em nível crítico, exigindo intervenção imediata.' : risk === 'Alto' ? 'Fator com risco relevante e potencial de dano concreto.' : risk === 'Médio' ? 'Fator requer atenção e monitoramento sistemático.' : 'Fator em nível baixo; monitoramento preventivo recomendado.');
    };

    const sectorLabel = formData.setor === 'Todos' ? 'empresa' : formData.setor;

    // ── Base: Matriz Risco real por setor/tópico (computado antes do resumo) ─
    const RISK_RANK: Record<string, number> = { Baixo: 1, Médio: 2, Alto: 3, Crítico: 4 };

    // Gravidade específica por setor × tópico (evita usar gravidade global no modo Geral)
    const allProbSectorsForReport = Object.keys(allProbValues ?? {}).filter(s => s !== 'Todos');
    const reportSectorSev: Record<string, Record<string, string>> = {};
    if (formData.setor === 'Todos') {
      for (const sec of allProbSectorsForReport) {
        const secResp = responses.filter((r: any) => r.setor === sec).map((r: any) => r.respostas);
        if (secResp.length === 0) continue;
        const secRes = calculateResults(secResp);
        reportSectorSev[sec] = {};
        secRes.forEach((r: any) => { reportSectorSev[sec][r.topic] = r.severity; });
      }
    }

    // Pior Matriz Risco por tópico entre TODOS os setores (modo consolidado)
    const worstRiscoByTopic: Record<string, string> = {};
    let consolidatedWorstRisk = 'Baixo';
    if (formData.setor === 'Todos') {
      results.forEach((r: any) => {
        let worst = '';
        for (const sec of allProbSectorsForReport) {
          const prob: number | undefined = ((allProbValues ?? {})[sec] ?? {})[r.topic];
          if (!prob) continue;
          const sectorSev = reportSectorSev[sec]?.[r.topic];
          if (!sectorSev) continue;
          const matrizR = getMatrizRiscoLocal(sectorSev, prob);
          if (!worst || (RISK_RANK[matrizR] ?? 0) > (RISK_RANK[worst] ?? 0)) worst = matrizR;
        }
        worstRiscoByTopic[r.topic] = worst || '—';
        if (worst && (RISK_RANK[worst] ?? 0) > (RISK_RANK[consolidatedWorstRisk] ?? 0)) {
          consolidatedWorstRisk = worst;
        }
      });
    }

    // ── Funções de resolução de risco ──────────────────────────────────────
    // effectiveRisk: para relatório por setor específico (Gravidade × Prob do setor)
    const effectiveRisk = (r: any): string => {
      const prob: number | undefined = sectorProbs[r.topic];
      return prob ? getMatrizRiscoLocal(r.severity, prob) : r.risk;
    };
    // resolveExecRisk: fonte única para resumo executivo e Seção 6
    const resolveExecRisk = (r: any): string => {
      if (formData.setor === 'Todos') {
        const w = worstRiscoByTopic[r.topic];
        return (w && w !== '—') ? w : 'Baixo';
      }
      return effectiveRisk(r);
    };

    // ── Resumo Executivo ───────────────────────────────────────────────────
    const execRiskCounts: Record<string, number> = { Crítico: 0, Alto: 0, Médio: 0, Baixo: 0 };
    results.forEach((r: any) => {
      const lvl = resolveExecRisk(r);
      execRiskCounts[lvl] = (execRiskCounts[lvl] ?? 0) + 1;
    });

    const worstRiskLevel: string = formData.setor === 'Todos'
      ? consolidatedWorstRisk
      : calcularClassificacaoGeral(
          results.map((r: any) => effectiveRisk(r)),
          RISK_LEVEL_RANK
        );

    const topTopic: any = [...results].sort((a: any, b: any) => {
      const rd = (RISK_RANK[resolveExecRisk(b)] ?? 0) - (RISK_RANK[resolveExecRisk(a)] ?? 0);
      return rd !== 0 ? rd : b.average - a.average;
    })[0];

    const topTopicMatriz: string = formData.setor === 'Todos'
      ? ((worstRiscoByTopic[topTopic?.topic] && worstRiscoByTopic[topTopic?.topic] !== '—')
          ? worstRiscoByTopic[topTopic?.topic]
          : 'Baixo')
      : (sectorProbs[topTopic?.topic]
          ? getMatrizRiscoLocal(topTopic.severity, sectorProbs[topTopic.topic])
          : (topTopic?.risk ?? 'Baixo'));

    // Setor que origina o pior risco do tópico principal (modo Geral — frase Linha 2)
    let worstSectorForTopTopic = '';
    if (formData.setor === 'Todos' && topTopic) {
      for (const sec of allProbSectorsForReport) {
        const prob = ((allProbValues ?? {})[sec] ?? {})[topTopic.topic];
        if (!prob) continue;
        const secSev = reportSectorSev[sec]?.[topTopic.topic];
        if (!secSev) continue;
        if (getMatrizRiscoLocal(secSev, prob) === topTopicMatriz) {
          worstSectorForTopTopic = sec;
          break;
        }
      }
    }

    // Linha 1 — frase de síntese
    const joinParts = (parts: string[]): string =>
      parts.length <= 1 ? (parts[0] ?? '') : parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1];
    const countParts: string[] = [];
    if (execRiskCounts.Crítico > 0) countParts.push(`<strong>${execRiskCounts.Crítico}</strong> fator${execRiskCounts.Crítico > 1 ? 'es' : ''} <strong>Crítico</strong>`);
    if (execRiskCounts.Alto > 0)    countParts.push(`<strong>${execRiskCounts.Alto}</strong> fator${execRiskCounts.Alto > 1 ? 'es' : ''} de <strong>Alto</strong> risco`);
    if (execRiskCounts.Médio > 0)   countParts.push(`<strong>${execRiskCounts.Médio}</strong> fator${execRiskCounts.Médio > 1 ? 'es' : ''} de <strong>Médio</strong> risco`);
    if (execRiskCounts.Baixo > 0)   countParts.push(`<strong>${execRiskCounts.Baixo}</strong> fator${execRiskCounts.Baixo > 1 ? 'es' : ''} de <strong>Baixo</strong> risco`);
    const setorFrase = formData.setor === 'Todos' ? 'na empresa' : `no setor <strong>${sectorLabel}</strong>`;
    const linha1Exec = `Foram identificados ${joinParts(countParts)} ${setorFrase}.`;

    // Linha 2 — fator de maior prioridade
    const useHighPriority = ['Crítico', 'Alto'].includes(topTopicMatriz) || worstRiskLevel === 'Crítico';
    let linha2Exec: string;
    if (worstRiskLevel === 'Baixo' && !useHighPriority) {
      linha2Exec = 'Todos os fatores avaliados apresentam nível Baixo de risco, indicando ambiente psicossocial favorável. Recomenda-se manutenção e monitoramento periódico.';
    } else if (useHighPriority) {
      const sectorNote = (formData.setor === 'Todos' && worstSectorForTopTopic)
        ? `, identificado no setor <strong>${worstSectorForTopTopic}</strong>,` : '';
      const urgency = topTopicMatriz === 'Crítico' ? 'atenção imediata' : 'atenção no curto prazo';
      linha2Exec = `O fator de maior prioridade é <strong>${stripPrefix(topTopic.topic)}</strong> (<strong>${topTopicMatriz}</strong>)${sectorNote} que requer ${urgency}.`;
    } else {
      const sectorNote = (formData.setor === 'Todos' && worstSectorForTopTopic)
        ? `, identificado no setor <strong>${worstSectorForTopTopic}</strong>,` : '';
      linha2Exec = `O fator de maior atenção é <strong>${stripPrefix(topTopic?.topic ?? '')}</strong> (<strong>${topTopicMatriz}</strong>)${sectorNote} que requer monitoramento sistemático.`;
    }

    // Linha 3 — recomendação proporcional ao nível geral
    const LINHA3: Record<string, string> = {
      'Crítico': 'Recomenda-se implementação imediata de medidas estruturais, com definição de responsáveis e prazos formais no Programa de Gerenciamento de Riscos (PGR).',
      'Alto':    'Recomenda-se priorização de intervenções organizacionais no curto prazo, com integração formal ao PGR e monitoramento contínuo.',
      'Médio':   'Recomenda-se monitoramento sistemático e implementação de ações preventivas proporcionais aos fatores identificados.',
      'Baixo':   'Recomenda-se manutenção das condições atuais com reavaliação periódica para prevenir agravamento.',
    };
    const linha3Exec = LINHA3[worstRiskLevel] ?? LINHA3['Baixo'];

    // Nível geral exibido no cabeçalho da Seção 5
    const displayWorstRisk = formData.setor === 'Todos' ? consolidatedWorstRisk : worstRiskLevel;

    // Cor da borda esquerda conforme nível geral (usa displayWorstRisk para consistência)
    const panelBorderColor = displayWorstRisk === 'Crítico' ? '#9C27B0' : displayWorstRisk === 'Alto' ? '#F44336' : displayWorstRisk === 'Médio' ? '#FF9800' : '#4CAF50';


    const getBadgeClass = (risk: string) => {
      if (risk === 'Crítico') return 'bg-critico';
      if (risk === 'Alto') return 'bg-alto';
      if (risk === 'Médio') return 'bg-medio';
      return 'bg-baixo';
    };
    const getTextClass = (risk: string) => {
      if (risk === 'Crítico') return 'text-critico';
      if (risk === 'Alto') return 'text-alto';
      if (risk === 'Médio') return 'text-medio';
      return 'text-baixo';
    };

    const buildSec6Row = (r: any) => {
      let rec = 'Revisão estrutural e capacitação.';
      if (r.topic.includes('Assédio')) rec = 'Implantação imediata de política formal, canal de denúncia sigiloso, afastamento e investigação de casos confirmados.';
      if (/subcarga/i.test(r.topic)) rec = 'Revisão estrutural das atribuições, requalificação de funções e redistribuição de tarefas.';
      if (/sobrecarga/i.test(r.topic)) rec = 'Revisão de atribuições, adequação de jornada e dimensionamento de equipe.';
      if (/justiça/i.test(r.topic)) rec = 'Revisão e publicação dos critérios de avaliação, promoção e desligamento; ouvidoria interna.';
      if (/relacionamento/i.test(r.topic)) rec = 'Mediação profissional e treinamento em comunicação não violenta para toda a liderança.';
      if (/remoto/i.test(r.topic)) rec = 'Criação de rotina estruturada de reuniões, canais formais de escuta e apoio à saúde mental.';
      if (/mudança/i.test(r.topic)) rec = 'Plano de comunicação estruturado para mudanças e apoio de RH nas transições.';
      if (/recompensas/i.test(r.topic)) rec = 'Treinamento de lideranças em feedback e valorização.';
      const matrizRisk = resolveExecRisk(r);
      const prazo = matrizRisk === 'Crítico' ? '30 dias' : matrizRisk === 'Alto' ? '60 dias' : matrizRisk === 'Médio' ? '90 dias' : 'Monitoramento periódico';
      return `<tr><td><strong>${stripPrefix(r.topic)}</strong></td><td><span class="${getTextClass(matrizRisk)}">${matrizRisk}</span></td><td style="font-size:11px;">${getSyntheticDesc(r.topic, matrizRisk)}</td><td>${rec}</td><td>Diretoria / RH</td><td class="${getTextClass(matrizRisk)}" style="font-weight:700;white-space:nowrap;">${prazo}</td></tr>`;
    };
    const sorted06 = [...results].sort((a: any, b: any) => b.average - a.average);
    const sec6Half = Math.ceil(sorted06.length / 2);
    const sec6RowsA = sorted06.slice(0, sec6Half).map(buildSec6Row).join('');
    const sec6RowsB = sorted06.slice(sec6Half).map(buildSec6Row).join('');

    // ── Conclusão dinâmica ────────────────────────────────────────────────────
    const topicsByLevel: Record<string, string[]> = { Crítico: [], Alto: [], Médio: [], Baixo: [] };
    results.forEach((r: any) => {
      const lvl = resolveExecRisk(r);
      topicsByLevel[lvl]?.push(stripPrefix(r.topic));
    });

    const conclusionParas: string[] = [];
    const plu = (n: number, s: string, p: string) => n === 1 ? s : p;

    if (topicsByLevel['Crítico'].length > 0) {
      const n = topicsByLevel['Crítico'].length;
      conclusionParas.push(
        `Foram identificados <strong>${n} ${plu(n,'fator classificado','fatores classificados')} como Crítico</strong> ` +
        `— <em>${topicsByLevel['Crítico'].join(', ')}</em> — ` +
        `que requerem priorização máxima de medidas estruturadas, com definição clara de responsáveis, ` +
        `prazos e indicadores de acompanhamento, integrando-se formalmente ao Programa de Gerenciamento de Riscos (PGR).`
      );
    }
    if (topicsByLevel['Alto'].length > 0) {
      const n = topicsByLevel['Alto'].length;
      conclusionParas.push(
        `Foram identificados <strong>${n} ${plu(n,'fator com classificação Alto','fatores com classificação Alto')}</strong> ` +
        `— <em>${topicsByLevel['Alto'].join(', ')}</em> — ` +
        `que demandam atenção prioritária e implementação de medidas preventivas estruturadas no curto prazo.`
      );
    }
    if (topicsByLevel['Médio'].length > 0) {
      const n = topicsByLevel['Médio'].length;
      conclusionParas.push(
        `${plu(n,'O','Os')} <strong>${n} ${plu(n,'fator classificado','fatores classificados')} como Médio</strong> ` +
        `${plu(n,'indica necessidade','indicam necessidade')} de monitoramento sistemático e possíveis intervenções preventivas.`
      );
    }
    if (topicsByLevel['Baixo'].length > 0) {
      const n = topicsByLevel['Baixo'].length;
      conclusionParas.push(
        `${plu(n,'O','Os')} <strong>${n} ${plu(n,'fator classificado','fatores classificados')} como Baixo</strong> ` +
        `${plu(n,'deve permanecer','devem permanecer')} sob acompanhamento periódico como medida de vigilância continuada.`
      );
    }
    if (topicsByLevel['Crítico'].length === 0 && topicsByLevel['Alto'].length === 0 && topicsByLevel['Médio'].length === 0) {
      conclusionParas.push(
        `O diagnóstico não identificou fatores de risco em níveis elevados, o que representa um resultado favorável. ` +
        `Recomenda-se manter o monitoramento periódico para preservar esse cenário.`
      );
    }
    const conclusionText = conclusionParas.map(p => `<p>${p}</p>`).join('\n    ');

    const sanitizeFilename = (s: string) => s.replace(/[/\\:*?"<>|]/g, '');
    const fileNome = sanitizeFilename(company.nome);
    const fileSetor = sanitizeFilename(formData.setor === 'Todos' ? 'Geral' : formData.setor);

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório DRPS - ${company.nome}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Open Sans', sans-serif; color: #1a1612; background: white; font-size: 13px; line-height: 1.7; }
  .page { max-width: 900px; margin: 0 auto; padding: 0; }
  .capa { background: #111; min-height: 1273px; display: flex; flex-direction: column; justify-content: flex-end; padding: 60px; position: relative; page-break-after: always; }
  .capa-overlay { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(29,78,107,0.85) 0%, rgba(0,0,0,0.7) 100%); }
  .capa-tri1 { position: absolute; top: 0; right: 0; width: 0; height: 0; border-style: solid; border-width: 0 300px 300px 0; border-color: transparent #c8ae6a transparent transparent; opacity: 0.8; }
  .capa-tri2 { position: absolute; top: 0; right: 0; width: 0; height: 0; border-style: solid; border-width: 0 200px 500px 0; border-color: transparent #1d4e6b transparent transparent; opacity: 0.6; }
  .capa-content { position: relative; z-index: 2; }
  .capa h1 { font-family: 'Merriweather', serif; font-size: 48px; font-weight: 700; color: white; line-height: 1.1; margin-bottom: 12px; }
  .capa h2 { font-family: 'Open Sans', sans-serif; font-size: 18px; font-weight: 400; color: rgba(255,255,255,0.75); margin-bottom: 48px; }
  .capa-drps { font-family: 'Merriweather', serif; font-size: 80px; font-weight: 700; color: white; margin-bottom: 40px; }
  .capa-meta { border-top: 2px solid #c8ae6a; padding-top: 24px; display: flex; flex-direction: column; gap: 8px; }
  .capa-meta-item { font-size: 13px; color: rgba(255,255,255,0.8); }
  .capa-meta-item strong { color: white; font-weight: 700; }
  .sumario { padding: 60px; page-break-after: always; border-bottom: 4px solid #c8ae6a; }
  .sumario h2 { font-family: 'Merriweather', serif; font-size: 26px; color: #1d4e6b; margin-bottom: 28px; text-decoration: underline; text-underline-offset: 6px; }
  .sumario ol { padding-left: 20px; }
  .sumario li { padding: 6px 0; font-size: 14px; color: #1a1612; font-weight: 600; }
  .secao { padding: 48px 60px; border-bottom: 1px solid #e8e4de; }
  .secao-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 3px solid #c8ae6a; }
  .secao-num { background: #1d4e6b; color: white; font-size: 13px; font-weight: 700; padding: 6px 12px; border-radius: 6px; }
  .secao-title { font-family: 'Merriweather', serif; font-size: 20px; color: #1d4e6b; }
  .secao p { margin-bottom: 14px; text-align: justify; font-size: 13px; line-height: 1.8; }
  .sub-header { font-size: 13px; font-weight: 700; color: #1d4e6b; margin: 16px 0 8px; }
  .topicos-list { list-style: none; padding: 0; margin: 0 0 16px; }
  .topicos-list li { padding: 3px 0; font-size: 13px; color: #333; }
  .fluxo { display: flex; gap: 0; margin: 24px 0; }
  .fluxo-step { flex: 1; padding: 16px 12px; text-align: center; background: #1d4e6b; color: white; position: relative; }
  .fluxo-step:not(:last-child)::after { content: '▶'; position: absolute; right: -12px; top: 50%; transform: translateY(-50%); color: #c8ae6a; font-size: 18px; z-index: 10; }
  .fluxo-step:nth-child(even) { background: #c8ae6a; }
  .fluxo-icon { font-size: 22px; margin-bottom: 6px; }
  .fluxo-label { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; line-height: 1.3; }
  .painel-resumo { background: #f8f7f4; border: 1px solid #e8e4de; border-radius: 10px; padding: 24px; margin: 20px 0; text-align: center; }
  .painel-resumo h4 { font-family: 'Merriweather', serif; font-size: 15px; color: #1d4e6b; margin-bottom: 20px; text-align: left; }
  .assinatura { text-align: center; padding: 40px 0 20px; }
  .assinatura .linha { width: 280px; height: 2px; background: #1d4e6b; margin: 0 auto 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
  th { background: #f8f6f2; color: #1d4e6b; font-size: 11px; padding: 10px; text-align: left; border-bottom: 2px solid #e8e4de; font-weight: 700; }
  td { font-size: 12px; padding: 10px; border-bottom: 1px solid #e8e4de; vertical-align: top; }
  .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .bg-critico { background: #fee2e2; color: #b91c1c; }
  .bg-alto { background: #ffedd5; color: #c2410c; }
  .bg-medio { background: #fef3c7; color: #b45309; }
  .bg-baixo { background: #dcfce7; color: #15803d; }
  .text-critico { color: #b91c1c; font-weight: 700; }
  .text-alto { color: #c2410c; font-weight: 700; }
  .text-medio { color: #b45309; font-weight: 700; }
  .text-baixo { color: #15803d; font-weight: 700; }
  #dl-btn { position: fixed; bottom: 24px; right: 24px; background: #1d4e6b; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); z-index: 999; transition: opacity 0.2s; }
  #dl-btn:disabled { opacity: 0.6; cursor: wait; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
</head>
<body>
<button id="dl-btn" onclick="downloadPDF()">📥 Baixar PDF</button>
<script>
async function downloadPDF() {
  var btn = document.getElementById('dl-btn');
  btn.textContent = '⏳ Gerando...';
  btn.disabled = true;
  window.scrollTo(0, 0);
  await new Promise(function(r){setTimeout(r,400);});
  btn.style.display = 'none';
  try {
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({orientation:'p',unit:'mm',format:'a4'});
    var pW = pdf.internal.pageSize.getWidth();
    var pH = pdf.internal.pageSize.getHeight();
    var sections = Array.from(document.querySelectorAll('.page > *'));
    var canvases = [];
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var bg = sec.classList.contains('capa') ? '#111111' : '#ffffff';
      var c = await html2canvas(sec, {
        scale:2, useCORS:true, allowTaint:true, logging:false,
        backgroundColor:bg, scrollX:0, scrollY:0, imageTimeout:0
      });
      canvases.push({canvas:c, h:(c.height/c.width)*pW});
    }
    btn.style.display = '';
    var pageY = 0;
    var firstPage = true;
    for (var j = 0; j < canvases.length; j++) {
      var cv = canvases[j].canvas;
      var secH = canvases[j].h;
      var img = cv.toDataURL('image/jpeg',0.95);
      if (secH > pH) {
        if (pageY > 1 && !firstPage) { pdf.addPage(); pageY = 0; }
        var ratio = cv.width / pW;
        var oy = 0, p = 0;
        while (oy < secH) {
          if (p > 0) pdf.addPage();
          var srcY = oy * ratio;
          var srcH = Math.min(pH * ratio, cv.height - srcY);
          var sl = document.createElement('canvas');
          sl.width = cv.width; sl.height = Math.ceil(srcH);
          sl.getContext('2d').drawImage(cv,0,srcY,cv.width,srcH,0,0,cv.width,srcH);
          pdf.addImage(sl.toDataURL('image/jpeg',0.95),'JPEG',0,0,pW,srcH/ratio);
          oy += pH; p++;
        }
        pageY = secH % pH;
        firstPage = false;
      } else if (!firstPage && pageY + secH > pH) {
        pdf.addPage();
        pdf.addImage(img,'JPEG',0,0,pW,secH);
        pageY = secH;
      } else {
        pdf.addImage(img,'JPEG',0,firstPage?0:pageY,pW,secH);
        pageY = (firstPage ? 0 : pageY) + secH;
        firstPage = false;
      }
    }
    pdf.save('Relatório DRPS - ${fileNome} - ${fileSetor}.pdf');
  } catch(e) {
    btn.style.display = '';
    alert('Erro ao gerar PDF: ' + e.message);
  }
  btn.textContent = '📥 Baixar PDF';
  btn.disabled = false;
}
</script>
<div class="page">
  <div class="capa">
    <div class="capa-overlay"></div><div class="capa-tri2"></div><div class="capa-tri1"></div>
    <div class="capa-content">
      <div class="capa-drps">DRPS</div>
      <h1>DIAGNÓSTICO DE<br>RISCOS<br>PSICOSSOCIAIS</h1>
      <h2>RELATÓRIO</h2>
      <div class="capa-meta">
        <div class="capa-meta-item">EMPRESA<br><strong>${company.nome}</strong></div>
        <div class="capa-meta-item" style="margin-top:16px;">CNPJ: <strong>${formData.cnpj || 'Não informado'}</strong></div>
        <div class="capa-meta-item">Psicólogo(a) Elaborador(a): <strong>${formData.psicologo || profile?.full_name || 'Não informado'}</strong> | CRP: <strong>${formData.crp || 'Não informado'}</strong></div>
        <div class="capa-meta-item">Data de Elaboração: <strong>${new Date().toLocaleDateString('pt-BR')}</strong></div>
        <div class="capa-meta-item">Competência: <strong>${formData.mesAno}</strong></div>
      </div>
    </div>
  </div>

  <div class="sumario">
    <h2>Conteúdo do Relatório</h2>
    <ol><li>Introdução</li><li>Objetivo</li><li>Metodologia</li><li>Fluxo de Aplicação do DRPS</li><li>Análises e Resultados</li><li>Medidas de Prevenção</li><li>Conclusão</li><li>Referências</li></ol>
  </div>

  <div class="secao">
    <div class="secao-header"><span class="secao-num">01</span><h3 class="secao-title">Introdução</h3></div>
    <p>A gestão dos fatores de riscos psicossociais integra o Gerenciamento de Riscos Ocupacionais previsto na NR 01, exigindo das organizações a identificação, avaliação e controle das condições de trabalho que possam impactar a saúde mental dos trabalhadores.</p>
    <p>Os riscos psicossociais compreendem aspectos relacionados à organização do trabalho, às exigências produtivas, às relações interpessoais, à liderança, ao reconhecimento, à comunicação e às condições estruturais do ambiente organizacional.</p>
    <p>O presente relatório apresenta os resultados do DRPS aplicado na organização <strong>${company.nome}</strong>, contemplando <strong>${targetResponses.length} colaborador(es)</strong> respondente(s)${formData.setor !== 'Todos' ? `, no(s) setor(es): <strong>${formData.setor}</strong>` : ''}.</p>
  </div>

  <div class="secao">
    <div class="secao-header"><span class="secao-num">02</span><h3 class="secao-title">Objetivo</h3></div>
    <p>Este relatório tem por objetivo estruturar e sistematizar a análise dos fatores de riscos psicossociais identificados na organização avaliada, classificando-os conforme gravidade e probabilidade de ocorrência, de modo a subsidiar a tomada de decisão e a integração dos resultados ao PGR.</p>
    <p>A análise considera as particularidades da organização <strong>${company.nome}</strong>, com período de referência: <strong>${formData.mesAno}</strong>.</p>
  </div>

  <div class="secao">
    <div class="secao-header"><span class="secao-num">03</span><h3 class="secao-title">Metodologia</h3></div>
    <p>A metodologia empregada fundamenta-se em referenciais consolidados da psicodinâmica do trabalho, estudos sobre estresse ocupacional e diretrizes normativas nacionais e internacionais. O DRPS é instrumento técnico de rastreamento organizacional, não clínico individual. A coleta foi realizada em formato digital, com anonimato e confidencialidade conforme a LGPD. O instrumento é composto por <strong>${QUESTIONS.length} questões</strong> distribuídas em ${results.length} eixos temáticos:</p>
    <ol class="topicos-list" style="list-style:decimal;padding-left:20px;">
      <li>Assédio de qualquer natureza no trabalho</li>
      <li>Falta de suporte/apoio no trabalho</li>
      <li>Má gestão de mudanças organizacionais</li>
      <li>Baixa clareza de papel/função</li>
      <li>Baixas recompensas e reconhecimento</li>
      <li>Baixo controle no trabalho / Falta de autonomia</li>
      <li>Baixa justiça organizacional</li>
      <li>Eventos violentos ou traumáticos</li>
      <li>Baixa demanda no trabalho (Subcarga)</li>
      <li>Excesso de demandas no trabalho (Sobrecarga)</li>
      <li>Maus relacionamentos no local de trabalho</li>
      <li>Trabalho em condições de difícil comunicação</li>
      <li>Trabalho remoto e isolado</li>
    </ol>
    <p class="sub-header">Escalas e Questionários Utilizados:</p>
    <p>• <strong>Escala de Gravidade e Probabilidade:</strong> para cada risco psicossocial, a gravidade e a probabilidade de ocorrência são avaliadas conforme a escala NR 01. A gravidade é determinada pela pontuação média dos colaboradores; a probabilidade considera a frequência percebida, o histórico do risco e os recursos disponíveis para mitigação.</p>
    <p>• <strong>Questionários Padrão:</strong> foram utilizados questionários validados com base em modelos reconhecidos pela OMS e INSS, abordando dimensões como assédio, sobrecarga, metas, autonomia e relações interpessoais.</p>
    <p class="sub-header">Critérios para análise qualitativa:</p>
    <p>• <strong>Frequência:</strong> frequência percebida de cada risco no setor (Baixa, Média, Alta).</p>
    <p>• <strong>Histórico:</strong> histórico de ocorrências do risco no setor (Sim, Não, Frequente).</p>
    <p>• <strong>Recursos disponíveis:</strong> recursos da empresa para mitigar os riscos (Adequados, Insuficientes, Não existentes).</p>
    <p>Esses critérios classificam a probabilidade de ocorrência de cada fator de risco. As médias obtidas pelos questionários são classificadas conforme a matriz de risco da NR 01, garantindo uma análise integrada, rastreável e tecnicamente fundamentada.</p>
    <p>As respostas foram registradas em escala Likert de 0 a 4 (0 = Nunca; 4 = Sempre) para as ${QUESTIONS.length} questões do instrumento. Itens protetivos foram corrigidos por lógica invertida (4 − valor bruto). Gravidade: Baixa (≤1,66), Média (≤2,32), Alta (>2,32).</p>
    <table>
      <thead><tr><th>Probabilidade \\ Gravidade</th><th>Baixa</th><th>Média</th><th>Alta</th></tr></thead>
      <tbody>
        <tr><td><strong>Baixa</strong></td><td>Baixo</td><td>Baixo</td><td class="text-medio">Médio</td></tr>
        <tr><td><strong>Média</strong></td><td>Baixo</td><td class="text-medio">Médio</td><td class="text-alto">Alto</td></tr>
        <tr><td><strong>Alta</strong></td><td class="text-medio">Médio</td><td class="text-alto">Alto</td><td class="text-critico">Crítico</td></tr>
      </tbody>
    </table>
  </div>

  <div class="secao">
    <div class="secao-header"><span class="secao-num">04</span><h3 class="secao-title">Fluxo de Aplicação do DRPS</h3></div>
    <p>A aplicação do DRPS seguiu fluxo técnico estruturado, garantindo consistência metodológica e adequação às diretrizes do GRO. Inicialmente foi realizado alinhamento com <strong>${company.nome}</strong>, com definição dos setores e período. Na sequência, procedeu-se à aplicação com ${targetResponses.length} respondente(s). Os dados foram consolidados e a classificação gerada via matriz NR-01.</p>
    <div class="fluxo">
      <div class="fluxo-step"><div class="fluxo-icon">🤝</div><div class="fluxo-label">Alinhamento<br>Inicial</div></div>
      <div class="fluxo-step"><div class="fluxo-icon">📋</div><div class="fluxo-label">Coleta de<br>Dados</div></div>
      <div class="fluxo-step"><div class="fluxo-icon">🔍</div><div class="fluxo-label">Análise<br>Integrada</div></div>
      <div class="fluxo-step"><div class="fluxo-icon">📊</div><div class="fluxo-label">Classificação<br>de Risco</div></div>
      <div class="fluxo-step"><div class="fluxo-icon">📄</div><div class="fluxo-label">Relatório<br>Técnico</div></div>
    </div>
    <p>A excelência da metodologia aplicada no DRPS fundamenta-se na integração estruturada entre análise quantitativa e qualitativa, alinhada às diretrizes da NR 01 e aos parâmetros do Gerenciamento de Riscos Ocupacionais.</p>
    <p>Ao combinar mensuração objetiva por meio de escala padronizada com interpretação técnica contextual realizada por profissional habilitado, o instrumento permite não apenas identificar a presença de fatores de risco, mas compreender sua dinâmica organizacional, intensidade e impacto potencial.</p>
    <p>A utilização da matriz de risco para classificação final assegura coerência com critérios normativos e favorece a priorização proporcional das intervenções. Tal estrutura metodológica confere rastreabilidade, consistência técnica e aplicabilidade prática aos resultados, fortalecendo sua utilização como ferramenta estratégica de gestão em saúde mental organizacional.</p>
  </div>

  <div class="secao">
    <div class="secao-header"><span class="secao-num">05</span><h3 class="secao-title">Análises e Resultados</h3></div>
    <p>A seguir, apresentam-se os resultados obtidos com descrição integrada dos dados quantitativos e análise qualitativa.</p>
    <p><strong>Total de respondentes:</strong> ${targetResponses.length} &nbsp;|&nbsp; <strong>Setor(es):</strong> ${formData.setor} &nbsp;|&nbsp; <strong>Nível Geral:</strong> <span class="badge ${getBadgeClass(displayWorstRisk)}">${displayWorstRisk}</span></p>
    ${targetResponses.length < 5 ? `<div style="border-left:4px solid #FF9800;background:#FFF8E1;padding:10px 14px;margin:10px 0;border-radius:0 4px 4px 0;font-size:12px;color:#7B4A00;">
      <strong>⚠ Aviso — Amostra Reduzida:</strong> Este relatório foi gerado com apenas <strong>${targetResponses.length} respondente(s)</strong>. Amostras inferiores a 5 participantes têm validade estatística limitada. Os resultados devem ser interpretados com cautela e, preferencialmente, complementados com análise qualitativa.
    </div>` : ''}
    <table>
      <thead><tr><th>FATOR DE RISCO</th><th>FONTES GERADORAS</th><th>GRAVIDADE</th>${formData.setor === 'Todos' ? '<th>PIOR RISCO ENTRE SETORES</th>' : '<th>PROBABILIDADE</th><th>MATRIZ RISCO</th>'}</tr></thead>
      <tbody>
        ${[...results].sort((a:any,b:any) => b.average - a.average).map((r:any) => {
          let fontes = 'Condições estruturais e de gestão.';
          if (r.topic.includes('Assédio')) fontes = 'Cultura permissiva; ausência de canal de denúncia; liderança despreparada.';
          if (/subcarga/i.test(r.topic)) fontes = 'Subutilização de competências; ociosidade; funções pouco desafiadoras.';
          if (/sobrecarga/i.test(r.topic)) fontes = 'Metas irrealistas; jornadas prolongadas; acúmulo de funções.';
          if (/mudança/i.test(r.topic)) fontes = 'Comunicação inadequada; mudanças abruptas; falta de acompanhamento.';
          if (/justiça/i.test(r.topic)) fontes = 'Critérios pouco transparentes; favorecimento; desigualdade de tratamento.';
          if (/relacionamento/i.test(r.topic)) fontes = 'Comunicação agressiva; conflitos mal geridos; rivalidade interna.';
          if (/suporte/i.test(r.topic)) fontes = 'Liderança ausente; falta de escuta; cobrança sem acompanhamento.';
          const gravClass = riskToClass(r.risk);
          if (formData.setor === 'Todos') {
            const worstR = worstRiscoByTopic[r.topic] ?? '—';
            const worstClass = worstR !== '—' ? riskToClass(worstR) : '';
            return `<tr><td><strong>${stripPrefix(r.topic)}</strong></td><td>${fontes}</td><td><span class="${gravClass}">${r.severity}</span></td><td><span class="${worstClass}">${worstR}</span></td></tr>`;
          }
          const probVal: number | undefined = sectorProbs[r.topic];
          const probStr = probVal ? localProbLabel(probVal) : '—';
          const matrizStr = probVal ? getMatrizRiscoLocal(r.severity, probVal) : '—';
          const probClass = probVal ? (probStr === 'Alta' ? 'text-critico' : probStr === 'Média' ? 'text-medio' : 'text-baixo') : '';
          const matrizClass = matrizStr !== '—' ? riskToClass(matrizStr) : 'text-slate-400';
          return `<tr><td><strong>${stripPrefix(r.topic)}</strong></td><td>${fontes}</td><td><span class="${gravClass}">${r.severity}</span></td><td><span class="${probClass}">${probStr}</span></td><td><span class="${matrizClass}">${matrizStr}</span></td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="secao">
    <div class="secao-header"><span class="secao-num">06</span><h3 class="secao-title">Medidas de Prevenção e Recomendações Técnicas</h3></div>
    <p>Com base na classificação dos fatores identificados, torna-se necessária a implementação de medidas preventivas proporcionais ao nível de exposição. As recomendações priorizam intervenções organizacionais estruturais antes de ações exclusivamente individuais.</p>
    <table>
      <thead><tr><th>FATOR DE RISCO</th><th>CLASSIF.</th><th>DESCRIÇÃO SINTÉTICA DO PROBLEMA</th><th>MEDIDA PREVENTIVA RECOMENDADA</th><th>RESPONSÁVEL</th><th>PRAZO</th></tr></thead>
      <tbody>${sec6RowsA}</tbody>
    </table>
  </div>

  <div class="secao">
    <div class="secao-header" style="opacity:0.6;"><span class="secao-num">06</span><h3 class="secao-title">Medidas de Prevenção — continuação</h3></div>
    <table>
      <thead><tr><th>FATOR DE RISCO</th><th>CLASSIF.</th><th>DESCRIÇÃO SINTÉTICA DO PROBLEMA</th><th>MEDIDA PREVENTIVA RECOMENDADA</th><th>RESPONSÁVEL</th><th>PRAZO</th></tr></thead>
      <tbody>${sec6RowsB}</tbody>
    </table>
    <p style="font-size:11px;color:#666;font-style:italic;">Os prazos indicados são referências técnicas. Recomenda-se que a empresa defina prazos e responsáveis formais no PGR.</p>
  </div>

  <div class="secao">
    <div class="secao-header"><span class="secao-num">07</span><h3 class="secao-title">Conclusão</h3></div>
    <p>A análise realizada evidencia que os fatores de riscos psicossociais identificados na organização demandam atenção técnica proporcional à sua classificação final.</p>
    ${conclusionText}
    <p>Recomenda-se que a organização adote plano de ação estruturado contemplando intervenções em nível organizacional (estrutura e processos), relacional (liderança e clima) e individual (apoio e orientação), conforme a natureza dos fatores identificados.</p>
    <p>Ressalta-se que a avaliação representa um recorte temporal específico, baseado em autorrelato e análise técnica contextual, sendo recomendável a reavaliação periódica para monitoramento contínuo dos fatores psicossociais.</p>
    <div class="assinatura">
      <div class="linha"></div>
      <p><strong>${formData.psicologo || profile?.full_name || 'Assinatura do Responsável'}</strong><br>Psicólogo(a) Responsável Técnico(a)<br>CRP: ${formData.crp || 'N/A'}<br>${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>

  <div class="secao">
    <div class="secao-header"><span class="secao-num">08</span><h3 class="secao-title">Referências</h3></div>
    <p>1. BRASIL. Ministério do Trabalho e Emprego. NR 01 – Disposições Gerais e Gerenciamento de Riscos Ocupacionais. Portaria MTP nº 6.730, de 9 de março de 2023.</p>
    <p>2. BRASIL. Ministério do Trabalho e Emprego. Guia de informações sobre os fatores de riscos psicossociais relacionados ao trabalho. Brasília: MTE, 2023.</p>
    <p>3. INTERNACIONAL LABOUR OFFICE (ILO). Psychosocial risks at work: recognition and prevention. Geneva: ILO, 2016.</p>
    <p>4. BRASIL. Ministério da Saúde. Protocolo de enfrentamento dos fatores psicossociais no trabalho. Brasília: MS, 2021.</p>
    <p>5. FERREIRA, M. C.; MILANI, R. G. Fatores psicossociais no trabalho: conceitos, metodologias e aplicações. São Paulo: Casa do Psicólogo, 2020.</p>
    <p>6. DEJOURS, C. A banalização da injustiça social. 5. ed. Rio de Janeiro: FGV, 2016.</p>
    <p>7. ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS (ABNT). NBR ISO 10075-1: Princípios ergonômicos relacionados à carga de trabalho mental. Rio de Janeiro: ABNT, 2013.</p>
    <p>8. HSE – HEALTH AND SAFETY EXECUTIVE. Management Standards for work-related stress. London: HSE, 2007.</p>
    <p>9. ITRA. Avaliação de Riscos Psicossociais: Instrumento de Triagem de Riscos Psicossociais no Trabalho. São Paulo: ITRA, 2015.</p>
    <p>10. RODRIGUES, A. C.; TAMAYO, A. Estresse no trabalho e riscos psicossociais: uma revisão integrativa. Revista Psicologia: Teoria e Prática, São Paulo, v. 22, n. 1, p. 80-101, 2020.</p>
    <p>11. INTERNATIONAL ORGANIZATION FOR STANDARDIZATION. ISO 45001:2018 – Occupational health and safety management systems. Geneva: ISO, 2018.</p>
    <p>12. MASLACH, C.; SCHAUFELI, W. B.; LEITER, M. P. Job burnout. Annual Review of Psychology, v. 52, p. 397–422, 2001.</p>
    <p>13. DEJOURS, C. A loucura do trabalho: estudo de psicopatologia do trabalho. 5. ed. São Paulo: Cortez, 1992.</p>
    <p>14. DEJOURS, C. Subjetividade, trabalho e ação. Revista Produção, v. 14, n. 3, p. 27–34, 2004.</p>
  </div>
</div>
</body>
</html>`;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    } else {
      alert("Por favor, permita pop-ups neste site para abrir o relatório.");
    }
  };


  return (
    <div className="max-w-2xl space-y-6 animate-in fade-in">
      <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex gap-4">
        <FileText className="text-emerald-500 shrink-0" />
        <div>
          <h4 className="text-sm font-bold text-emerald-800 mb-1">Geração de Relatório em PDF</h4>
          <p className="text-xs text-emerald-700/80 leading-relaxed">
            Gera e baixa automaticamente o relatório completo em PDF com Introdução, Metodologia, Análises, Medidas de Prevenção, Painel de Gráficos e Referências.
          </p>
        </div>
      </div>

      <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-200">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CNPJ</label><input type="text" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-primary" placeholder="00.000.000/0001-00" /></div>
          <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mês/Ano Competência</label><input type="text" value={formData.mesAno} onChange={e => setFormData({...formData, mesAno: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-primary" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Psicólogo(a) Responsável</label><input type="text" value={formData.psicologo} onChange={e => setFormData({...formData, psicologo: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-primary" placeholder="Nome Completo" /></div>
          <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Registro CRP</label><input type="text" value={formData.crp} onChange={e => setFormData({...formData, crp: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-primary" placeholder="00/00000" /></div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Escopo do Relatório (Setor)</label>
          <select value={formData.setor} onChange={e => setFormData({...formData, setor: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-primary">
            <option value="Todos">Visão Global (Todos os Setores)</option>
            {uniqueSectors.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        
        <div className="pt-4">
          <button onClick={handleGenerate} className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-lg">
            <Download size={18} /> Baixar Relatório PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCompanyReport;