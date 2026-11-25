import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'
import { registrarAuditoria } from '../auditoria/helper.js'

const router = Router()

const TIPOS_LOCALIDADE_VALIDOS = ['sede', 'distrito', 'vila'] as const
type TipoLocalidade = typeof TIPOS_LOCALIDADE_VALIDOS[number]

function validarTipoLocalidade(tipo: unknown): tipo is TipoLocalidade {
  return typeof tipo === 'string' && TIPOS_LOCALIDADE_VALIDOS.includes(tipo as TipoLocalidade)
}

function normalizarNomeCanonico(nome: string): string {
  return nome
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function erroMigrationAusente(res: Response): boolean {
  res.status(503).json({
    error: 'Recurso indisponivel',
    detalhe: 'A tabela de localidades ainda nao foi criada. Execute a migration da Etapa 1 antes de usar este endpoint.',
  })
  return true
}

function ehInteiroSeguro(valor: string): boolean {
  if (!/^\d+$/.test(valor)) return false
  const num = Number(valor)
  return Number.isSafeInteger(num) && num > 0
}

function obterParametroUnico(req: Request, nome: string): string | string[] | undefined {
  const val = req.query[nome] as string | string[] | undefined
  return val
}

router.get('/', async (req: Request, res: Response) => {
  const tipoParam = obterParametroUnico(req, 'tipo')

  if (Array.isArray(tipoParam)) {
    res.status(400).json({ error: 'Parametro tipo nao pode ser repetido' })
    return
  }

  const tipo = typeof tipoParam === 'string' ? tipoParam : undefined

  if (tipo !== undefined && !validarTipoLocalidade(tipo)) {
    res.status(400).json({ error: 'Tipo invalido. Use: sede, distrito ou vila' })
    return
  }

  try {
    let query = 'SELECT id, nome, tipo, ativo, criado_em FROM localidades WHERE ativo = TRUE'
    const params: unknown[] = []

    if (tipo) {
      query += ' AND tipo = $1'
      params.push(tipo)
    }

    query += ' ORDER BY tipo, nome'

    const result = await db.query(query, params)
    res.json(result.rows)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === '42P01') {
      return erroMigrationAusente(res)
    }
    console.error('Erro ao listar localidades:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown> | undefined

  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Corpo da requisicao invalido' })
    return
  }

  const { nome, tipo } = body

  if (typeof nome !== 'string') {
    res.status(400).json({ error: 'Nome da localidade e obrigatorio e deve ser texto' })
    return
  }

  const nomeNormalizado = normalizarNomeCanonico(nome)
  if (!nomeNormalizado) {
    res.status(400).json({ error: 'Nome da localidade nao pode ser vazio' })
    return
  }

  if (!validarTipoLocalidade(tipo)) {
    res.status(400).json({ error: 'Tipo invalido. Use: sede, distrito ou vila' })
    return
  }

  try {
    const result = await db.query(
      `INSERT INTO localidades (nome, nome_normalizado, tipo) VALUES ($1, $2, $3) RETURNING id, nome, tipo, ativo, criado_em`,
      [nome.trim(), nomeNormalizado, tipo]
    )

    await registrarAuditoria({
      tabela: 'localidades',
      registroId: result.rows[0].id,
      acao: 'criar',
      dadosDepois: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.status(201).json(result.rows[0])
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === '42P01') {
      return erroMigrationAusente(res)
    }
    if (err.code === '23505') {
      res.status(409).json({ error: 'Localidade ja existe para este tipo (nome e tipo duplicados)' })
      return
    }
    console.error('Erro ao criar localidade:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.put('/:id', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const idParam = req.params.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam

  if (!ehInteiroSeguro(id)) {
    res.status(400).json({ error: 'ID invalido' })
    return
  }

  const body = req.body as Record<string, unknown> | undefined
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Corpo da requisicao invalido' })
    return
  }

  const { nome, tipo, ativo } = body

  let nomeNormalizado: string | undefined
  if (nome !== undefined) {
    if (typeof nome !== 'string') {
      res.status(400).json({ error: 'Nome da localidade deve ser texto' })
      return
    }
    nomeNormalizado = normalizarNomeCanonico(nome)
    if (!nomeNormalizado) {
      res.status(400).json({ error: 'Nome da localidade nao pode ser vazio' })
      return
    }
  }

  if (tipo !== undefined && !validarTipoLocalidade(tipo)) {
    res.status(400).json({ error: 'Tipo invalido. Use: sede, distrito ou vila' })
    return
  }

  if (ativo !== undefined && typeof ativo !== 'boolean') {
    res.status(400).json({ error: 'Campo ativo deve ser booleano' })
    return
  }

  try {
    const oldResult = await db.query(`SELECT id, nome, nome_normalizado, tipo, ativo FROM localidades WHERE id = $1`, [id])
    if (oldResult.rows.length === 0) {
      res.status(404).json({ error: 'Localidade nao encontrada' })
      return
    }

    const localidadeAntiga = oldResult.rows[0]
    const novoNomeOriginal = nome !== undefined ? nome.trim() : localidadeAntiga.nome
    const novoNomeNormalizado = nomeNormalizado ?? localidadeAntiga.nome_normalizado
    const novoTipo = (tipo ?? localidadeAntiga.tipo) as TipoLocalidade

    if (nomeNormalizado !== undefined || tipo !== undefined) {
      const duplicada = await db.query(
        `SELECT id FROM localidades
         WHERE nome_normalizado = $1 AND tipo = $2 AND id <> $3`,
        [novoNomeNormalizado, novoTipo, id]
      )

      if (duplicada.rows.length > 0) {
        res.status(409).json({ error: 'Ja existe outra localidade com este nome e tipo' })
        return
      }
    }

    const result = await db.query(
      `UPDATE localidades SET
         nome = COALESCE($1, nome),
         nome_normalizado = COALESCE($2, nome_normalizado),
         tipo = COALESCE($3, tipo),
         ativo = COALESCE($4, ativo)
       WHERE id = $5
       RETURNING id, nome, tipo, ativo, criado_em`,
      [nome?.trim() ?? null, nomeNormalizado ?? null, tipo ?? null, ativo ?? null, id]
    )

    await registrarAuditoria({
      tabela: 'localidades',
      registroId: Number(id),
      acao: 'editar',
      dadosAntes: localidadeAntiga,
      dadosDepois: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.json(result.rows[0])
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === '42P01') {
      return erroMigrationAusente(res)
    }
    if (err.code === '23505') {
      res.status(409).json({ error: 'Ja existe outra localidade com este nome e tipo' })
      return
    }
    console.error('Erro ao atualizar localidade:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.patch('/:id/desativar', authMiddleware, requireRole(['admin', 'gestor']), async (req: Request, res: Response) => {
  const idParam = req.params.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam

  if (!ehInteiroSeguro(id)) {
    res.status(400).json({ error: 'ID invalido' })
    return
  }

  try {
    const result = await db.query(
      `UPDATE localidades SET ativo = FALSE WHERE id = $1 AND ativo = TRUE RETURNING id, nome, tipo`,
      [id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Localidade nao encontrada ou ja desativada' })
      return
    }

    await registrarAuditoria({
      tabela: 'localidades',
      registroId: Number(id),
      acao: 'excluir',
      dadosAntes: result.rows[0],
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? null,
    })

    res.json({ ok: true })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err.code === '42P01') {
      return erroMigrationAusente(res)
    }
    console.error('Erro ao desativar localidade:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router