-- Migration: adiciona ON DELETE CASCADE em todas as FKs que referenciam empresas.id
-- Isso garante que ao excluir uma empresa, todos os dados vinculados sejam removidos automaticamente.
-- Use DROP CONSTRAINT IF EXISTS para ser idempotente.

-- profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_empresa_id_fkey;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

-- respostas
ALTER TABLE respostas DROP CONSTRAINT IF EXISTS respostas_empresa_id_fkey;
ALTER TABLE respostas
  ADD CONSTRAINT respostas_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

-- agendamentos
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_empresa_id_fkey;
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

-- palestras
ALTER TABLE palestras DROP CONSTRAINT IF EXISTS palestras_empresa_id_fkey;
ALTER TABLE palestras
  ADD CONSTRAINT palestras_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

-- probabilidades_topico
ALTER TABLE probabilidades_topico DROP CONSTRAINT IF EXISTS probabilidades_topico_empresa_id_fkey;
ALTER TABLE probabilidades_topico
  ADD CONSTRAINT probabilidades_topico_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
