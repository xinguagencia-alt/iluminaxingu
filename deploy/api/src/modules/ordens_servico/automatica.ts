import { db } from '../../db.js'
import { comLockLocalizacao } from '../solicitacoes/duplicidade.js'

export const STATUS_OS_AUTOMATICA = 'aberta'
export const ORIGEM_OS_AUTOMATICA = 'automatica'

export interface ResultadoOsAutomatica {
  criada: boolean
  jaExistia: boolean
  ordem: Record<string, unknown> | null
}

async function buscarOsDaSolicitacao(
  solicitacaoId: number
): Promise<Record<string, unknown> | null> {
  const result = await db.query(
    'SELECT * FROM ordens_servico WHERE solicitacao_id = $1 LIMIT 1',
    [solicitacaoId]
  )
  return result.rows.length > 0 ? (result.rows[0] as Record<string, unknown>) : null
}

export async function criarOsAutomatica(
  solicitacaoId: number
): Promise<ResultadoOsAutomatica> {
  return comLockLocalizacao(`os-auto|${solicitacaoId}`, async () => {
    const existente = await buscarOsDaSolicitacao(solicitacaoId)
    if (existente) {
      return { criada: false, jaExistia: true, ordem: existente }
    }

    const statusResult = await db.query(
      'SELECT status_atual FROM solicitacoes WHERE id = $1',
      [solicitacaoId]
    )
    if (statusResult.rows.length === 0) {
      throw new Error(`Solicitacao ${solicitacaoId} nao encontrada para OS automatica`)
    }
    const statusAnterior = statusResult.rows[0].status_atual as string

    let result: { rows: Array<Record<string, unknown>> }
    try {
      result = await db.query(
        `INSERT INTO ordens_servico (solicitacao_id, equipe_id, status)
         VALUES ($1, NULL, $2)
         RETURNING *`,
        [solicitacaoId, STATUS_OS_AUTOMATICA]
      )
    } catch (error) {
      const codigo =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : ''
      const restricao =
        typeof error === 'object' && error !== null && 'constraint' in error
          ? String((error as { constraint?: unknown }).constraint ?? '')
          : ''
      const mensagem = error instanceof Error ? error.message : String(error)

      if (
        codigo === '23505' &&
        (restricao.includes('solicitacao_id') ||
          mensagem.includes('ordens_servico_solicitacao_id') ||
          mensagem.includes('idx_ordens_servico_solicitacao_id'))
      ) {
        const recuperada = await buscarOsDaSolicitacao(solicitacaoId)
        if (recuperada) {
          return { criada: false, jaExistia: true, ordem: recuperada }
        }
      }
      throw error
    }

    await db.query(
      `INSERT INTO status_logs
         (solicitacao_id, status_anterior, status_novo, observacao, criado_por)
       VALUES ($1, $2, $2, $3, $4)`,
      [
        solicitacaoId,
        statusAnterior,
        `Ordem de servico criada automaticamente (origem: ${ORIGEM_OS_AUTOMATICA})`,
        ORIGEM_OS_AUTOMATICA,
      ]
    )

    return {
      criada: true,
      jaExistia: false,
      ordem: result.rows[0],
    }
  })
}

export async function registrarFalhaOsAutomatica(
  solicitacaoId: number,
  erro: string
): Promise<void> {
  const detalhe = erro.slice(0, 500)
  console.error(
    `[OS_AUTOMATICA] Falha ao criar OS para solicitacao ${solicitacaoId}: ${detalhe}`
  )
  try {
    const sol = await db.query(
      'SELECT status_atual FROM solicitacoes WHERE id = $1',
      [solicitacaoId]
    )
    if (sol.rows.length === 0) return
    const statusAtual = sol.rows[0].status_atual as string
    await db.query(
      `INSERT INTO status_logs
         (solicitacao_id, status_anterior, status_novo, observacao, criado_por)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        solicitacaoId,
        statusAtual,
        statusAtual,
        `Falha na criacao automatica de OS: ${detalhe}`,
        'sistema',
      ]
    )
  } catch (logError) {
    console.error(
      `[OS_AUTOMATICA] Nao foi possivel registrar falha para solicitacao ${solicitacaoId}:`,
      logError
    )
  }
}
