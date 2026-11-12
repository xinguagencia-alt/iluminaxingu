import {
  TIPOS_PROBLEMA_PERMITIDOS,
  normalizarTipoProblema,
} from './validacao.js'

export { normalizarTipoProblema }

export interface TipoProblemaInfo {
  value: string
  label: string
}

const LABELS_TIPO_PROBLEMA: Record<string, string> = {
  poste_danificado: 'Poste danificado',
  lampada_apagada: 'Lampada apagada',
  lampada_piscando: 'Lampada piscando',
  lampada_acesa_dia: 'Luminária acesa 24 horas',
  risco_eletrico: 'Risco eletrico',
  fio_exposto: 'Fio exposto',
}

export const TIPOS_PROBLEMA: TipoProblemaInfo[] = TIPOS_PROBLEMA_PERMITIDOS.map(
  (value) => ({
    value,
    label: LABELS_TIPO_PROBLEMA[value] ?? value,
  })
)

export function labelTipoProblema(valor: unknown): string {
  if (typeof valor !== 'string' || !valor) return ''
  const canonico = normalizarTipoProblema(valor)
  const encontrado = TIPOS_PROBLEMA.find((tipo) => tipo.value === canonico)
  return encontrado ? encontrado.label : valor
}

function semAcento(texto: string): string {
  const semMarca = texto.normalize('NFD')
  return semMarca.replace(/\p{M}/gu, '').toLowerCase()
}

export function tiposProblemaQueContem(busca: string): string[] {
  const termo = semAcento(String(busca || '').trim())
  if (!termo) return []
  return TIPOS_PROBLEMA.filter(
    (tipo) => semAcento(tipo.label).includes(termo) || semAcento(tipo.value).includes(termo)
  ).map((tipo) => tipo.value)
}
