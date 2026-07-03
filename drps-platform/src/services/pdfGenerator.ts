import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateResults } from './riskCalculator';

const stripTopicPrefix = (topic: string): string =>
  topic.replace(/^Tópico\s+\d+\s+-\s+/i, '');

function drawDonutChart(
  segments: { label: string; value: number; color: string }[],
  title: string
): string {
  const W = 300, H = 310;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const total = segments.reduce((s, d) => s + d.value, 0);
  const cx = W / 2, cy = 118;
  const rOuter = 96, rInner = Math.round(rOuter * 0.54);

  if (total > 0) {
    let a = -Math.PI / 2;
    for (const seg of segments) {
      if (!seg.value) continue;
      const sweep = (seg.value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rOuter, a, a + sweep);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      a += sweep;
    }
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, 2 * Math.PI);
    ctx.fillStyle = '#eeeeee';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#444';
  ctx.font = 'bold 26px Arial';
  ctx.fillText(String(total), cx, cy - 5);
  ctx.font = '13px Arial';
  ctx.fillStyle = '#aaa';
  ctx.fillText('fatores', cx, cy + 14);

  const active = segments.filter(s => s.value > 0);
  let ly = cy + rOuter + 18;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '13px Arial';
  for (const seg of active) {
    const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
    ctx.fillStyle = seg.color;
    ctx.fillRect(14, ly - 11, 11, 11);
    ctx.fillStyle = '#555';
    ctx.textAlign = 'left';
    ctx.fillText(`${seg.label}: ${pct}% (${seg.value})`, 30, ly);
    ly += 17;
  }

  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = '#2d3748';
  ctx.textAlign = 'center';
  const maxW = W - 20;
  let l1 = '', l2 = '';
  for (const word of title.split(' ')) {
    const test = l1 ? `${l1} ${word}` : word;
    if (ctx.measureText(test).width <= maxW) l1 = test;
    else l2 = l2 ? `${l2} ${word}` : word;
  }
  ctx.fillText(l1, cx, H - (l2 ? 20 : 8));
  if (l2) ctx.fillText(l2, cx, H - 5);

  return canvas.toDataURL('image/png');
}

const SYNTHETIC: Record<string, Record<string, string>> = {
  'Assédio de qualquer natureza no trabalho': {
    'Crítico': 'Comportamentos abusivos graves com risco imediato à integridade dos colaboradores.',
    'Alto': 'Ocorrências relevantes de assédio impactam o ambiente. Política formal e canal de denúncia são essenciais.',
    'Médio': 'Percepção moderada de condutas inadequadas. Monitoramento ativo e ações educativas necessários.',
    'Baixo': 'Baixa incidência percebida; monitoramento para consolidar cultura de respeito.',
  },
  'Falta de suporte/apoio no trabalho': {
    'Crítico': 'Ausência crítica de suporte gera isolamento e risco elevado de adoecimento coletivo.',
    'Alto': 'Deficiência significativa de apoio comprometendo saúde mental e desempenho.',
    'Médio': 'Suporte percebido como insuficiente. Atenção à liderança empática e cultura de acolhimento.',
    'Baixo': 'Suporte razoavelmente presente; monitorar para garantir acolhimento a todos.',
  },
  'Má gestão de mudanças organizacionais': {
    'Crítico': 'Mudanças mal gerenciadas geram insegurança generalizada e risco elevado de adoecimento.',
    'Alto': 'Gestão de mudanças ineficiente com impacto na estabilidade emocional da equipe.',
    'Médio': 'Processos de mudança com comunicação parcial. Estratégias formais são necessárias.',
    'Baixo': 'Impacto moderado de mudanças; monitoramento preventivo do clima recomendado.',
  },
  'Baixa clareza de papel/função': {
    'Crítico': 'Ausência de definição clara de papéis gera conflitos graves e estresse elevado.',
    'Alto': 'Ambiguidade de funções relevante, causando sobrecarga e insegurança na equipe.',
    'Médio': 'Clareza insuficiente em situações específicas; revisão de atribuições necessária.',
    'Baixo': 'Clareza adequada com oportunidades de melhoria no alinhamento de expectativas.',
  },
  'Baixas recompensas e reconhecimento': {
    'Crítico': 'Ausência crítica de reconhecimento com impacto severo na motivação e risco de burnout.',
    'Alto': 'Déficit significativo de valorização profissional; riscos de desmotivação crônica.',
    'Médio': 'Reconhecimento insuficiente percebido; atenção ao estilo de liderança e feedback.',
    'Baixo': 'Nível aceitável de reconhecimento com oportunidades de melhoria nas práticas de valorização.',
  },
  'Baixo controle no trabalho / Falta de autonomia': {
    'Crítico': 'Controle excessivo compromete gravemente o bem-estar e a competência percebida.',
    'Alto': 'Baixa autonomia com impacto direto na motivação, criatividade e saúde psicológica.',
    'Médio': 'Autonomia parcialmente restrita; revisão dos processos de supervisão recomendada.',
    'Baixo': 'Nível de controle equilibrado; monitorar para prevenir microgerenciamento.',
  },
  'Baixa justiça organizacional': {
    'Crítico': 'Percepção crítica de injustiça com risco elevado de desengajamento e adoecimento.',
    'Alto': 'Sentimento relevante de desigualdade comprometendo a confiança institucional.',
    'Médio': 'Percepção moderada de injustiça; transparência nos processos decisórios requer atenção.',
    'Baixo': 'Percepção de equidade razoável; monitoramento preventivo para manter a confiança.',
  },
  'Eventos violentos ou traumáticos': {
    'Crítico': 'Exposição a eventos traumáticos graves; intervenção psicológica imediata necessária.',
    'Alto': 'Ocorrências traumáticas com impacto real na saúde mental; suporte especializado prioritário.',
    'Médio': 'Histórico de eventos adversos; protocolos de acolhimento e suporte são necessários.',
    'Baixo': 'Baixa ocorrência; manter canal de apoio psicológico e protocolos de prevenção ativos.',
  },
  'Baixa demanda no trabalho (Subcarga)': {
    'Crítico': 'Subcarga severa com risco de adoecimento por subutilização e perda de sentido.',
    'Alto': 'Subutilização relevante das competências com impacto na motivação e saúde.',
    'Médio': 'Trabalho aquém do potencial; revisão de atribuições e desafios recomendada.',
    'Baixo': 'Subcarga pontual; monitorar distribuição de tarefas para garantir engajamento.',
  },
  'Excesso de demandas no trabalho (Sobrecarga)': {
    'Crítico': 'Sobrecarga crítica com risco iminente de burnout e adoecimento físico e mental.',
    'Alto': 'Excesso de demandas impactando diretamente saúde e qualidade de vida.',
    'Médio': 'Carga excessiva em momentos específicos; revisão de processos e dimensionamento necessária.',
    'Baixo': 'Sobrecarga eventual e gerenciável; monitorar para evitar que se torne padrão.',
  },
  'Maus relacionamentos no local de trabalho': {
    'Crítico': 'Relações gravemente comprometidas com conflitos recorrentes e riscos à saúde coletiva.',
    'Alto': 'Conflitos significativos e clima deteriorado; intervenção imediata na gestão de pessoas.',
    'Médio': 'Tensões identificadas; mediação de conflitos e clima organizacional requerem atenção.',
    'Baixo': 'Relações satisfatórias; monitoramento preventivo e ações de integração recomendados.',
  },
  'Trabalho em condições de difícil comunicação': {
    'Crítico': 'Falhas críticas de comunicação comprometendo segurança e coesão organizacional.',
    'Alto': 'Dificuldades significativas gerando retrabalho, conflitos e riscos à saúde.',
    'Médio': 'Comunicação parcialmente prejudicada; revisão dos canais e processos necessária.',
    'Baixo': 'Comunicação adequada com pontos de melhoria; monitoramento preventivo recomendado.',
  },
  'Trabalho remoto e isolado': {
    'Crítico': 'Isolamento severo com impacto crítico na saúde mental e senso de pertencimento.',
    'Alto': 'Trabalho remoto mal gerenciado gerando desconexão e riscos psicossociais elevados.',
    'Médio': 'Isolamento moderado percebido; estratégias de conexão e acompanhamento necessárias.',
    'Baixo': 'Trabalho remoto com suporte razoável; monitorar vínculos e sentimento de pertencimento.',
  },
};

const getSyntheticDesc = (topic: string, risk: string): string => {
  const key = stripTopicPrefix(topic);
  return (
    SYNTHETIC[key]?.[risk] ??
    (risk === 'Crítico' ? 'Fator em nível crítico, exigindo intervenção imediata.' :
     risk === 'Alto'   ? 'Fator com risco relevante e potencial de dano concreto.' :
     risk === 'Médio'  ? 'Fator requer atenção e monitoramento sistemático.' :
                         'Fator em nível baixo; monitoramento preventivo recomendado.')
  );
};

export const generatePDFReport = (company: any, profile: any, formData?: any, targetResponses?: any[]) => {
  const responsesToUse = targetResponses || company.respostas;
  if (!responsesToUse || responsesToUse.length === 0) {
    alert('Não há respostas suficientes para gerar o relatório.');
    return;
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const answers = responsesToUse.map((r: any) => r.respostas);
  const results = calculateResults(answers);
  const totalRespondents = responsesToUse.length;

  const sortedResults = [...results].sort((a, b) => b.average - a.average);
  const highestRiskTopic = sortedResults[0];
  const highestRiskLevel = highestRiskTopic.average > 2.32 ? 'Crítico' : (highestRiskTopic.average > 1.66 ? 'Médio' : 'Baixo');

  const getRiskLevel = (avg: number) => {
    if (avg <= 1.66) return 'Baixo';
    if (avg <= 2.32) return 'Médio';
    return 'Crítico';
  };

  const primaryColor: [number, number, number] = [29, 78, 107];
  const accentColor: [number, number, number] = [200, 170, 100];

  const addHeader = (title: string, yPos: number, num: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(180, 180, 180);
    doc.text(num, 14, yPos);
    doc.setTextColor(...primaryColor);
    doc.text(title, 24, yPos);
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.8);
    doc.line(14, yPos + 4, 196, yPos + 4);
    doc.setFont('helvetica', 'normal');
  };

  const splitText = (text: string, maxWidth = 180) => doc.splitTextToSize(text, maxWidth);

  // ── PAGE 1: COVER ──────────────────────────────────────────────────────────
  doc.setFontSize(48);
  doc.setTextColor(150, 150, 150);
  doc.text('DRPS', 14, 40);
  doc.setFontSize(28);
  doc.text('DIAGNÓSTICO DE\nRISCOS\nPSICOSSOCIAIS', 14, 70);
  doc.setFontSize(14);
  doc.setTextColor(180, 180, 180);
  doc.text('RELATÓRIO', 14, 110);
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(14, 130, 196, 130);
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text('EMPRESA', 14, 140);
  doc.setTextColor(100, 100, 100);
  doc.text(company.nome || 'N/A', 14, 148);
  doc.setTextColor(150, 150, 150);
  doc.text(`CNPJ: ${formData?.cnpj || company.cnpj || 'Não informado'}`, 14, 170);
  doc.text(`Psicólogo(a) Elaborador(a): ${formData?.psicologo || profile?.full_name || 'Admin'} | CRP: ${formData?.crp || 'Não informado'}`, 14, 180);
  doc.text(`Data de Elaboração: ${new Date().toLocaleDateString('pt-BR')}`, 14, 190);
  doc.text(`Competência: ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`, 14, 200);

  doc.addPage();

  // ── PAGE 2: SUMMARY ────────────────────────────────────────────────────────
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.text('Conteúdo do Relatório', 14, 20);
  doc.setDrawColor(...primaryColor);
  doc.line(14, 22, 90, 22);
  const contents = [
    '1. Introdução', '2. Objetivo', '3. Metodologia',
    '4. Fluxo de Aplicação do DRPS', '5. Análises e Resultados',
    '6. Medidas de Prevenção', '7. Conclusão', '8. Referências'
  ];
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  let cy2 = 40;
  contents.forEach(item => { doc.text(item, 14, cy2); cy2 += 10; });
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(1);
  doc.line(0, 130, 210, 130);

  doc.addPage();

  // ── PAGE 3: INTRO + OBJECTIVE + METHODOLOGY START ─────────────────────────
  let y = 20;
  addHeader('Introdução', y, '01');
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  let text = splitText("A gestão dos fatores de riscos psicossociais integra o Gerenciamento de Riscos Ocupacionais previsto na NR 01 – Disposições Gerais e Gerenciamento de Riscos Ocupacionais, exigindo das organizações a identificação, avaliação e controle das condições de trabalho que possam impactar a saúde mental dos trabalhadores.\n\nOs riscos psicossociais compreendem aspectos relacionados à organização do trabalho, às exigências produtivas, às relações interpessoais, à liderança, ao reconhecimento, à comunicação, à interface entre vida pessoal e profissional e às condições estruturais do ambiente organizacional. Quando não adequadamente monitorados e geridos, tais fatores podem contribuir para o desenvolvimento de estresse ocupacional, sofrimento psíquico, absenteísmo, rotatividade e queda de desempenho.\n\nO presente relatório apresenta os resultados obtidos por meio da aplicação do DRPS – Diagnóstico de Riscos Psicossociais na organização " + company.nome + ", instrumento técnico estruturado para rastreamento organizacional dos fatores psicossociais relacionados ao trabalho, com análise integrada de dados quantitativos e classificação de risco conforme parâmetros da NR 01. O diagnóstico contemplou " + totalRespondents + " colaborador(es) respondente(s)" + (formData?.setor && formData.setor !== 'Todos' ? ", distribuídos no(s) setor(es): " + formData.setor + "." : "."));
  doc.text(text, 14, y);

  y += text.length * 5 + 15;
  addHeader('Objetivo', y, '02');
  y += 10;
  text = splitText("Este relatório tem por objetivo estruturar e sistematizar a análise dos fatores de riscos psicossociais identificados na organização avaliada, classificando-os conforme gravidade e probabilidade de ocorrência, de modo a subsidiar a tomada de decisão, a definição de prioridades de intervenção e a integração dos resultados ao Programa de Gerenciamento de Riscos (PGR).\n\nA análise considera as particularidades da organização " + company.nome + ", seu contexto produtivo, modelo de gestão e características específicas dos setores avaliados, com período de referência: " + (formData?.mesAno || new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })) + ".");
  doc.text(text, 14, y);

  y += text.length * 5 + 15;
  addHeader('Metodologia', y, '03');
  y += 10;
  text = splitText("A metodologia empregada fundamenta-se em referenciais consolidados da psicodinâmica do trabalho, estudos sobre estresse ocupacional e diretrizes normativas nacionais e internacionais sobre riscos psicossociais relacionados ao trabalho.\n\nO DRPS configura-se como instrumento técnico de rastreamento organizacional, destinado à identificação de fatores de risco em nível coletivo, não se tratando de instrumento clínico individual.\n\nA coleta de dados foi realizada por meio de questionário estruturado aplicado em formato digital, assegurando anonimato, confidencialidade e tratamento agregado das informações, em conformidade com a Lei Geral de Proteção de Dados (LGPD). O instrumento organiza-se em 13 eixos temáticos:");
  doc.text(text, 14, y);

  doc.addPage();

  // ── PAGE 4: METHODOLOGY CONT. ─────────────────────────────────────────────
  y = 20;
  const topicsList = [
    "1. Assédio de qualquer natureza no trabalho",
    "2. Falta de suporte/apoio no trabalho",
    "3. Má gestão de mudanças organizacionais",
    "4. Baixa clareza de papel/função",
    "5. Baixas recompensas e reconhecimento",
    "6. Baixo controle no trabalho / Falta de autonomia",
    "7. Baixa justiça organizacional",
    "8. Eventos violentos ou traumáticos",
    "9. Baixa demanda no trabalho (Subcarga)",
    "10. Excesso de demandas no trabalho (Sobrecarga)",
    "11. Maus relacionamentos no local de trabalho",
    "12. Trabalho em condições de difícil comunicação",
    "13. Trabalho remoto e isolado",
  ];
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  topicsList.forEach(t => { doc.text(t, 14, y); y += 6; });

  y += 6;

  // Subseção: Escalas e Questionários Utilizados
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('Escalas e Questionários Utilizados:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  y += 7;

  for (const item of [
    '• Escala de Gravidade e Probabilidade: para cada risco psicossocial, a gravidade e a probabilidade de ocorrência são avaliadas conforme a escala NR 01. A gravidade é determinada pela pontuação média dos colaboradores; a probabilidade considera a frequência percebida, o histórico do risco e os recursos disponíveis para mitigação.',
    '• Questionários Padrão: foram utilizados questionários validados com base em modelos reconhecidos pela OMS e INSS, abordando dimensões como assédio, sobrecarga, metas, autonomia e relações interpessoais.',
  ]) {
    const lines = splitText(item, 176);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
  }

  y += 4;

  // Subseção: Critérios para análise qualitativa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('Critérios para análise qualitativa:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  y += 7;

  for (const item of [
    '• Frequência: frequência percebida de cada risco no setor (Baixa, Média, Alta).',
    '• Histórico: histórico de ocorrências do risco no setor (Sim, Não, Frequente).',
    '• Recursos disponíveis: recursos da empresa para mitigar os riscos (Adequados, Insuficientes, Não existentes).',
  ]) {
    const lines = splitText(item, 176);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 3;
  }

  y += 5;

  text = splitText("Esses critérios classificam a probabilidade de ocorrência de cada fator de risco. As médias obtidas pelos questionários são classificadas conforme a matriz de risco da NR 01, garantindo uma análise integrada, rastreável e tecnicamente fundamentada dos fatores psicossociais identificados na organização.");
  doc.text(text, 14, y);
  y += text.length * 5 + 8;

  text = splitText("As respostas foram registradas em escala Likert de 0 a 4, conforme frequência percebida (0 = Nunca; 4 = Sempre). Itens de natureza protetiva foram corrigidos por lógica invertida. A gravidade foi determinada pelo cálculo das médias por item e por eixo temático, com classificação em Baixa (≤1,66), Média (≤2,32) ou Alta (>2,32). A classificação final do risco foi obtida pelo cruzamento entre gravidade e probabilidade conforme a matriz NR-01:");
  doc.text(text, 14, y);
  y += text.length * 5 + 6;

  autoTable(doc, {
    startY: y,
    head: [['Probabilidade \\ Gravidade', 'Baixa', 'Média', 'Alta']],
    body: [
      ['Baixa', 'Baixo', 'Baixo', 'Médio'],
      ['Média', 'Baixo', 'Médio', 'Alto'],
      ['Alta', 'Médio', 'Alto', 'Crítico'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [100, 100, 100] },
    bodyStyles: { textColor: [100, 100, 100] },
  });

  doc.addPage();

  // ── PAGE 5: SECTION 4 — FLOW ───────────────────────────────────────────────
  y = 20;
  addHeader('Fluxo de Aplicação do DRPS', y, '04');
  y += 15;

  text = splitText("A aplicação do DRPS seguiu fluxo técnico estruturado, garantindo consistência metodológica, confidencialidade das informações e adequação às diretrizes do Gerenciamento de Riscos Ocupacionais. Inicialmente foi realizado alinhamento com a organização " + company.nome + ", com definição dos setores avaliados e período de aplicação. Na sequência, procedeu-se à aplicação digital do questionário com " + totalRespondents + " respondente(s). Após a coleta, os dados foram consolidados, as médias calculadas por eixo e a classificação de risco gerada via matriz NR-01.");
  doc.text(text, 14, y);
  y += text.length * 5 + 12;

  for (const p of [
    "A excelência da metodologia aplicada no DRPS fundamenta-se na integração estruturada entre análise quantitativa e qualitativa, alinhada às diretrizes da NR 01 e aos parâmetros do Gerenciamento de Riscos Ocupacionais.",
    "Ao combinar mensuração objetiva por meio de escala padronizada com interpretação técnica contextual realizada por profissional habilitado, o instrumento permite não apenas identificar a presença de fatores de risco, mas compreender sua dinâmica organizacional, intensidade e impacto potencial.",
    "A utilização da matriz de risco para classificação final assegura coerência com critérios normativos e favorece a priorização proporcional das intervenções. Tal estrutura metodológica confere rastreabilidade, consistência técnica e aplicabilidade prática aos resultados, fortalecendo sua utilização como ferramenta estratégica de gestão em saúde mental organizacional.",
  ]) {
    text = splitText(p);
    doc.text(text, 14, y);
    y += text.length * 5 + 8;
  }

  doc.addPage();

  // ── PAGE 6: SECTION 5 — ANALYSIS + RISK TABLE ─────────────────────────────
  y = 20;
  addHeader('Análises e Resultados', y, '05');
  y += 10;
  text = splitText(
    "A seguir, apresentam-se os resultados obtidos nos setores avaliados, com descrição integrada dos dados quantitativos e da análise qualitativa realizada.\n\n" +
    "Total de respondentes: " + totalRespondents + "\n\n" +
    "Tópico de maior risco identificado: " + stripTopicPrefix(highestRiskTopic.topic) + " (" + highestRiskLevel + ")\n\n" +
    "A análise das médias obtidas por eixo temático indicou que os fatores relacionados a " + stripTopicPrefix(highestRiskTopic.topic) + " apresentaram níveis de gravidade. Tais resultados sugerem exposição significativa dos trabalhadores a condições psicossocialmente adversas nessas dimensões.\n\n" +
    "No que se refere à probabilidade de ocorrência, a análise considerou a frequência dos relatos, a recorrência histórica e a existência de medidas formais de controle. Os fatores de maior risco apresentam probabilidade proporcional à gravidade identificada, resultando na classificação final conforme a matriz de risco NR-01."
  );
  doc.text(text, 14, y);

  y += text.length * 5 + 12;
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('Visão Geral — Todos os Setores', 14, y);
  y += 10;

  const riskTableData = results.map(r => {
    let fontes = 'Condições estruturais e de gestão.';
    if (r.topic.includes('Assédio')) fontes = 'Cultura permissiva; falta de canais de denúncia.';
    if (/demanda/i.test(r.topic)) fontes = 'Subutilização ou excesso de tarefas.';
    if (/mudança/i.test(r.topic)) fontes = 'Comunicação inadequada; mudanças abruptas.';
    const risk = getRiskLevel(r.average);
    const grav = risk === 'Baixo' ? 'Baixa' : risk === 'Médio' ? 'Média' : 'Alta';
    return [stripTopicPrefix(r.topic), fontes, grav, grav, risk];
  });

  autoTable(doc, {
    startY: y,
    head: [['FATOR DE RISCO', 'FONTES GERADORAS', 'GRAVIDADE', 'PROBABILIDADE', 'MATRIZ\nRISCO']],
    body: riskTableData,
    theme: 'plain',
    headStyles: { textColor: [150, 150, 150], fontSize: 9 },
    bodyStyles: { fontSize: 9, cellPadding: 4 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didParseCell: (data) => {
      if (data.section === 'body' && [2, 3, 4].includes(data.column.index)) {
        const t = data.cell.text[0];
        if (t === 'Baixo' || t === 'Baixa') data.cell.styles.textColor = [34, 197, 94];
        else if (t === 'Médio' || t === 'Média') data.cell.styles.textColor = [245, 158, 11];
        else data.cell.styles.textColor = [239, 68, 68];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 0) data.cell.styles.fontStyle = 'bold';
    },
  });

  // ── PAINEL RESUMO NR-1 ────────────────────────────────────────────────────
  doc.addPage();
  y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text('Painel Resumo NR-1', 14, y);
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.8);
  doc.line(14, y + 4, 196, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text('Distribuição de riscos psicossociais identificados — gerado automaticamente com base nos dados do relatório', 14, y + 12);
  y += 22;

  const riskCounts = { Baixo: 0, Médio: 0, Alto: 0, Crítico: 0 };
  const gravCounts = { Baixa: 0, Média: 0, Alta: 0 };
  results.forEach(r => {
    riskCounts[getRiskLevel(r.average) as keyof typeof riskCounts]++;
    gravCounts[r.severity as keyof typeof gravCounts]++;
  });

  const chart1 = [
    { label: 'Baixo', value: riskCounts.Baixo, color: '#4CAF50' },
    { label: 'Médio', value: riskCounts.Médio, color: '#FF9800' },
    { label: 'Alto', value: riskCounts.Alto, color: '#F44336' },
    { label: 'Crítico', value: riskCounts.Crítico, color: '#9C27B0' },
  ];
  const chart2 = [
    { label: 'Baixa', value: gravCounts.Baixa, color: '#4CAF50' },
    { label: 'Média', value: gravCounts.Média, color: '#FF9800' },
    { label: 'Alta', value: gravCounts.Alta, color: '#F44336' },
  ];
  const chart3 = [...chart2];

  const CHART_W = 58, CHART_H = 66;
  for (const { x, title, segs } of [
    { x: 14, title: 'Matriz de Risco (Geral)', segs: chart1 },
    { x: 76, title: 'Gravidade por Fator', segs: chart2 },
    { x: 138, title: 'Probabilidade de Ocorrência', segs: chart3 },
  ]) {
    doc.addImage(drawDonutChart(segs, title), 'PNG', x, y, CHART_W, CHART_H);
  }

  // ── PAGE 7: SECTION 6 — PREVENTION ────────────────────────────────────────
  doc.addPage();
  y = 20;
  addHeader('Medidas de Prevenção e Recomendações Técnicas', y, '06');
  y += 10;

  text = splitText("Com base na classificação dos fatores de riscos psicossociais identificados, especialmente aqueles enquadrados como Alto ou Crítico conforme a matriz de risco, torna-se necessária a implementação de medidas preventivas proporcionais ao nível de exposição identificado.\n\nAs recomendações a seguir consideram o princípio da hierarquia de controle de riscos aplicado ao contexto psicossocial, priorizando intervenções organizacionais estruturais antes de ações exclusivamente individuais. As ações deverão ser acompanhadas por responsáveis designados e avaliadas periodicamente quanto à sua efetividade.");
  doc.text(text, 14, y);
  y += text.length * 5 + 10;

  const recTableData = results.map(r => {
    let rec = 'Revisão estrutural e capacitação.';
    if (r.topic.includes('Assédio')) rec = 'Implantação imediata de política formal, canal de denúncia e afastamento.';
    if (/demanda/i.test(r.topic)) rec = 'Revisão de atribuições, adequação de jornada e equipe.';
    if (/recompensas/i.test(r.topic)) rec = 'Treinamento de lideranças em feedback e valorização.';
    const risk = getRiskLevel(r.average);
    const prazo = risk === 'Crítico' ? '30 dias' : risk === 'Médio' ? '90 dias' : '180 dias';
    return [
      stripTopicPrefix(r.topic),
      risk,
      getSyntheticDesc(r.topic, risk),
      rec,
      'Diretoria / RH',
      prazo,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['FATOR DE RISCO', 'CLASSIF.', 'DESCRIÇÃO SINTÉTICA DO PROBLEMA', 'MEDIDA PREVENTIVA', 'RESP.', 'PRAZO']],
    body: recTableData,
    theme: 'plain',
    headStyles: { textColor: [150, 150, 150], fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 16 },
      2: { cellWidth: 50 },
      3: { cellWidth: 50 },
      4: { cellWidth: 16 },
      5: { cellWidth: 16 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const t = data.cell.text[0];
        if (t === 'Baixo') data.cell.styles.textColor = [34, 197, 94];
        else if (t === 'Médio') data.cell.styles.textColor = [245, 158, 11];
        else data.cell.styles.textColor = [239, 68, 68];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 0) data.cell.styles.fontStyle = 'bold';
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = [200, 50, 50];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const footerY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'italic');
  doc.text("Os prazos indicados são referências técnicas. Recomenda-se que a empresa defina prazos e responsáveis formais no PGR.", 14, footerY);
  doc.setFont('helvetica', 'normal');

  doc.addPage();

  // ── PAGE 8: CONCLUSION + REFERENCES ───────────────────────────────────────
  y = 20;
  addHeader('Conclusão', y, '07');
  y += 10;

  const criticos = results.filter(r => getRiskLevel(r.average) === 'Crítico').length;
  text = splitText(
    `A análise realizada evidencia que os fatores de riscos psicossociais identificados na organização demandam atenção técnica proporcional à sua classificação final.\n\nForam identificados ${criticos} fator(es) classificado(s) como Crítico, que requerem priorização máxima de medidas estruturadas, com definição clara de responsáveis, prazos e indicadores de acompanhamento, integrando-se formalmente ao Programa de Gerenciamento de Riscos (PGR).\n\nOs riscos classificados como Médio indicam necessidade de monitoramento sistemático e possíveis intervenções preventivas, enquanto aqueles classificados como Baixo devem permanecer sob acompanhamento periódico.\n\nRecomenda-se que a organização adote plano de ação estruturado contemplando intervenções em nível organizacional (estrutura e processos), relacional (liderança e clima) e individual (apoio e orientação), conforme a natureza dos fatores identificados.\n\nRessalta-se que a avaliação representa um recorte temporal específico, baseado em autorrelato e análise técnica contextual, sendo recomendável a reavaliação periódica para monitoramento contínuo dos fatores psicossociais.`
  );
  doc.text(text, 14, y);

  y += text.length * 5 + 15;
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(formData?.psicologo || profile?.full_name || "Equipe DRPS", 14, y);
  doc.setTextColor(150, 150, 150);
  doc.text(`Psicólogo(a) Responsável Técnico(a)${formData?.crp ? ` | CRP: ${formData.crp}` : ''}`, 14, y + 6);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, y + 16);

  y += 35;
  if (y > 210) { doc.addPage(); y = 20; }

  addHeader('Referências', y, '08');
  y += 10;

  const refs = [
    "1. BRASIL. Ministério do Trabalho e Emprego. NR 01 – Disposições Gerais e Gerenciamento de Riscos Ocupacionais. Portaria MTP nº 6.730, de 9 de março de 2023.",
    "2. BRASIL. Ministério do Trabalho e Emprego. Guia de informações sobre os fatores de riscos psicossociais relacionados ao trabalho. Brasília: MTE, 2023.",
    "3. INTERNACIONAL LABOUR OFFICE (ILO). Psychosocial risks at work: recognition and prevention. Geneva: ILO, 2016.",
    "4. BRASIL. Ministério da Saúde. Protocolo de enfrentamento dos fatores psicossociais no trabalho. Brasília: MS, 2021.",
    "5. FERREIRA, M. C.; MILANI, R. G. Fatores psicossociais no trabalho: conceitos, metodologias e aplicações. São Paulo: Casa do Psicólogo, 2020.",
    "6. DEJOURS, C. A banalização da injustiça social. 5. ed. Rio de Janeiro: FGV, 2016.",
    "7. ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS (ABNT). NBR ISO 10075-1: Princípios ergonômicos relacionados à carga de trabalho mental – Parte 1: Termos e definições. Rio de Janeiro: ABNT, 2013.",
    "8. HSE – HEALTH AND SAFETY EXECUTIVE. Management Standards for work-related stress. London: HSE, 2007. Disponível em: https://www.hse.gov.uk/stress/standards/.",
    "9. ITRA. Avaliação de Riscos Psicossociais: Instrumento de Triagem de Riscos Psicossociais no Trabalho. São Paulo: ITRA, 2015.",
    "10. RODRIGUES, A. C.; TAMAYO, A. Estresse no trabalho e riscos psicossociais: uma revisão integrativa. Revista Psicologia: Teoria e Prática, São Paulo, v. 22, n. 1, p. 80-101, 2020.",
    "11. INTERNATIONAL ORGANIZATION FOR STANDARDIZATION. ISO 45001:2018 – Occupational health and safety management systems. Geneva: ISO, 2018.",
    "12. MASLACH, C.; SCHAUFELI, W. B.; LEITER, M. P. Job burnout. Annual Review of Psychology, v. 52, p. 397–422, 2001.",
    "13. DEJOURS, C. A loucura do trabalho: estudo de psicopatologia do trabalho. 5. ed. São Paulo: Cortez, 1992.",
    "14. DEJOURS, C. Subjetividade, trabalho e ação. Revista Produção, v. 14, n. 3, p. 27–34, 2004.",
  ];

  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  for (const ref of refs) {
    const t = splitText(ref, 180);
    if (y + t.length * 5 > 277) { doc.addPage(); y = 20; }
    doc.text(t, 14, y);
    y += t.length * 5 + 3;
  }

  doc.save(`relatorio_${company.slug || company.id}_drps.pdf`);
};
