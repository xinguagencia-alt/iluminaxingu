export type TipoLocalidade = 'sede' | 'distrito' | 'vila'

export interface LocalidadeOpcao {
  id: number
  nome: string
  tipo: TipoLocalidade
}

export type EstadoCatalogoLocalidades = 'carregando' | 'pronto' | 'erro'

export function ehTipoLocalidade(valor: unknown): valor is TipoLocalidade {
  return valor === 'sede' || valor === 'distrito' || valor === 'vila'
}

export function normalizarLocalidades(valor: unknown): LocalidadeOpcao[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is LocalidadeOpcao => {
    if (!item || typeof item !== 'object') return false
    const localidade = item as Partial<LocalidadeOpcao> & { ativo?: unknown }
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

export function localidadesDoTipo(
  localidades: LocalidadeOpcao[],
  tipo: string
): LocalidadeOpcao[] {
  if (!ehTipoLocalidade(tipo)) return []
  return localidades.filter((localidade) => localidade.tipo === tipo)
}

export function selecaoAposTrocarTipo(tipo: TipoLocalidade | ''): {
  tipoLocalidade: TipoLocalidade | ''
  localidadeId: string
} {
  return { tipoLocalidade: tipo, localidadeId: '' }
}

export function validarSelecaoLocalidade(
  tipo: string,
  id: string,
  localidades: LocalidadeOpcao[],
  estadoCatalogo: EstadoCatalogoLocalidades
): string | null {
  if (estadoCatalogo === 'carregando') {
    return 'Aguarde o carregamento das localidades antes de enviar.'
  }

  if (estadoCatalogo === 'erro' || localidades.length === 0) {
    return tipo || id
      ? 'A lista de localidades nao esta disponivel. Limpe a selecao e tente novamente.'
      : null
  }

  if (!tipo || !id) {
    return 'Selecione o tipo e a localidade do problema.'
  }

  const selecionada = localidades.find((localidade) => String(localidade.id) === id)
  if (!selecionada) return 'A localidade selecionada nao esta mais disponivel. Escolha novamente.'
  if (selecionada.tipo !== tipo) return 'A localidade nao corresponde ao tipo selecionado.'
  return null
}
