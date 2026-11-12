import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import { authMiddleware, requireRole } from '../auth/middleware.js'
import { registrarAuditoria } from '../auditoria/helper.js'

export const CHAVE_FLUXO = 'fluxo_operacional'
export const MODO_PADRAO = 'manual' as const
export const MODOS_VALIDOS = ['manual', 'automatico'] as const

export type ModoOperacional = (typeof MODOS_VALIDOS)[number]

export function normalizarModo(valor: unknown): ModoOperacional | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim().toLowerCase()
  return (MODOS_VALIDOS as readonly string[]).includes(limpo)
    ? (limpo as ModoOperacional)
    : null
}

export async function lerModoOperacional(): Promise<ModoOperacional> {
  try {
    const result = await db.query(
      `SELECT valor FROM configuracao_estoque WHERE chave = $1`,
      [CHAVE_FLUXO]
    )
    if (result.rows.length === 0) return MODO_PADRAO
    return normalizarModo(result.rows[0].valor) ?? MODO_PADRAO
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('does not exist')) return MODO_PADRAO
    console.error('Erro ao ler modo operacional:', error)
    return MODO_PADRAO
  }
}

export async function definirModoOperacional(modo: ModoOperacional): Promise<void> {
  await db.query(
    `INSERT INTO configuracao_estoque (chave, valor, descricao)
     VALUES ($1, $2, $3)
     ON CONFLICT (chave)
     DO UPDATE SET valor = $2, descricao = $3, atualizado_em = NOW()`,
    [CHAVE_FLUXO, modo, 'Modo operacional do fluxo de solicitacoes']
  )
}

export function decidirElegibilidadeAutomatica(entrada: {
  modo: ModoOperacional
  duplicada: boolean
}): boolean {
  if (entrada.duplicada) return false
  return entrada.modo === 'automatico'
}

const router = Router()

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const modo = await lerModoOperacional()
    res.json({
      modo,
      modo_label: modo === 'automatico' ? 'Automatico' : 'Manual',
      padrao: MODO_PADRAO,
    })
  } catch (error) {
    console.error('Erro ao consultar modo operacional:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

router.put('/', authMiddleware, requireRole(['admin']), async (req: Request, res: Response) => {
  const modo = normalizarModo(req.body && req.body.modo)
  if (!modo) {
    res.status(400).json({ error: 'Modo invalido. Use "manual" ou "automatico"' })
    return
  }

  try {
    const anterior = await lerModoOperacional()
    if (anterior === modo) {
      res.json({ message: 'Modo operacional ja estava ativo', modo, modo_anterior: anterior })
      return
    }

    await definirModoOperacional(modo)

    await registrarAuditoria({
      tabela: 'configuracao_fluxo',
      registroId: null,
      acao: 'editar',
      dadosAntes: { modo: anterior },
      dadosDepois: { modo },
      usuarioId: req.user?.userId ?? null,
      usuarioNome: req.user?.nomeCompleto ?? req.user?.username ?? null,
    })

    res.json({ message: 'Modo operacional atualizado', modo, modo_anterior: anterior })
  } catch (error) {
    console.error('Erro ao atualizar modo operacional:', error)
    res.status(500).json({ error: 'Erro ao salvar configuracao do fluxo' })
  }
})

export default router
