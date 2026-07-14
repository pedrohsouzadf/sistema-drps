-- Migration: atualiza CHECK CONSTRAINT da coluna tipo na tabela agendamentos
-- Motivo: novos valores de assunto foram adicionados ao dropdown do frontend.

-- 1. Remove a constraint antiga
ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_tipo_check;

-- 2. Cria a nova constraint com os 7 valores aceitos pelo frontend
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_tipo_check CHECK (
    tipo IN (
      'Bem-estar e saúde emocional',
      'Estresse ou sobrecarga no trabalho',
      'Relacionamento com colegas ou liderança',
      'Ansiedade, tristeza ou desmotivação',
      'Conciliação entre vida pessoal e profissional',
      'Conversa preventiva / check-in periódico',
      'Prefiro não especificar'
    )
  );
