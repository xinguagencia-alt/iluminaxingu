import { db } from '../../db.js'
import { extrairRuaBairro, normalizarEspacos } from './validacao.js'

export const STATUS_FECHADOS_DUPLICIDADE = [
  'concluida',
  'cancelada',
  'nao_procedente',
  'duplicada',
] as const

const CASAS_GEOGRAPHIA = 5

export function janelaDuplicidadeHoras(): number {
  const configurado = Number(process.env.DUPLICIDADE_JANELA_HORAS)
  if (Number.isFinite(configurado) && configurado > 0) return configurado
  return 24
}

export function arredondarCoordenada(valor: number, casas = CASAS_GEOGRAPHIA): number {
  const fator = 10 ** casas
  return Math.round(valor * fator) / fator
}

function normalizarTrecho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface EntradaChaveLocalizacao {
  poste_id?: number | string | null
  codigo_poste?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  endereco?: string | null
}

export function montarChaveLocalizacao(entrada: EntradaChaveLocalizacao): string | null {
  const posteId =
    entrada.poste_id !== undefined && entrada.poste_id !== null && entrada.poste_id !== ''
      ? Number(entrada.poste_id)
      : null
  if (posteId !== null && Number.isFinite(posteId)) {
    return `poste:${posteId}`
  }

  const codigo = normalizarEspacos(entrada.codigo_poste)
  if (codigo) {
    return `codigo:${codigo.toUpperCase()}`
  }

  const lat =
    entrada.latitude !== undefined && entrada.latitude !== null && entrada.latitude !== ''
      ? Number(entrada.latitude)
      : null
  const lng =
    entrada.longitude !== undefined && entrada.longitude !== null && entrada.longitude !== ''
      ? Number(entrada.longitude)
      : null
  if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `gps:${arredondarCoordenada(lat)},${arredondarCoordenada(lng)}`
  }

  const endereco = normalizarEspacos(entrada.endereco)
  if (endereco) {
    const { rua, bairro } = extrairRuaBairro(endereco)
    if (rua && bairro) {
      return `addr:${normalizarTrecho(rua)}|${normalizarTrecho(bairro)}`
    }
  }

  return null
}

const filasLocalizacao = new Map<string, Promise<unknown>>()

export function comLockLocalizacao<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  const anterior = filasLocalizacao.get(chave) ?? Promise.resolve()
  const execucao = anterior.then(fn, fn)
  const limpo = execucao.then(
    () => undefined,
    () => undefined
  )
  filasLocalizacao.set(chave, limpo)
  return execucao
}

export async function buscarSolicitacaoDuplicada(
  chaveLocal: string | null,
  tipoProblema: string
): Promise<Record<string, unknown> | null> {
  if (!chaveLocal) return null

  const janelaHoras = janelaDuplicidadeHoras()
  const limite = new Date(Date.now() - janelaHoras * 60 * 60 * 1000)

  const result = await db.query(
    `SELECT * FROM solicitacoes
     WHERE tipo_problema = $1
       AND NOT (status_atual = ANY($2::text[]))
       AND criado_em >= $3
     ORDER BY criado_em DESC`,
    [tipoProblema, [...STATUS_FECHADOS_DUPLICIDADE], limite]
  )

  for (const row of result.rows as Record<string, unknown>[]) {
    const chaveLinha = montarChaveLocalizacao({
      poste_id: (row.poste_id as number | string | null) ?? null,
      codigo_poste: (row.codigo_poste_informado as string | null) ?? null,
      latitude: (row.latitude as number | string | null) ?? null,
      longitude: (row.longitude as number | string | null) ?? null,
      endereco: (row.endereco_informado as string | null) ?? null,
    })
    if (chaveLinha && chaveLinha === chaveLocal) {
      return row
    }
  }

  return null
}
