export type StatusOrdemServico = 'aberta' | 'em_execucao' | 'concluida' | 'cancelada'

export interface OrdemServico {
  id: number
  solicitacao_id: number
  equipe_id: number | null
  equipe_nome: string | null
  status: StatusOrdemServico
  data_abertura: string | null
  data_execucao: string | null
  data_encerramento: string | null
  observacao_execucao: string | null
  resultado: string | null
  criado_em: string
  atualizado_em: string
  protocolo: string
  tipo_problema: string
  endereco_informado: string | null
}

export const STATUS_ORDEM_LABELS: Record<StatusOrdemServico, string> = {
  aberta: 'Aberta',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const STATUS_ORDEM_COLORS: Record<StatusOrdemServico, string> = {
  aberta: '#2563eb',
  em_execucao: '#7c3aed',
  concluida: '#16a34a',
  cancelada: '#dc2626',
}
