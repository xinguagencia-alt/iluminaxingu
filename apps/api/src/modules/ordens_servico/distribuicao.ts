import { db } from '../../db.js'
import { comLockLocalizacao } from '../solicitacoes/duplicidade.js'
import { registrarAuditoria } from '../auditoria/helper.js'
import { ORIGEM_OS_AUTOMATICA } from './automatica.js'

export const CAPACIDADE_PADRAO_ABERTAS = 3
export const STATUS_OS_EM_FILA = 'aberta'
export const MOTIVO_FILA_SEM_EQUIPE = 'nenhuma_equipe_disponivel'

const STATUS_ABERTAS_CONTAGEM = ['aberta', 'em_execucao']

export interface EquipeCandidata {
  id: number
  nome: string
  carga_abertas: number
  capacidade: number
  criterio: string
}

export interface ResultadoDistribuicao {
  os_id: number
  atribuida: boolean
  equipe_id: number | null
  equipe_nome: string | null
  motivo: string | null
  ja_atribuida: boolean
  criterio: string | null
}

interface ColunasEquipe {
  disponibilidade: boolean
  capacidade: boolean
  especialidades: boolean
}

let cacheColunas: ColunasEquipe | null = null

export async function detectarColunasEquipe(forcar = false): Promise<ColunasEquipe> {
  if (cacheColunas && !forcar) return cacheColunas
  try {
    const result = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'equipes'`
    )
    const nomes = new Set(
      result.rows.map((row: { column_name: string }) => row.column_name)
    )
    cacheColunas = {
      disponibilidade: nomes.has('status_disponibilidade'),
      capacidade: nomes.has('capacidade_maxima'),
      especialidades: nomes.has('especialidades'),
    }
  } catch {
    cacheColunas = { disponibilidade: false, capacidade: false, especialidades: false }
  }
  return cacheColunas
}

export function resetarCacheColunasEquipe(): void {
  cacheColunas = null
}

function normalizarListaEspecialidades(valor: unknown): string[] {
  if (typeof valor !== 'string' || !valor.trim()) return []
  return valor
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function equipeCompativel(
  especialidades: unknown,
  tipoProblema: string
): boolean {
  const lista = normalizarListaEspecialidades(especialidades)
  if (lista.length === 0) return true
  return lista.includes(tipoProblema.toLowerCase())
}

export function escolherEquipe(
  candidatas: EquipeCandidata[]
): EquipeCandidata | null {
  if (candidatas.length === 0) return null
  const ordenadas = [...candidatas].sort((a, b) => {
    if (a.carga_abertas !== b.carga_abertas) {
      return a.carga_abertas - b.carga_abertas
    }
    if (a.id !== b.id) return a.id - b.id
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
  return ordenadas[0]
}

export async function listarEquipesElegiveis(
  tipoProblema: string
): Promise<{ candidatas: EquipeCandidata[]; descartadas: Array<{ id: number; nome: string; motivo: string }> }> {
  const colunas = await detectarColunasEquipe()

  const selectExtras = [
    colunas.disponibilidade ? 'status_disponibilidade' : `'disponivel' AS status_disponibilidade`,
    colunas.capacidade ? 'capacidade_maxima' : `${CAPACIDADE_PADRAO_ABERTAS} AS capacidade_maxima`,
    colunas.especialidades ? 'especialidades' : 'NULL AS especialidades',
  ].join(', ')

  const result = await db.query(
    `SELECT e.id, e.nome, e.ativo, ${selectExtras}
     FROM equipes e
     WHERE e.ativo = true
     ORDER BY e.id`
  )

  const candidatas: EquipeCandidata[] = []
  const descartadas: Array<{ id: number; nome: string; motivo: string }> = []

  for (const row of result.rows as Record<string, unknown>[]) {
    const id = Number(row.id)
    const nome = String(row.nome)
    const disponibilidade = String(row.status_disponibilidade ?? 'disponivel')
    const capacidade = Number(row.capacidade_maxima ?? CAPACIDADE_PADRAO_ABERTAS)

    if (disponibilidade !== 'disponivel') {
      descartadas.push({ id, nome, motivo: `disponibilidade_${disponibilidade}` })
      continue
    }

    if (!equipeCompativel(row.especialidades, tipoProblema)) {
      descartadas.push({ id, nome, motivo: 'incompativel_com_tipo' })
      continue
    }

    const cargaResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM ordens_servico
       WHERE equipe_id = $1 AND status = ANY($2::text[])`,
      [id, [...STATUS_ABERTAS_CONTAGEM]]
    )
    const carga = Number(cargaResult.rows[0].total)

    if (carga >= capacidade) {
      descartadas.push({ id, nome, motivo: 'capacidade_atingida' })
      continue
    }

    candidatas.push({
      id,
      nome,
      carga_abertas: carga,
      capacidade,
      criterio: 'disponivel_menor_carga_id',
    })
  }

  return { candidatas, descartadas }
}

async function gravarHistoricoDistribuicao(
  solicitacaoId: number,
  observacao: string,
  criadoPor: string
): Promise<void> {
  const sol = await db.query(
    'SELECT status_atual FROM solicitacoes WHERE id = $1',
    [solicitacaoId]
  )
  if (sol.rows.length === 0) return
  const statusAtual = String(sol.rows[0].status_atual)
  await db.query(
    `INSERT INTO status_logs
       (solicitacao_id, status_anterior, status_novo, observacao, criado_por)
     VALUES ($1, $2, $3, $4, $5)`,
    [solicitacaoId, statusAtual, statusAtual, observacao, criadoPor]
  )
}

export async function distribuirOs(
  osId: number,
  opcoes: { origem?: string } = {}
): Promise<ResultadoDistribuicao> {
  const origem = opcoes.origem ?? ORIGEM_OS_AUTOMATICA

  return comLockLocalizacao(`os-dist|${osId}`, async () => {
    const osResult = await db.query(
      `SELECT os.id, os.solicitacao_id, os.equipe_id, os.status, s.tipo_problema
       FROM ordens_servico os
       JOIN solicitacoes s ON s.id = os.solicitacao_id
       WHERE os.id = $1`,
      [osId]
    )
    if (osResult.rows.length === 0) {
      throw new Error(`Ordem de servico ${osId} nao encontrada`)
    }
    const os = osResult.rows[0] as Record<string, unknown>

    if (os.equipe_id !== null && os.equipe_id !== undefined) {
      const equipe = await db.query('SELECT id, nome FROM equipes WHERE id = $1', [
        os.equipe_id,
      ])
      return {
        os_id: osId,
        atribuida: false,
        equipe_id: Number(os.equipe_id),
        equipe_nome: equipe.rows[0]?.nome ?? null,
        motivo: null,
        ja_atribuida: true,
        criterio: null,
      }
    }

    if (String(os.status) !== STATUS_OS_EM_FILA) {
      return {
        os_id: osId,
        atribuida: false,
        equipe_id: null,
        equipe_nome: null,
        motivo: `status_${os.status}`,
        ja_atribuida: false,
        criterio: null,
      }
    }

    const tipoProblema = String(os.tipo_problema)
    const solicitacaoId = Number(os.solicitacao_id)
    const { candidatas } = await listarEquipesElegiveis(tipoProblema)
    const escolhida = escolherEquipe(candidatas)

    if (!escolhida) {
      await gravarHistoricoDistribuicao(
        solicitacaoId,
        `Distribuicao automatica pendente: ${MOTIVO_FILA_SEM_EQUIPE} (origem: ${origem})`,
        origem
      )
      return {
        os_id: osId,
        atribuida: false,
        equipe_id: null,
        equipe_nome: null,
        motivo: MOTIVO_FILA_SEM_EQUIPE,
        ja_atribuida: false,
        criterio: null,
      }
    }

    const update = await db.query(
      `UPDATE ordens_servico
       SET equipe_id = $1
       WHERE id = $2 AND equipe_id IS NULL AND status = $3
       RETURNING id, equipe_id`,
      [escolhida.id, osId, STATUS_OS_EM_FILA]
    )

    if (update.rows.length === 0) {
      const atual = await db.query(
        'SELECT equipe_id FROM ordens_servico WHERE id = $1',
        [osId]
      )
      const equipeAtual = atual.rows[0]?.equipe_id ?? null
      return {
        os_id: osId,
        atribuida: false,
        equipe_id: equipeAtual !== null ? Number(equipeAtual) : null,
        equipe_nome: null,
        motivo: null,
        ja_atribuida: equipeAtual !== null,
        criterio: null,
      }
    }

    const criterio = `disponivel;menor_carga(${escolhida.carga_abertas});id=${escolhida.id}`

    await gravarHistoricoDistribuicao(
      solicitacaoId,
      `Distribuicao automatica: equipe "${escolhida.nome}" (criterio: ${criterio}; origem: ${origem}; data: ${new Date().toISOString()})`,
      origem
    )

    await registrarAuditoria({
      tabela: 'ordens_servico',
      registroId: osId,
      acao: 'editar',
      dadosAntes: { equipe_id: null, status: os.status },
      dadosDepois: {
        equipe_id: escolhida.id,
        equipe_nome: escolhida.nome,
        criterio,
        origem,
        tipo_problema: tipoProblema,
      },
      usuarioId: null,
      usuarioNome: origem,
    })

    return {
      os_id: osId,
      atribuida: true,
      equipe_id: escolhida.id,
      equipe_nome: escolhida.nome,
      motivo: null,
      ja_atribuida: false,
      criterio,
    }
  })
}

export async function processarFilaDistribuicao(): Promise<{
  processadas: number
  atribuidas: number
  pendentes: number
}> {
  const fila = await db.query(
    `SELECT os.id FROM ordens_servico os
     WHERE os.equipe_id IS NULL AND os.status = $1
     ORDER BY os.id ASC`,
    [STATUS_OS_EM_FILA]
  )

  let atribuidas = 0
  for (const row of fila.rows as Array<{ id: number }>) {
    try {
      const resultado = await distribuirOs(Number(row.id), {
        origem: ORIGEM_OS_AUTOMATICA,
      })
      if (resultado.atribuida) atribuidas += 1
    } catch (error) {
      console.error(`[DISTRIBUICAO] Falha ao distribuir OS ${row.id}:`, error)
    }
  }

  const pendentesResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM ordens_servico
     WHERE equipe_id IS NULL AND status = $1`,
    [STATUS_OS_EM_FILA]
  )

  return {
    processadas: fila.rows.length,
    atribuidas,
    pendentes: Number(pendentesResult.rows[0].total),
  }
}

export async function listarFilaDistribuicao(): Promise<
  Array<Record<string, unknown>>
> {
  const result = await db.query(
    `SELECT os.id, os.solicitacao_id, os.status, os.equipe_id, os.criado_em,
            s.protocolo, s.tipo_problema, s.prioridade, s.endereco_informado,
            e.nome AS equipe_nome
     FROM ordens_servico os
     JOIN solicitacoes s ON s.id = os.solicitacao_id
     LEFT JOIN equipes e ON e.id = os.equipe_id
     WHERE os.equipe_id IS NULL AND os.status = $1
     ORDER BY os.criado_em ASC, os.id ASC`,
    [STATUS_OS_EM_FILA]
  )

  const motivos = await db.query(
    `SELECT solicitacao_id, observacao FROM status_logs
     WHERE observacao LIKE 'Distribuicao automatica pendente%'
     ORDER BY id ASC`
  )
  const ultimoMotivo = new Map<number, string>()
  for (const row of motivos.rows as Array<{ solicitacao_id: number; observacao: string }>) {
    ultimoMotivo.set(Number(row.solicitacao_id), String(row.observacao))
  }

  return (result.rows as Record<string, unknown>[]).map((row) => {
    const solicitacaoId = Number(row.solicitacao_id)
    const detalhe = ultimoMotivo.get(solicitacaoId)
    return {
      ...row,
      motivo: MOTIVO_FILA_SEM_EQUIPE,
      motivo_detalhe: detalhe ?? 'Aguardando equipe disponivel',
    }
  })
}
