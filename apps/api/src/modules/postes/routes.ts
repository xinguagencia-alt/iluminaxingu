import { Router, Request, Response } from 'express'
import { db } from '../../db'

const router = Router()

// Listar todos os postes
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, codigo, endereco, latitude, longitude,
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
      `SELECT id, codigo, endereco, latitude, longitude,
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
      INSERT INTO postes (codigo, endereco, latitude, longitude, tipo_luminaria, potencia, data_instalacao)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
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
        latitude = COALESCE($3, latitude),
        longitude = COALESCE($4, longitude),
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

// Buscar postes proximos (raio em metros) - approximacao sem PostGIS
router.get('/proximos/:lat/:lng/:raio', async (req: Request, res: Response) => {
  const lat = parseFloat(String(req.params.lat))
  const lng = parseFloat(String(req.params.lng))
  const raio = parseFloat(String(req.params.raio))

  if (isNaN(lat) || isNaN(lng) || isNaN(raio)) {
    res.status(400).json({ error: 'Parametros invalidos' })
    return
  }

  try {
    const result = await db.query(
      `SELECT id, codigo, endereco, latitude, longitude,
        tipo_luminaria, potencia,
        CASE
          WHEN latitude IS NOT NULL AND longitude IS NOT NULL
          THEN (
            6371000 * acos(
              cos(radians($1)) * cos(radians(latitude)) *
              cos(radians(longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(latitude))
            )
          )
          ELSE NULL
        END as distancia_metros
      FROM postes
      WHERE status_ativo = TRUE
        AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY distancia_metros
      LIMIT 50`,
      [lat, lng]
    )

    const filtrados = result.rows.filter((r: { distancia_metros: number | null }) =>
      r.distancia_metros !== null && r.distancia_metros <= raio
    )

    res.json(filtrados)
  } catch (error) {
    console.error('Erro ao buscar postes proximos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
