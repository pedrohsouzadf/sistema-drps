import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs';

const supabase = createClient(
  'https://rxehehmkdevobnjgumrk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZWhlaG1rZGV2b2Juamd1bXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjUyOTQsImV4cCI6MjA5NTQwMTI5NH0.R7cq-hB8tBNrVErjCgknvhOzgPTlnXfn9fl-Y8xCMkA'
);

// Tenta deletar pelas duas empresas e pelos dois campos identificadores
const attempts = [
  { empresa_id: 'ce8269ec-f00e-4dff-b0b4-c90e17df2513', field: 'setor',  value: 'Verificação' },
  { empresa_id: 'ce8269ec-f00e-4dff-b0b4-c90e17df2513', field: 'cargo',  value: 'Respondente de Verificação' },
  { empresa_id: 'ea3e0c51-cc78-4faf-8e1c-d4c23a698729', field: 'setor',  value: 'Verificação' },
  { empresa_id: 'ea3e0c51-cc78-4faf-8e1c-d4c23a698729', field: 'cargo',  value: 'Respondente de Verificação' },
];

for (const { empresa_id, field, value } of attempts) {
  const { error, count } = await supabase
    .from('respostas')
    .delete({ count: 'exact' })
    .eq('empresa_id', empresa_id)
    .eq(field, value);

  const label = `empresa=${empresa_id.slice(0,8)} ${field}="${value}"`;
  if (error) {
    console.log(`✗ ${label} → erro: ${error.message}`);
  } else {
    console.log(`✓ ${label} → ${count ?? '?'} linha(s) removida(s)`);
  }
}
