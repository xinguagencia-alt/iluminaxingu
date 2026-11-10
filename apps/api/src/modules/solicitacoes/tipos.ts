export interface TipoProblemaInfo {
  value: string
  label: string
}

export const TIPOS_PROBLEMA: TipoProblemaInfo[] = [
  { value: 'poste_danificado', label: 'Poste danificado' },
  { value: 'lampada_apagada', label: 'Lampada apagada' },
  { value: 'lampada_piscando', label: 'Lampada piscando' },
  { value: 'lampada_acesa_dia', label: 'Luminária acesa 24 horas' },
  { value: 'risco_eletrico', label: 'Risco eletrico' },
  { value: 'fio_exposto', label: 'Fio exposto' },
  { value: 'outro', label: 'Outro' },
]

const ALIASES_TIPO_PROBLEMA: Record<string, string> = {
  luminaria_acesa_24h: 'lampada_acesa_dia',
}

export function normalizarTipoProblema(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  const limpo = valor.trim()
  return ALIASES_TIPO_PROBLEMA[limpo] ?? limpo
}

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
