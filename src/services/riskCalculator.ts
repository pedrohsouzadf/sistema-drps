import { QUESTIONS } from './questions';

export type RiskLevel = 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
export type Severity = 'Baixa' | 'Média' | 'Alta';

export const SEVERITY_RANK: Record<Severity, number> = { 'Baixa': 1, 'Média': 2, 'Alta': 3 };
export const RISK_LEVEL_RANK: Record<RiskLevel, number> = { 'Baixo': 1, 'Médio': 2, 'Alto': 3, 'Crítico': 4 };

/**
 * Retorna a classificação mais frequente (moda) em um conjunto de níveis.
 * Desempate: nível de maior gravidade vence.
 */
export function calcularClassificacaoGeral<T extends string>(
  niveis: T[],
  pesos: Record<string, number>
): T {
  if (niveis.length === 0) throw new Error('Lista de níveis vazia');

  const contagem: Record<string, number> = {};
  for (const n of niveis) contagem[n] = (contagem[n] || 0) + 1;

  const maxFreq = Math.max(...Object.values(contagem));
  const empatados = (Object.keys(contagem) as T[]).filter(n => contagem[n] === maxFreq);

  return empatados.reduce((maior, atual) =>
    (pesos[atual] ?? 0) > (pesos[maior] ?? 0) ? atual : maior
  );
}

export interface TopicResult {
  topic: string;
  average: number;
  severity: Severity;
  risk: RiskLevel;
}

export interface SectorResult {
  sector: string;
  count: number;
  average: number;
  severity: Severity;
  risk: RiskLevel;
}

// Lógica de correção (Direta vs Inversa)
export const correctValue = (value: number, type: 'D' | 'I'): number => {
  return type === 'I' ? 4 - value : value;
};

// Determina Gravidade baseada na média corrigida (0-4)
export const getSeverity = (avg: number): Severity => {
  if (avg <= 1.66) return 'Baixa';
  if (avg <= 2.32) return 'Média';
  return 'Alta';
};

// Matriz de Risco NR-01 (Gravidade x Probabilidade - simplificada onde Prob = Grav)
export const getRiskLevel = (severity: Severity): RiskLevel => {
  const matrix: Record<Severity, RiskLevel> = {
    'Alta': 'Crítico',
    'Média': 'Médio', // Na lógica original, Média x Média = Médio
    'Baixa': 'Baixo'
  };
  
  // Nota: A lógica original usava rk(g,g) o que resulta em:
  // Alta x Alta = Crítico
  // Média x Média = Médio
  // Baixa x Baixa = Baixo
  // Replicando exatamente para manter compatibilidade:
  return matrix[severity];
};

// Gravidade numérica a partir da pontuação corrigida já arredondada
const gravNum = (corrigida: number): number => {
  if (corrigida >= 3) return 3; // Alta
  if (corrigida === 2) return 2; // Média
  return 1;                      // Baixa
};

export const calculateResults = (responses: number[][]) => {
  const topicOrder: string[] = [];
  const topicQuestions = new Map<string, { idx: number; type: 'D' | 'I' }[]>();
  QUESTIONS.forEach((q, idx) => {
    if (!topicQuestions.has(q.topic)) {
      topicOrder.push(q.topic);
      topicQuestions.set(q.topic, []);
    }
    topicQuestions.get(q.topic)!.push({ idx, type: q.type });
  });

  const topicResults: TopicResult[] = topicOrder.map(topic => {
    const questions = topicQuestions.get(topic)!;

    const gravNums: number[] = questions
      .map(({ idx, type }) => {
        // Passo 1: média bruta da pergunta (respostas 0–4, sem correção)
        const rawValues: number[] = [];
        for (const res of responses) {
          const val = res[idx];
          if (val !== null && val !== undefined) rawValues.push(val as number);
        }
        if (rawValues.length === 0) return null;

        const mediaBruta = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;

        // Passo 2: ROUNDUP — arredonda para o inteiro superior (como ROUNDUP(...,0) da planilha)
        const arredondada = Math.ceil(mediaBruta);

        // Passo 3: pontuação corrigida (D = valor, I = 4 - valor)
        const corrigida = type === 'I' ? 4 - arredondada : arredondada;

        // Passo 4: gravidade numérica da pergunta
        return gravNum(corrigida);
      })
      .filter((g): g is number => g !== null);

    // Passo 5: score do tópico = média dos GravidadeNum de todas as perguntas
    const average = gravNums.length > 0
      ? gravNums.reduce((a, b) => a + b, 0) / gravNums.length
      : 0;
    const severity = getSeverity(average);
    const risk = getRiskLevel(severity);

    return { topic, average, severity, risk };
  });

  return topicResults;
};
