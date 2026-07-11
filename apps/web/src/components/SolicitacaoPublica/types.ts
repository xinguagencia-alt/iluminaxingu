import { StatusSolicitacao, PrioridadeSolicitacao } from '../SolicitacaoList/types'
import { StatusOrdemServico } from '../OrdemServicoList/types'

export interface SolicitacaoPublica {
  id: number
  protocolo: string
  codigo_poste_informado: string | null
  tipo_problema: string
  status_atual: StatusSolicitacao
  prioridade: PrioridadeSolicitacao
  criado_em: string
  atualizado_em: string
  ordem_servico_id: number | null
  os_status: StatusOrdemServico | null
  os_data_abertura: string | null
  os_data_encerramento: string | null
}

export interface StatusLogPublico {
  id: number
  status_anterior: string | null
  status_novo: string
  criado_em: string
}

export interface SolicitacaoPublicaData {
  solicitacao: SolicitacaoPublica
  historico: StatusLogPublico[]
}
