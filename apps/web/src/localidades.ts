export type TipoLocalidade = 'sede' | 'distrito' | 'vila'

export interface Localidade {
  id: number
  nome: string
  tipo: TipoLocalidade
}

export const TIPO_LOCALIDADE_LABELS: Record<TipoLocalidade, string> = {
  sede: 'Sede',
  distrito: 'Distrito',
  vila: 'Vila',
}

export function ehTipoLocalidade(valor: unknown): valor is TipoLocalidade {
  return valor === 'sede' || valor === 'distrito' || valor === 'vila'
}

export function rotuloTipoLocalidade(tipo: string | null | undefined): string | null {
  return tipo && ehTipoLocalidade(tipo) ? TIPO_LOCALIDADE_LABELS[tipo] : null
}

export function rotuloLocalidade(
  nome: string | null | undefined,
  tipo: string | null | undefined
): string {
  if (!nome?.trim()) return 'Localidade não informada'
  const tipoLabel = rotuloTipoLocalidade(tipo)
  return tipoLabel ? `${tipoLabel} — ${nome}` : nome
}

export function normalizarCatalogoLocalidades(valor: unknown): Localidade[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is Localidade => {
    if (!item || typeof item !== 'object') return false
    const localidade = item as Partial<Localidade> & { ativo?: unknown }
    return (
      Number.isSafeInteger(localidade.id) &&
      Number(localidade.id) > 0 &&
      typeof localidade.nome === 'string' &&
      localidade.nome.trim().length > 0 &&
      ehTipoLocalidade(localidade.tipo) &&
      localidade.ativo !== false
    )
  })
}
