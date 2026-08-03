import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'

const router = Router()

router.get('/:tabela', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const tabela = String(req.params.tabela)

  const tabelasPermitidas = ['postes', 'bairros', 'ruas', 'solicitacoes', 'ordens_servico', 'equipes']

  if (!tabelasPermitidas.includes(tabela)) {
    res.status(400).json({ error: 'Tabela nao permitida para exportacao' })
    return
  }

  try {
    let query = ''
    switch (tabela) {
      case 'postes':
        query = `SELECT id, codigo, endereco, rua, numero, bairro, complemento, latitude, longitude,
          tipo_luminaria, potencia, data_instalacao, data_ultima_manutencao, status_ativo, criado_em, atualizado_em
          FROM postes WHERE status_ativo = TRUE ORDER BY codigo`
        break
      case 'bairros':
        query = `SELECT id, nome, ativo, criado_em FROM bairros WHERE ativo = TRUE ORDER BY nome`
        break
      case 'ruas':
        query = `SELECT id, nome, tipo, ativo, criado_em FROM ruas WHERE ativo = TRUE ORDER BY tipo, nome`
        break
      case 'solicitacoes':
        query = `SELECT id, protocolo, nome_solicitante, telefone, email, codigo_poste, endereco_informado,
          latitude, longitude, tipo_problema, descricao, status_atual, prioridade, criado_em
          FROM solicitacoes ORDER BY criado_em DESC`
        break
      case 'ordens_servico':
        query = `SELECT id, solicitacao_id, equipe_id, status, observacoes, criado_em, atualizado_em
          FROM ordens_servico ORDER BY criado_em DESC`
        break
      case 'equipes':
        query = `SELECT id, nome, responsavel, telefone, ativo, criado_em FROM equipes WHERE ativo = TRUE ORDER BY nome`
        break
    }

    const result = await db.query(query)

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${tabela}_${new Date().toISOString().slice(0, 10)}.json"`)
    res.json({
      tabela,
      exportadoEm: new Date().toISOString(),
      total: result.rows.length,
      dados: result.rows,
    })
  } catch (error) {
    console.error(`Erro ao exportar ${tabela}:`, error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.get('/', authMiddleware, requireRole(['admin']), async (_req: Request, res: Response) => {
  try {
    const [postes, bairros, ruas, solicitacoes, ordens, equipes] = await Promise.all([
      db.query(`SELECT COUNT(*) as count FROM postes WHERE status_ativo = TRUE`),
      db.query(`SELECT COUNT(*) as count FROM bairros WHERE ativo = TRUE`),
      db.query(`SELECT COUNT(*) as count FROM ruas WHERE ativo = TRUE`),
      db.query(`SELECT COUNT(*) as count FROM solicitacoes`),
      db.query(`SELECT COUNT(*) as count FROM ordens_servico`),
      db.query(`SELECT COUNT(*) as count FROM equipes WHERE ativo = TRUE`),
    ])

    res.json({
      postes: Number(postes.rows[0].count),
      bairros: Number(bairros.rows[0].count),
      ruas: Number(ruas.rows[0].count),
      solicitacoes: Number(solicitacoes.rows[0].count),
      ordens_servico: Number(ordens.rows[0].count),
      equipes: Number(equipes.rows[0].count),
    })
  } catch (error) {
    console.error('Erro ao obter resumo:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
