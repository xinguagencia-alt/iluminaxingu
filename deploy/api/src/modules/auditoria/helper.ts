import { db } from '../../db.js'

interface AuditLogParams {
  tabela: string
  registroId: number | null
  acao: 'criar' | 'editar' | 'excluir'
  dadosAntes?: Record<string, unknown> | null
  dadosDepois?: Record<string, unknown> | null
  usuarioId: number | null
  usuarioNome: string | null
}

export async function registrarAuditoria(params: AuditLogParams): Promise<void> {
  try {
    await db.query(
      `INSERT INTO auditoria (tabela, registro_id, acao, dados_antes, dados_depois, usuario_id, usuario_nome)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.tabela,
        params.registroId,
        params.acao,
        params.dadosAntes ? JSON.stringify(params.dadosAntes) : null,
        params.dadosDepois ? JSON.stringify(params.dadosDepois) : null,
        params.usuarioId,
        params.usuarioNome,
      ]
    )
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error)
  }
}

export async function criarTabelaAuditoria(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id SERIAL PRIMARY KEY,
      tabela VARCHAR(50) NOT NULL,
      registro_id INTEGER,
      acao VARCHAR(20) NOT NULL,
      dados_antes JSONB,
      dados_depois JSONB,
      usuario_id INTEGER,
      usuario_nome VARCHAR(100),
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_tabela ON auditoria (tabela)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON auditoria (registro_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria (usuario_id)`)
  await db.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON auditoria (criado_em)`)
}
