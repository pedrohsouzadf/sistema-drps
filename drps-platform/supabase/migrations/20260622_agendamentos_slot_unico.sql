-- Migration: índice único parcial para prevenir double booking de slots
-- Garante que não existam dois agendamentos ativos no mesmo data_hora.
-- Agendamentos cancelados ficam de fora da restrição (podem reutilizar o slot).

CREATE UNIQUE INDEX IF NOT EXISTS agendamentos_data_hora_unico
  ON agendamentos (data_hora)
  WHERE status != 'cancelado';
