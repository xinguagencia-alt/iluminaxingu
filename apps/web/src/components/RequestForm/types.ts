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
  consentimentoLgpd?: string
}

export type TipoProblema = 
  | 'poste_danificado'
  | 'lampada_apagada'
  | 'lampada_piscando'
  | 'risco_eletrico'
  | 'fio_exposto'
  | 'outro'

export const TIPOS_PROBLEMA: { value: TipoProblema; label: string }[] = [
  { value: 'poste_danificado', label: 'Poste danificado' },
  { value: 'lampada_apagada', label: 'Lâmpada apagada' },
  { value: 'lampada_piscando', label: 'Lâmpada piscando' },
  { value: 'risco_eletrico', label: 'Risco elétrico' },
  { value: 'fio_exposto', label: 'Fio exposto' },
  { value: 'outro', label: 'Outro' },
]
