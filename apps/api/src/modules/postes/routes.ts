import { Router, Request, Response } from 'express'
import { db } from '../../db'

const router = Router()

// Listar todos os postes
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, codigo, endereco,
        ST_Y(geom) as latitude, ST_X(geom) as longitude,
        tipo_luminaria, potencia, data_instalacao,
        data_ultima_manutencao, status_ativo
      FROM postes WHERE status_ativo = TRUE ORDER BY codigo`
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao listar postes:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar poste por ID
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const result = await db.query(
      `SELECT id, codigo, endereco,
        ST_Y(geom) as latitude, ST_X(geom) as longitude,
        tipo_luminaria, potencia, data_instalacao,
        data_ultima_manutencao, status_ativo
      FROM postes WHERE id = $1`,
      [id]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Poste nao encontrado' })
      return
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Erro ao buscar poste:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Criar novo poste
router.post('/', async (req: Request, res: Response) => {
  const {
    codigo,
    endereco,
    latitude,
    longitude,
    tipo_luminaria,
    potencia,
    data_instalacao,
  } = req.body

  if (!codigo) {
    res.status(400).json({ error: 'Codigo do poste e obrigatorio' })
    return
  }

  try {
    const query = `
      INSERT INTO postes (codigo, endereco, geom, tipo_luminaria, potencia, data_instalacao)
      VALUES ($1, $2,
        CASE WHEN $3 IS NOT NULL AND $4 IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($4, $3), 4326)
          ELSE NULL
        END,
        $5, $6, $7)
      RETURNING *
    `

    const values = [
      codigo,
      endereco || null,
      latitude || null,
      longitude || null,
      tipo_luminaria || null,
      potencia || null,
      data_instalacao || null,
    ]

    const result = await db.query(query, values)
    res.status(201).json(result.rows[0])
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Codigo do poste ja existe' })
      return
    }
    console.error('Erro ao criar poste:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar poste
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params
  const {
    codigo,
    endereco,
    latitude,
    longitude,
    tipo_luminaria,
    potencia,
    data_instalacao,
    data_ultima_manutencao,
    status_ativo,
  } = req.body

  try {
    const query = `
      UPDATE postes SET
        codigo = COALESCE($1, codigo),
        endereco = COALESCE($2, endereco),
        geom = CASE
          WHEN $3 IS NOT NULL AND $4 IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($4, $3), 4326)
          ELSE geom
        END,
        tipo_luminaria = COALESCE($5, tipo_luminaria),
        potencia = COALESCE($6, potencia),
        data_instalacao = COALESCE($7, data_instalacao),
        data_ultima_manutencao = COALESCE($8, data_ultima_manutencao),
        status_ativo = COALESCE($9, status_ativo)
      WHERE id = $10
      RETURNING *
    `

    const values = [
      codigo || null,
      endereco || null,
      latitude || null,
      longitude || null,
      tipo_luminaria || null,
      potencia || null,
      data_instalacao || null,
      data_ultima_manutencao || null,
      status_ativo !== undefined ? status_ativo : null,
      id,
    ]

    const result = await db.query(query, values)

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Poste nao encontrado' })
      return
    }

    res.json(result.rows[0])
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Codigo do poste ja existe' })
      return
    }
    console.error('Erro ao atualizar poste:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar postes proximos (raio em metros)
router.get('/proximos/:lat/:lng/:raio', async (req: Request, res: Response) => {
  const { lat, lng, raio } = req.params
  try {
    const result = await db.query(
      `SELECT id, codigo, endereco,
        ST_Y(geom) as latitude, ST_X(geom) as longitude,
        tipo_luminaria, potencia,
        ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distancia_metros
      FROM postes
      WHERE status_ativo = TRUE
        AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
      ORDER BY distancia_metros`,
      [lat, lng, raio]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao buscar postes proximos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
