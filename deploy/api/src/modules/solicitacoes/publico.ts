import { db } from '../../db.js'
import { calcularStatusSla } from './sla.js'
import type { ConfirmacaoPublica } from './confirmacoes.js'
import type { ModoOperacional } from '../fluxo/routes.js'

const STATUS_LABELS_PUBLICOS: Record<string, string> = {
  enviada: 'Enviada',
  em_analise: 'Em analise',
  em_execucao: 'Em execucao',
  concluida: 'Concluida',
  em_manutencao: 'Em manutencao',
  nao_procedente: 'Nao procedente',
  cancelada: 'Cancelada',
  duplicada: 'Duplicada',
}

export type EstadoOsPublico =
  | 'sem_os'
  | 'em_fila'
  | 'atribuida'
  | 'em_andamento'
  | 'encerrada'

const ESTADOS_OS_LABELS: Record<EstadoOsPublico, string> = {
  sem_os: 'Sem ordem de servico',
  em_fila: 'Em fila',
  atribuida: 'Atribuida',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
}

export interface EstadoOsResposta {
  existe: boolean
  estado: EstadoOsPublico
  estado_label: string
}

export function classificarEstadoOs(
  status: unknown,
  equipeId: unknown
): EstadoOsPublico {
  const temEquipe = equipeId !== null && equipeId !== undefined
  switch (String(status)) {
    case 'aberta':
      return temEquipe ? 'atribuida' : 'em_fila'
    case 'em_execucao':
    case 'em_manutencao':
      return 'em_andamento'
    case 'concluida':
    case 'cancelada':
      return 'encerrada'
    default:
      return 'em_andamento'
  }
}

export function montarEstadoOs(
  status: unknown,
  equipeId: unknown
): EstadoOsResposta {
  if (status === null || status === undefined) {
    return {
      existe: false,
      estado: 'sem_os',
      estado_label: ESTADOS_OS_LABELS.sem_os,
    }
  }
  const estado = classificarEstadoOs(status, equipeId)
  return { existe: true, estado, estado_label: ESTADOS_OS_LABELS[estado] }
}

export async function buscarEstadoOsPublico(
  solicitacaoId: number
): Promise<EstadoOsResposta> {
  try {
    const result = await db.query(
      `SELECT status, equipe_id FROM ordens_servico
        WHERE solicitacao_id = $1
        LIMIT 1`,
      [solicitacaoId]
    )
    if (result.rows.length === 0) {
      return montarEstadoOs(null, null)
    }
    const os = result.rows[0] as { status?: unknown; equipe_id?: unknown }
    return montarEstadoOs(os.status, os.equipe_id)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    console.warn(`[PUBLICO] Estado da OS indisponivel para solicitacao ${solicitacaoId}:`, mensagem)
    return montarEstadoOs(null, null)
  }
}

export interface ContextoRespostaPublica {
  duplicada: boolean
  fluxo: ModoOperacional | string
  confirmacao: ConfirmacaoPublica | null
  elegivelOsAutomatica?: boolean
}

export async function montarRespostaPublica(
  row: Record<string, unknown>,
  contexto: ContextoRespostaPublica
): Promise<Record<string, unknown>> {
  const statusAtual = String(row.status_atual ?? 'enviada')
  const prioridade = String(row.prioridade ?? 'baixa')
  const criadoEm = row.criado_em as string | Date
  const atualizadoEm = (row.atualizado_em as string | Date | undefined) ?? criadoEm

  const sla = calcularStatusSla({
    prioridade,
    criado_em: criadoEm,
    status_atual: statusAtual,
    atualizado_em: atualizadoEm,
  })

  const os = await buscarEstadoOsPublico(Number(row.id))

  return {
    id: Number(row.id),
    protocolo: String(row.protocolo),
    status_atual: statusAtual,
    status_label: STATUS_LABELS_PUBLICOS[statusAtual] ?? statusAtual,
    prioridade,
    prazo_sla: sla.prazo_sla.toISOString(),
    status_sla: sla.status_sla,
    horas_restantes: sla.horas_restantes,
    os,
    confirmacao: contexto.confirmacao,
    duplicada: contexto.duplicada,
    fluxo: contexto.fluxo,
    elegivel_os_automatica: contexto.elegivelOsAutomatica ?? false,
    os_automatica: null,
  }
}
