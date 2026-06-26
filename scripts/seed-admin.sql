-- IluminaXingu - Seed de usuario administrativo (DESENVOLVIMENTO/HOMOLOGACAO)
-- Senha: admin123
-- ATENCAO: Nao usar em producao! Use o fluxo de bootstrap na primeira execucao.
-- Execute apenas para ambientes de desenvolvimento ou homologacao.

INSERT INTO admin_users (username, password_hash, nome_completo)
VALUES ('admin', '$2b$10$On.pNN5BWc.GUnw37bWDN.sZB1O62SDsfdP9Ars7PFGqMMy.h61lW', 'Administrador')
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  nome_completo = EXCLUDED.nome_completo;
