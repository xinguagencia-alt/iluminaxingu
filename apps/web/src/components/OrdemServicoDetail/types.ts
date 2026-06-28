import { StatusOrdemServico } from '../OrdemServicoList/types'

export interface OrdemServicoDetalhe {
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
  nome_solicitante: string
  telefone: string | null
  email: string | null
  solicitacao_descricao: string | null
  codigo_poste_informado: string | null
  poste_id: number | null
  solicitacao_latitude: number | null
  solicitacao_longitude: number | null
  poste_codigo: string | null
  poste_endereco: string | null
  poste_rua: string | null
  poste_numero: string | null
  poste_bairro: string | null
  poste_complemento: string | null
  poste_latitude: number | null
  poste_longitude: number | null
  prioridade: string
}

export interface StatusLog {
  id: number
  solicitacao_id: number
  status_anterior: string | null
  status_novo: string
  observacao: string | null
  criado_por: string | null
  criado_por_username: string | null
  criado_em: string
}

export interface Anexo {
  id: number
  solicitacao_id: number | null
  ordem_servico_id: number | null
  arquivo_nome: string
  arquivo_path: string
  arquivo_tipo: string | null
  tamanho_bytes: number | null
  criado_em: string
}

export interface OrdemServicoDetailData {
  ordem: OrdemServicoDetalhe
  historico: StatusLog[]
  anexos: Anexo[]
}
