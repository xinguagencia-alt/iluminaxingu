import { Router, Request, Response, NextFunction } from 'express'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'

const router = Router()

async function requireEstoqueAtivo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await db.query(
      `SELECT valor FROM configuracao_estoque WHERE chave = 'estoque_ativo'`
    )
    if (result.rows.length === 0 || result.rows[0].valor !== 'true') {
      res.status(400).json({ error: 'Modulo de estoque desabilitado' })
      return
    }
  } catch { /* tables may not exist yet */ }
  next()
}

// Config
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT chave, valor, descricao FROM configuracao_estoque ORDER BY chave`
    )
    const config: Record<string, string> = {}
    for (const row of result.rows) {
      config[row.chave] = row.valor
    }
    res.json(config)
  } catch (error) {
    console.error('Erro ao buscar config estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.put('/config', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const { chave, valor } = req.body
  if (!chave || valor === undefined) {
    res.status(400).json({ error: 'Chave e valor sao obrigatorios' })
    return
  }
  try {
    await db.query(
      `INSERT INTO configuracao_estoque (chave, valor) VALUES ($1, $2)
       ON CONFLICT (chave) DO UPDATE SET valor = $2, atualizado_em = NOW()`,
      [chave, String(valor)]
    )
    const configResult = await db.query(
      `SELECT chave, valor FROM configuracao_estoque ORDER BY chave`
    )
    const config: Record<string, string> = {}
    for (const row of configResult.rows) {
      config[row.chave] = row.valor
    }
    res.json({ message: 'Configuracao atualizada', config })
  } catch (error) {
    console.error('Erro ao atualizar config estoque:', error)
    res.status(500).json({ error: 'Erro ao salvar configuracao no banco de dados' })
  }
})

// Itens
router.get('/itens', async (req: Request, res: Response) => {
  const { categoria, ativo } = req.query
  const conditions: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (categoria && typeof categoria === 'string') {
    conditions.push(`categoria = $${paramIndex}`)
    values.push(categoria)
    paramIndex++
  }
  if (ativo !== undefined && typeof ativo === 'string') {
    conditions.push(`ativo = $${paramIndex}`)
    values.push(ativo === 'true')
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const result = await db.query(
      `SELECT * FROM itens_estoque ${whereClause} ORDER BY nome`,
      values
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar itens estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/itens', authMiddleware, requireRole(['admin', 'gestor']), requireEstoqueAtivo, async (req: Request, res: Response) => {
  const { nome, categoria, unidade_medida, estoque_minimo, estoque_atual, observacao, codigo_interno } = req.body

  if (!nome || !categoria || !unidade_medida) {
    res.status(400).json({ error: 'Nome, categoria e unidade de medida sao obrigatorios' })
    return
  }

  try {
    const result = await db.query(
      `INSERT INTO itens_estoque (nome, categoria, unidade_medida, estoque_minimo, estoque_atual, observacao, codigo_interno)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nome, categoria, unidade_medida, estoque_minimo || 0, estoque_atual || 0, observacao || null, codigo_interno || null]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Erro ao criar item estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.put('/itens/:id', authMiddleware, requireRole(['admin', 'gestor']), requireEstoqueAtivo, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { nome, categoria, unidade_medida, estoque_minimo, estoque_atual, ativo, observacao, codigo_interno } = req.body

  try {
    const result = await db.query(
      `UPDATE itens_estoque SET
        nome = COALESCE($1, nome),
        categoria = COALESCE($2, categoria),
        unidade_medida = COALESCE($3, unidade_medida),
        estoque_minimo = COALESCE($4, estoque_minimo),
        estoque_atual = COALESCE($5, estoque_atual),
        ativo = COALESCE($6, ativo),
        observacao = COALESCE($7, observacao),
        codigo_interno = COALESCE($8, codigo_interno)
       WHERE id = $9 RETURNING *`,
      [nome, categoria, unidade_medida, estoque_minimo, estoque_atual, ativo, observacao, codigo_interno, id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Item nao encontrado' })
      return
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao atualizar item estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.delete('/itens/:id', authMiddleware, requireRole(['admin']), requireEstoqueAtivo, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  try {
    const result = await db.query('DELETE FROM itens_estoque WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Item nao encontrado' })
      return
    }
    res.json({ message: 'Item excluido' })
  } catch (error) {
    console.error('Erro ao excluir item estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Movimentacoes
router.get('/movimentacoes', async (req: Request, res: Response) => {
  const { tipo, item_id, limit: limitParam } = req.query
  const conditions: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (tipo && typeof tipo === 'string') {
    conditions.push(`m.tipo = $${paramIndex}`)
    values.push(tipo)
    paramIndex++
  }
  if (item_id && typeof item_id === 'string') {
    conditions.push(`m.item_id = $${paramIndex}`)
    values.push(Number(item_id))
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = limitParam ? Number(limitParam) : 100

  try {
    const result = await db.query(
      `SELECT m.*, i.nome as item_nome, i.unidade_medida, i.categoria as item_categoria
       FROM movimentacoes_estoque m
       JOIN itens_estoque i ON m.item_id = i.id
       ${whereClause}
       ORDER BY m.criado_em DESC
       LIMIT $${paramIndex}`,
      [...values, limit]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar movimentacoes:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/movimentacoes', authMiddleware, requireRole(['admin', 'gestor', 'operador']), requireEstoqueAtivo, async (req: Request, res: Response) => {
  const { item_id, tipo, quantidade, observacao, os_id, nota_fiscal, fornecedor, data_movimento } = req.body

  if (!item_id || !tipo || quantidade === undefined || quantidade === null) {
    res.status(400).json({ error: 'Item, tipo e quantidade sao obrigatorios' })
    return
  }

  const tiposValidos = ['entrada', 'saida', 'ajuste', 'baixa_os']
  if (!tiposValidos.includes(tipo)) {
    res.status(400).json({ error: 'Tipo de movimento invalido' })
    return
  }

  try {
    const itemResult = await db.query('SELECT estoque_atual FROM itens_estoque WHERE id = $1', [item_id])
    if (itemResult.rows.length === 0) {
      res.status(404).json({ error: 'Item nao encontrado' })
      return
    }

    let novoSaldo = itemResult.rows[0].estoque_atual
    if (tipo === 'entrada') {
      novoSaldo += Number(quantidade)
    } else if (tipo === 'saida' || tipo === 'baixa_os') {
      novoSaldo -= Number(quantidade)
    } else if (tipo === 'ajuste') {
      novoSaldo = Number(quantidade)
    }

    if (novoSaldo < 0) {
      res.status(400).json({ error: 'Estoque insuficiente para esta operacao' })
      return
    }

    await db.query(
      `INSERT INTO movimentacoes_estoque (item_id, tipo, quantidade, saldo_anterior, saldo_posterior, observacao, os_id, nota_fiscal, fornecedor, usuario, data_movimento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [item_id, tipo, quantidade, itemResult.rows[0].estoque_atual, novoSaldo, observacao || null, os_id || null, nota_fiscal || null, fornecedor || null, req.user?.username || null, data_movimento || new Date().toISOString()]
    )

    await db.query('UPDATE itens_estoque SET estoque_atual = $1 WHERE id = $2', [novoSaldo, item_id])

    res.status(201).json({ message: 'Movimentacao registrada', novo_saldo: novoSaldo })
  } catch (error) {
    console.error('Erro ao criar movimentacao:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Itens usados por OS
router.get('/itens-usados-os', async (req: Request, res: Response) => {
  const { os_id } = req.query
  const conditions: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (os_id && typeof os_id === 'string') {
    conditions.push(`iu.os_id = $${paramIndex}`)
    values.push(Number(os_id))
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const result = await db.query(
      `SELECT iu.*, i.nome as item_nome, i.unidade_medida, i.categoria as item_categoria
       FROM itens_usados_os iu
       JOIN itens_estoque i ON iu.item_id = i.id
       ${whereClause}
       ORDER BY iu.criado_em DESC`,
      values
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar itens usados por OS:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.post('/itens-usados-os', authMiddleware, requireRole(['admin', 'gestor', 'operador']), requireEstoqueAtivo, async (req: Request, res: Response) => {
  const { os_id, item_id, quantidade, observacao } = req.body

  if (!os_id || !item_id || !quantidade) {
    res.status(400).json({ error: 'OS, item e quantidade sao obrigatorios' })
    return
  }

  try {
    const result = await db.query(
      `INSERT INTO itens_usados_os (os_id, item_id, quantidade, usuario, observacao)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [os_id, item_id, quantidade, req.user?.username || null, observacao || null]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Erro ao registrar item usado:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Baixa automatica de estoque para OS
router.post('/deduzir-os', authMiddleware, requireRole(['admin', 'gestor', 'operador']), requireEstoqueAtivo, async (req: Request, res: Response) => {
  const { os_id, itens } = req.body

  if (!os_id || !Array.isArray(itens) || itens.length === 0) {
    res.status(400).json({ error: 'OS e lista de itens sao obrigatorios' })
    return
  }

  try {
    // Verificar duplicidade
    const jaExiste = await db.query(
      `SELECT 1 FROM itens_usados_os WHERE os_id = $1 LIMIT 1`,
      [os_id]
    )
    if (jaExiste.rows.length > 0) {
      res.status(409).json({ error: 'Esta OS ja possui baixa de estoque registrada' })
      return
    }

    const client = await db.getClient()
    try {
      await client.query('BEGIN')

      const deducoes: { item_id: number; os_id: number; quantidade: number; saldo_anterior: number; saldo_posterior: number }[] = []

      for (const item of itens) {
        const { item_id, quantidade, observacao } = item
        if (!item_id || !quantidade || Number(quantidade) <= 0) {
          throw new Error(`Item ${item_id}: quantidade invalida`)
        }

        const itemResult = await client.query(
          'SELECT id, estoque_atual, nome FROM itens_estoque WHERE id = $1 FOR UPDATE',
          [item_id]
        )
        if (itemResult.rows.length === 0) {
          throw new Error(`Item ${item_id} nao encontrado`)
        }

        const estoqueAtual = Number(itemResult.rows[0].estoque_atual)
        const qtd = Number(quantidade)
        const novoSaldo = estoqueAtual - qtd

        if (novoSaldo < 0) {
          throw new Error(
            `Estoque insuficiente para "${itemResult.rows[0].nome}": disponivel ${estoqueAtual}, necessario ${qtd}`
          )
        }

        await client.query(
          `INSERT INTO movimentacoes_estoque (item_id, tipo, quantidade, saldo_anterior, saldo_posterior, os_id, usuario, data_movimento)
           VALUES ($1, 'baixa_os', $2, $3, $4, $5, $6, NOW())`,
          [item_id, qtd, estoqueAtual, novoSaldo, os_id, req.user?.username || null]
        )

        await client.query('UPDATE itens_estoque SET estoque_atual = $1 WHERE id = $2', [novoSaldo, item_id])

        await client.query(
          `INSERT INTO itens_usados_os (os_id, item_id, quantidade, usuario, observacao)
           VALUES ($1, $2, $3, $4, $5)`,
          [os_id, item_id, qtd, req.user?.username || null, observacao || null]
        )

        deducoes.push({ item_id, os_id, quantidade: qtd, saldo_anterior: estoqueAtual, saldo_posterior: novoSaldo })
      }

      await client.query('COMMIT')
      res.json({ message: `${deducoes.length} item(s) deduzido(s) do estoque`, deducoes })
    } catch (txError) {
      await client.query('ROLLBACK')
      const msg = txError instanceof Error ? txError.message : 'Erro ao deduzir estoque'
      res.status(400).json({ error: msg })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Erro ao deduzir estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
