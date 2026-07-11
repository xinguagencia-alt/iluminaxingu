export interface PosteReparado {
  equipe_nome: string
  poste_codigo: string | null
  poste_endereco: string | null
  poste_rua: string | null
  poste_numero: string | null
  poste_bairro: string | null
  ordem_servico_id: number
  data_abertura: string | null
  data_execucao: string | null
  data_encerramento: string | null
  os_status: string
  os_resultado: string | null
}
