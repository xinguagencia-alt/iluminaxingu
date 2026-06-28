export type StatusSolicitacao =
  | 'enviada'
  | 'em_analise'
  | 'em_execucao'
  | 'concluida'
  | 'em_manutencao'
  | 'nao_procedente'
  | 'cancelada'
  | 'duplicada'

export type PrioridadeSolicitacao = 'baixa' | 'media' | 'alta' | 'urgente'

export interface Solicitacao {
  id: number
  protocolo: string
  nome_solicitante: string
  telefone: string | null
  email: string | null
  codigo_poste_informado: string | null
  endereco_informado: string | null
  latitude: number | null
  longitude: number | null
  tipo_problema: string
  descricao: string | null
  status_atual: StatusSolicitacao
  prioridade: PrioridadeSolicitacao
  ordem_servico_id: number | null
  criado_em: string
  atualizado_em: string
}

export const STATUS_LABELS: Record<StatusSolicitacao, string> = {
  enviada: 'Enviada',
  em_analise: 'Em análise',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  em_manutencao: 'Em manutenção',
  nao_procedente: 'Não procedente',
  cancelada: 'Cancelada',
  duplicada: 'Duplicada',
}

export const STATUS_COLORS: Record<StatusSolicitacao, string> = {
  enviada: '#2563eb',
  em_analise: '#d97706',
  em_execucao: '#7c3aed',
  concluida: '#16a34a',
  em_manutencao: '#d97706',
  nao_procedente: '#6b7280',
  cancelada: '#dc2626',
  duplicada: '#9ca3af',
}

export const PRIORIDADE_LABELS: Record<PrioridadeSolicitacao, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const PRIORIDADE_COLORS: Record<PrioridadeSolicitacao, string> = {
  baixa: '#6b7280',
  media: '#2563eb',
  alta: '#d97706',
  urgente: '#dc2626',
}

export const TIPOS_PROBLEMA: Record<string, string> = {
  poste_danificado: 'Poste danificado',
  lampada_apagada: 'Lâmpada apagada',
  lampada_piscando: 'Lâmpada piscando',
  risco_eletrico: 'Risco elétrico',
  fio_exposto: 'Fio exposto',
  outro: 'Outro',
}
