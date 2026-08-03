const PRAZO_HORAS: Record<string, number> = {
  urgente: 24,
  alta: 48,
  media: 120,
  baixa: 240,
}

const STATUS_FECHADOS = ['concluida', 'cancelada', 'nao_procedente', 'duplicada']

export type StatusSla =
  | 'dentro_do_prazo'
  | 'vence_hoje'
  | 'atrasada'
  | 'concluida_no_prazo'
  | 'concluida_com_atraso'

export interface ResultadoSla {
  prazo_sla: Date
  status_sla: StatusSla
  horas_restantes: number | null
}

export function calcularPrazoSla(prioridade: string, criadoEm: Date): Date {
  const horas = PRAZO_HORAS[prioridade] ?? PRAZO_HORAS.baixa
  const prazo = new Date(criadoEm)
  prazo.setHours(prazo.getHours() + horas)
  return prazo
}

export function calcularStatusSla(solicitacao: {
  prioridade: string
  criado_em: string | Date
  status_atual: string
  atualizado_em: string | Date
}): ResultadoSla {
  const criadoEm = new Date(solicitacao.criado_em)
  const prazoSla = calcularPrazoSla(solicitacao.prioridade, criadoEm)
  const agora = new Date()

  if (STATUS_FECHADOS.includes(solicitacao.status_atual)) {
    const dataConclusao = new Date(solicitacao.atualizado_em)
    if (dataConclusao <= prazoSla) {
      return { prazo_sla: prazoSla, status_sla: 'concluida_no_prazo', horas_restantes: null }
    }
    return { prazo_sla: prazoSla, status_sla: 'concluida_com_atraso', horas_restantes: null }
  }

  const milisRestantes = prazoSla.getTime() - agora.getTime()
  const horasRestantes = milisRestantes / (1000 * 60 * 60)

  if (horasRestantes <= 0) {
    return { prazo_sla: prazoSla, status_sla: 'atrasada', horas_restantes: Math.floor(horasRestantes) }
  }

  if (horasRestantes <= 24) {
    return { prazo_sla: prazoSla, status_sla: 'vence_hoje', horas_restantes: Math.ceil(horasRestantes) }
  }

  return { prazo_sla: prazoSla, status_sla: 'dentro_do_prazo', horas_restantes: Math.ceil(horasRestantes) }
}

export function injectSla(row: Record<string, unknown>): Record<string, unknown> {
  const resultado = calcularStatusSla({
    prioridade: row.prioridade as string,
    criado_em: row.criado_em as string,
    status_atual: row.status_atual as string,
    atualizado_em: row.atualizado_em as string,
  })

  return {
    ...row,
    prazo_sla: resultado.prazo_sla.toISOString(),
    status_sla: resultado.status_sla,
    horas_restantes: resultado.horas_restantes,
  }
}
