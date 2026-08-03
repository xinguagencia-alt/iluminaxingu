import { db } from '../../db.js'

const PRIORIDADE_ORDEM = ['baixa', 'media', 'alta', 'urgente'] as const

export type Prioridade = typeof PRIORIDADE_ORDEM[number]

export function calcularPrioridadeBase(tipoProblema: string): Prioridade {
  switch (tipoProblema) {
    case 'risco_eletrico':
    case 'fio_exposto':
      return 'urgente'
    case 'poste_danificado':
      return 'alta'
    case 'lampada_apagada':
    case 'lampada_piscando':
      return 'media'
    default:
      return 'baixa'
  }
}

export function elevarPrioridade(prioridade: Prioridade): Prioridade {
  const idx = PRIORIDADE_ORDEM.indexOf(prioridade)
  if (idx < PRIORIDADE_ORDEM.length - 1) {
    return PRIORIDADE_ORDEM[idx + 1]
  }
  return 'urgente'
}

export async function contarSolicitacoesAbertas(posteId: number | null, codigoPoste: string | null): Promise<number> {
  const statusFechados = ['concluida', 'cancelada', 'nao_procedente', 'duplicada']

  const conditions: string[] = [
    `status_atual != ALL($1)`,
    `criado_em >= NOW() - INTERVAL '7 days'`,
  ]
  const values: unknown[] = [statusFechados]
  let paramIndex = 2

  if (posteId && codigoPoste) {
    conditions.push(`(poste_id = $${paramIndex} OR codigo_poste_informado = $${paramIndex + 1})`)
    values.push(posteId, codigoPoste)
  } else if (posteId) {
    conditions.push(`poste_id = $${paramIndex}`)
    values.push(posteId)
  } else if (codigoPoste) {
    conditions.push(`codigo_poste_informado = $${paramIndex}`)
    values.push(codigoPoste)
  } else {
    return 0
  }

  const result = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM solicitacoes
     WHERE ${conditions.join(' AND ')}`,
    values
  )
  return result.rows[0]?.total ?? 0
}

export async function calcularPrioridadeAutomatica(
  tipoProblema: string,
  posteId: number | null,
  codigoPoste: string | null,
): Promise<Prioridade> {
  let prioridade = calcularPrioridadeBase(tipoProblema)

  const totalAbertas = await contarSolicitacoesAbertas(posteId, codigoPoste)
  if (totalAbertas >= 3) {
    prioridade = elevarPrioridade(prioridade)
  }

  return prioridade
}
