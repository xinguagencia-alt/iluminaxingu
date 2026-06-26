import { StatusSolicitacao, PrioridadeSolicitacao } from '../SolicitacaoList/types'
import { StatusOrdemServico } from '../OrdemServicoList/types'

export interface SolicitacaoPublica {
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
  criado_em: string
  atualizado_em: string
  ordem_servico_id: number | null
  os_status: StatusOrdemServico | null
  equipe_id: number | null
  equipe_nome: string | null
  os_data_abertura: string | null
  os_data_encerramento: string | null
  os_observacao: string | null
  os_resultado: string | null
}

export interface StatusLogPublico {
  id: number
  solicitacao_id: number
  status_anterior: string | null
  status_novo: string
  observacao: string | null
  criado_por_username: string | null
  criado_em: string
}

export interface AnexoPublico {
  id: number
  arquivo_nome: string
  arquivo_tipo: string | null
  tamanho_bytes: number | null
  criado_em: string
}

export interface SolicitacaoPublicaData {
  solicitacao: SolicitacaoPublica
  historico: StatusLogPublico[]
  anexos: AnexoPublico[]
}
