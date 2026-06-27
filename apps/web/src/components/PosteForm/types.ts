export interface Poste {
  id: number
  codigo: string
  endereco: string | null
  rua: string | null
  numero: string | null
  bairro: string | null
  complemento: string | null
  latitude: number | null
  longitude: number | null
  tipo_luminaria: string | null
  potencia: number | null
  data_instalacao: string | null
  data_ultima_manutencao: string | null
  status_ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface PosteFormData {
  codigo: string
  rua: string
  numero: string
  bairro: string
  complemento: string
  latitude: string
  longitude: string
  tipo_luminaria: string
  potencia: string
  data_instalacao: string
}

export interface PosteFormErrors {
  codigo?: string
  latitude?: string
  longitude?: string
  potencia?: string
}

export const TIPOS_LUMINARIA: { value: string; label: string }[] = [
  { value: 'LED', label: 'LED' },
  { value: 'SODIO', label: 'Sodio' },
  { value: 'MERCURIO', label: 'Mercurio' },
  { value: 'HPS', label: 'HPS (Vapor de Sodio)' },
  { value: 'METAL_HALIDE', label: 'Halogenetos Metalicos' },
  { value: 'OUTRO', label: 'Outro' },
]
