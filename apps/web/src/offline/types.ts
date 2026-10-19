export interface AnexoPendente {
  nome: string
  tipo: string
  tamanho: number
  blob: Blob
}

export interface SolicitacaoPayload {
  nome_solicitante: string
  telefone: string
  email: string | null
  codigo_poste: string | null
  poste_id: number | null
  endereco_informado: string | null
  latitude: number | null
  longitude: number | null
  tipo_problema: string
  descricao: string | null
  consentimento_lgpd: boolean
}

export type EstadoPendente = 'pendente' | 'enviando' | 'enviada' | 'erro'

export interface SolicitacaoPendente {
  id_local: string
  payload: SolicitacaoPayload
  anexos: AnexoPendente[]
  anexos_descartados: boolean
  estado: EstadoPendente
  criado_em: number
  protocolo_oficial: string | null
  solicitacao_id?: number
  tentativas?: number
  proxima_tentativa_em?: number | null
  ultimo_erro?: string | null
  erro_retryavel?: boolean
  anexos_enviados?: number[]
  atualizado_em?: number
}

export interface ResultadoProtocolo {
  protocolo: string
  nome: string
}

export interface ErroSync {
  id_local: string
  nome: string
  mensagem: string
}

export interface EstadoSync {
  sincronizando: boolean
  progresso: { atual: number; total: number } | null
  resultados: ResultadoProtocolo[]
  erros: ErroSync[]
  proxima_tentativa_em: number | null
}

export const EVENTO_FILA_ALTERADA = 'ilx:offline-fila-alterada'
