import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, ChevronRight, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { QUESTIONS } from '../services/questions';
import { apiPost } from '../services/api';

interface Props {
  company: { id: string; nome: string };
  onClose: () => void;
  onSuccess: () => void;
}

type ColumnMapping = 'ignore' | 'cargo' | 'setor' | number;

const LIKERT_MAP: Record<string, number> = {
  'nunca': 0,
  'raramente': 1,
  'quase nunca': 1,
  'as vezes': 2,
  'às vezes': 2,
  'algumas vezes': 2,
  'frequentemente': 3,
  'quase sempre': 3,
  'sempre': 4,
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseLikertValue(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!isNaN(num) && num >= 0 && num <= 4) return Math.round(num);
  const normalized = normalizeText(String(value));
  if (normalized in LIKERT_MAP) return LIKERT_MAP[normalized];
  for (const [key, val] of Object.entries(LIKERT_MAP)) {
    if (normalized.includes(key)) return val;
  }
  const match = String(value).match(/\b([0-4])\b/);
  if (match) return parseInt(match[1]);
  return null;
}

function autoDetectMapping(headers: string[]): ColumnMapping[] {
  const normalizedQuestions = QUESTIONS.map(q => normalizeText(q.text));
  const usedIndices = new Set<number>();

  return headers.map(header => {
    const norm = normalizeText(header);

    if (/\bcargo\b|\bfuncao\b|\bfuncão\b|\bposto\b/.test(norm)) return 'cargo';
    if (/\bsetor\b|\bdepartamento\b|\barea\b|\bsecao\b/.test(norm)) return 'setor';

    for (let i = 0; i < normalizedQuestions.length; i++) {
      if (usedIndices.has(i)) continue;
      if (norm === normalizedQuestions[i] || normalizedQuestions[i].includes(norm) || norm.includes(normalizedQuestions[i])) {
        usedIndices.add(i);
        return i;
      }
    }

    const headerWords = norm.split(' ').filter(w => w.length > 3);
    if (headerWords.length > 0) {
      let bestMatch = -1;
      let bestScore = 0;
      for (let i = 0; i < normalizedQuestions.length; i++) {
        if (usedIndices.has(i)) continue;
        const qWords = normalizedQuestions[i].split(' ').filter(w => w.length > 3);
        const overlap = headerWords.filter(w => qWords.includes(w)).length;
        const score = overlap / Math.max(headerWords.length, qWords.length);
        if (score > 0.55 && score > bestScore) {
          bestScore = score;
          bestMatch = i;
        }
      }
      if (bestMatch >= 0) {
        usedIndices.add(bestMatch);
        return bestMatch;
      }
    }

    return 'ignore';
  });
}

const TOPICS_MAP = QUESTIONS.reduce((acc, q, i) => {
  if (!acc[q.topic]) acc[q.topic] = [];
  acc[q.topic].push({ index: i, text: q.text });
  return acc;
}, {} as Record<string, { index: number; text: string }[]>);

const ImportSpreadsheetModal: React.FC<Props> = ({ company, onClose, onSuccess }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

        if (jsonData.length < 2) {
          setParseError('Planilha vazia ou sem linhas de dados.');
          return;
        }

        const hdrs = (jsonData[0] as any[]).map(h => String(h ?? ''));
        const dataRows = jsonData.slice(1).filter(row =>
          (row as any[]).some(cell => cell !== null && cell !== undefined && cell !== '')
        );

        setHeaders(hdrs);
        setRows(dataRows as any[][]);
        setMapping(autoDetectMapping(hdrs));
        setStep(2);
      } catch {
        setParseError('Erro ao ler o arquivo. Certifique-se que é .xlsx, .xls ou .csv válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const setColumnMapping = (colIdx: number, value: ColumnMapping) => {
    setMapping(prev => {
      const next = [...prev];
      next[colIdx] = value;
      return next;
    });
  };

  const questionMappings = mapping.filter(m => typeof m === 'number') as number[];
  const mappedCount = new Set(questionMappings).size;
  const hasDuplicates = questionMappings.length !== mappedCount;
  const canProceed = mappedCount > 0 && !hasDuplicates;
  const totalQuestions = QUESTIONS.length;
  const allMapped = mappedCount === totalQuestions;

  const minValidAnswers = Math.max(1, Math.floor(mappedCount * 0.9));

  const buildResponses = useCallback(() => {
    return rows.map(row => {
      const answers = new Array(totalQuestions).fill(null) as (number | null)[];
      let cargo = '';
      let setor = '';

      mapping.forEach((m, ci) => {
        const cell = row[ci];
        if (m === 'cargo') cargo = String(cell ?? '');
        else if (m === 'setor') setor = String(cell ?? '');
        else if (typeof m === 'number') answers[m] = parseLikertValue(cell);
      });

      const validCount = answers.filter(a => a !== null).length;
      return { answers, cargo, setor, validCount };
    });
  }, [rows, mapping]);

  const parsed = buildResponses();
  const validRows = parsed.filter(r => r.validCount >= minValidAnswers);
  const skippedRows = parsed.length - validRows.length;

  const handleImport = async () => {
    setIsImporting(true);
    let success = 0;
    let errors = 0;

    for (const r of validRows) {
      try {
        await apiPost('/respostas', {
          empresa_id: company.id,
          cargo: r.cargo || null,
          setor: r.setor || null,
          respostas: r.answers,
        });
        success++;
      } catch { errors++; }
    }

    setImportResult({ success, errors });
    setIsImporting(false);
    if (success > 0) onSuccess();
  };

  const getSampleValue = (colIdx: number) => {
    for (const row of rows.slice(0, 5)) {
      const v = row[colIdx];
      if (v !== null && v !== undefined && v !== '') return String(v);
    }
    return '—';
  };

  const mappingLabel = (m: ColumnMapping): string => {
    if (m === 'ignore') return 'Ignorar';
    if (m === 'cargo') return 'Cargo';
    if (m === 'setor') return 'Setor';
    return `Q${m + 1}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        className={`bg-white shadow-2xl animate-in zoom-in duration-300 flex flex-col ${
          step === 2 ? 'rounded-[32px] w-full max-w-5xl max-h-[90vh]' : 'rounded-[40px] w-full max-w-lg'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-start p-8 pb-0 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    s === step ? 'w-8 bg-slate-900' : s < step ? 'w-4 bg-emerald-400' : 'w-4 bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <h3 className="text-2xl font-serif text-slate-800">
              {step === 1 && 'Importar Planilha'}
              {step === 2 && 'Mapear Colunas'}
              {step === 3 && 'Confirmar Importação'}
            </h3>
            <p className="text-slate-500 text-xs font-medium mt-0.5">{company.nome}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors mt-1">
            <X size={20} />
          </button>
        </div>

        {/* Step 1 - Upload */}
        {step === 1 && (
          <div className="p-8 space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                isDragging ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="mx-auto mb-3 text-slate-400" size={40} />
              <p className="font-bold text-slate-700 text-sm mb-1">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="text-xs text-slate-400">Formatos aceitos: .xlsx, .xls, .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
              />
            </div>

            {parseError && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex gap-3">
                <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                <p className="text-sm text-rose-700">{parseError}</p>
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Como funciona</p>
              <ul className="text-xs text-slate-600 space-y-1.5">
                <li className="flex gap-2"><span className="text-slate-400 shrink-0">1.</span>Exporte as respostas do Google Forms como planilha (.xlsx ou .csv)</li>
                <li className="flex gap-2"><span className="text-slate-400 shrink-0">2.</span>Faça o upload do arquivo — cada coluna representa uma pergunta</li>
                <li className="flex gap-2"><span className="text-slate-400 shrink-0">3.</span>Mapeie as colunas às {QUESTIONS.length} perguntas do diagnóstico (detecção automática quando possível)</li>
                <li className="flex gap-2"><span className="text-slate-400 shrink-0">4.</span>As respostas serão analisadas da mesma forma que as do questionário da plataforma</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2 - Column Mapping */}
        {step === 2 && (
          <>
            <div className="px-8 pt-4 pb-2 shrink-0">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Verifique e ajuste o mapeamento das <span className="font-bold text-slate-800">{headers.length}</span> colunas da planilha.
                </p>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${allMapped ? 'bg-emerald-50 text-emerald-600' : mappedCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                  {mappedCount}/{totalQuestions} perguntas
                  {hasDuplicates && ' · duplicatas'}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-4 min-h-0">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-8">#</th>
                    <th className="text-left py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coluna na planilha</th>
                    <th className="text-left py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">Exemplo</th>
                    <th className="text-left py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-56">Mapear para</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {headers.map((header, ci) => {
                    const m = mapping[ci];
                    const isDuplicate = typeof m === 'number' && questionMappings.filter(q => q === m).length > 1;
                    return (
                      <tr key={ci} className={isDuplicate ? 'bg-amber-50' : ''}>
                        <td className="py-2 text-xs text-slate-300 font-mono">{ci + 1}</td>
                        <td className="py-2 pr-4">
                          <p className="text-xs font-medium text-slate-700 truncate max-w-xs" title={header}>{header || `Coluna ${ci + 1}`}</p>
                        </td>
                        <td className="py-2 pr-4">
                          <span className="text-xs text-slate-400 font-mono truncate block max-w-[120px]" title={getSampleValue(ci)}>
                            {getSampleValue(ci)}
                          </span>
                        </td>
                        <td className="py-2">
                          <select
                            value={typeof m === 'number' ? String(m) : m}
                            onChange={e => {
                              const v = e.target.value;
                              setColumnMapping(ci, v === 'ignore' || v === 'cargo' || v === 'setor' ? v : parseInt(v));
                            }}
                            className={`w-full text-xs border rounded-lg px-2 py-1.5 outline-none cursor-pointer ${
                              m === 'ignore' ? 'border-slate-200 text-slate-400 bg-slate-50' :
                              isDuplicate ? 'border-amber-300 bg-amber-50 text-amber-700' :
                              'border-brand-primary bg-brand-light text-brand-primary font-medium'
                            }`}
                          >
                            <option value="ignore">— Ignorar</option>
                            <optgroup label="Informações do respondente">
                              <option value="cargo">Cargo</option>
                              <option value="setor">Setor</option>
                            </optgroup>
                            {Object.entries(TOPICS_MAP).map(([topic, questions]) => (
                              <optgroup key={topic} label={topic.replace(/Tópico \d+ - /, 'T').substring(0, 40)}>
                                {questions.map(({ index, text }) => (
                                  <option key={index} value={String(index)}>
                                    Q{index + 1}: {text.substring(0, 55)}{text.length > 55 ? '…' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 shrink-0">
              {hasDuplicates && (
                <p className="text-xs text-amber-600 mb-3 flex items-center gap-1.5">
                  <AlertCircle size={13} /> Existem perguntas mapeadas mais de uma vez. Corrija antes de continuar.
                </p>
              )}
              {!hasDuplicates && mappedCount > 0 && mappedCount < totalQuestions && (
                <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" /> {totalQuestions - mappedCount} pergunta{totalQuestions - mappedCount !== 1 ? 's' : ''} do diagnóstico não estão no arquivo — serão desconsideradas na análise.
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                  Voltar
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceed}
                  className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-all"
                >
                  Pré-visualizar <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 3 - Preview + Import */}
        {step === 3 && (
          <div className="p-8 space-y-5">
            {!importResult ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-600">{validRows.length}</p>
                    <p className="text-xs text-emerald-700 font-medium mt-1">respondentes válidos</p>
                  </div>
                  <div className={`rounded-2xl p-4 text-center ${skippedRows > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <p className={`text-3xl font-bold ${skippedRows > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{skippedRows}</p>
                    <p className={`text-xs font-medium mt-1 ${skippedRows > 0 ? 'text-amber-700' : 'text-slate-400'}`}>linhas ignoradas</p>
                  </div>
                </div>

                {!allMapped && mappedCount > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-2">
                    <AlertCircle size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-500">
                      <span className="font-medium">{mappedCount}/{totalQuestions} perguntas mapeadas.</span> As {totalQuestions - mappedCount} ausentes serão ignoradas na análise — os tópicos correspondentes serão calculados com os dados disponíveis.
                    </p>
                  </div>
                )}
                {skippedRows > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
                    <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">Linhas com menos de 80% das respostas preenchidas foram ignoradas (provavelmente em branco ou incompletas).</p>
                  </div>
                )}

                {validRows.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Prévia (primeiros 3 respondentes)</p>
                    <div className="bg-slate-50 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="text-left px-3 py-2 font-bold text-slate-500">Cargo</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500">Setor</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500">Respostas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validRows.slice(0, 3).map((r, i) => (
                            <tr key={i} className="border-t border-slate-200">
                              <td className="px-3 py-2 text-slate-600">{r.cargo || '—'}</td>
                              <td className="px-3 py-2 text-slate-600">{r.setor || '—'}</td>
                              <td className="px-3 py-2 text-slate-400 font-mono">{r.validCount}/{mappedCount} preenchidas</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(2)} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                    Voltar
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isImporting || validRows.length === 0}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-all"
                  >
                    {isImporting ? (
                      <><Loader2 size={16} className="animate-spin" /> Importando...</>
                    ) : (
                      <>Importar {validRows.length} respondente{validRows.length !== 1 ? 's' : ''}</>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-4">
                {importResult.success > 0 ? (
                  <CheckCircle className="mx-auto text-emerald-500" size={48} />
                ) : (
                  <AlertCircle className="mx-auto text-rose-500" size={48} />
                )}
                <div>
                  <p className="text-xl font-bold text-slate-800">
                    {importResult.success > 0 ? 'Importação concluída!' : 'Erro na importação'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {importResult.success} importado{importResult.success !== 1 ? 's' : ''} com sucesso
                    {importResult.errors > 0 && ` · ${importResult.errors} com erro`}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportSpreadsheetModal;
