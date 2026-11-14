export interface FormData {
  nome: string
  telefone: string
  email: string
  latitude: number | null
  longitude: number | null
  enderecoManual: string
  codigoPoste: string
  posteId: number | null
  tipoProblema: string
  descricao: string
  consentimentoLgpd: boolean
}

export interface FormErrors {
  nome?: string
  contato?: string
  tipoProblema?: string
  localizacao?: string
  consentimentoLgpd?: string
}

export type TipoProblema = 
  | 'poste_danificado'
  | 'lampada_apagada'
  | 'lampada_piscando'
  | 'lampada_acesa_dia'
  | 'risco_eletrico'
  | 'fio_exposto'

export interface ConfirmacaoInfo {
  registrada: boolean
  ja_existia: boolean
  total_moradores: number
  elevou_prioridade: boolean
  prioridade_anterior: string | null
  prioridade_nova: string | null
}

export interface EstadoOsInfo {
  existe: boolean
  estado: string
  estado_label: string
}

export interface DuplicadaInfo {
  id: number
  protocolo: string
  status_atual: string
  status_label: string
  prioridade: string
  os: EstadoOsInfo | null
  confirmacao: ConfirmacaoInfo | null
  fluxo: string
}

export const TIPOS_PROBLEMA: { value: TipoProblema; label: string }[] = [
  { value: 'poste_danificado', label: 'Poste danificado' },
  { value: 'lampada_apagada', label: 'Lâmpada apagada' },
  { value: 'lampada_piscando', label: 'Lâmpada piscando' },
  { value: 'lampada_acesa_dia', label: 'Luminária acesa 24 horas' },
  { value: 'risco_eletrico', label: 'Risco elétrico' },
  { value: 'fio_exposto', label: 'Fio exposto' },
]
