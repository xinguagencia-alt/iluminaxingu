import { db } from '../../db.js'
import { registrarAuditoria } from '../auditoria/helper.js'
import { STATUS_FECHADOS_DUPLICIDADE } from './duplicidade.js'
import { elevarPrioridade, type Prioridade } from './prioridade.js'
import { normalizarTelefone } from './whatsapp.js'

export const LIMIAR_MORADORES_ELEVACAO = 3
export const ORIGEM_CONFIRMACAO_PORTAL = 'portal'

export interface ConfirmacaoPublica {
  registrada: boolean
  ja_existia: boolean
  total_moradores: number
  elevou_prioridade: boolean
  prioridade_anterior: string | null
  prioridade_nova: string | null
}

export interface EntradaConfirmacao {
  solicitacaoId: number
  telefoneInformado: string
  origem?: string
  clientRequestId?: string | null
}

export function mascararTelefone(telefone: string): string {
  const digitos = String(telefone).replace(/\D/g, '')
  if (digitos.length <= 8) return '***'
  return `*****${digitos.slice(-4)}`
}

function ehErroDeSchemaDeConfirmacoes(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro)
  const semTabelaOuColuna = /does not exist/i.test(mensagem)
  const semIndiceUnico =
    /no unique or exclusion constraint matching the ON CONFLICT specification/i.test(mensagem)
  return (
    /confirmacoes/i.test(mensagem) && (semTabelaOuColuna || semIndiceUnico)
  )
}

export async function registrarConfirmacao(
  entrada: EntradaConfirmacao
): Promise<ConfirmacaoPublica | null> {
  const telefone = normalizarTelefone(entrada.telefoneInformado ?? '')
  const telefoneMascarado = telefone ? mascararTelefone(telefone) : '***'
  const origem = entrada.origem ?? ORIGEM_CONFIRMACAO_PORTAL
  const clientRequestId = entrada.clientRequestId ?? null

  const cliente = await db.getClient()
  let transacaoAberta = false
  let registrada = false
  let jaExistia = false
  let totalMoradores = 1
  let elevouPrioridade = false
  let prioridadeAnterior: string | null = null
  let prioridadeNova: string | null = null
  let confirmacaoId: number | null = null
  let statusAtual = 'enviada'

  try {
    await cliente.query('BEGIN')
    transacaoAberta = true

    const solicitacaoResult = await cliente.query(
      `SELECT id, telefone, status_atual, prioridade, confirmacoes_elevacao_em
         FROM solicitacoes
        WHERE id = $1
        FOR UPDATE`,
      [entrada.solicitacaoId]
    )

    if (solicitacaoResult.rows.length === 0) {
      await cliente.query('ROLLBACK')
      transacaoAberta = false
      return null
    }

    const solicitacao = solicitacaoResult.rows[0] as Record<string, unknown>
    statusAtual = String(solicitacao.status_atual ?? 'enviada')
    const prioridadeAtual = String(solicitacao.prioridade ?? 'media')
    const elevacaoJaAplicada =
      solicitacao.confirmacoes_elevacao_em !== null &&
      solicitacao.confirmacoes_elevacao_em !== undefined
    const encerrada = (STATUS_FECHADOS_DUPLICIDADE as readonly string[]).includes(statusAtual)
    const telefoneOriginal = solicitacao.telefone
      ? normalizarTelefone(String(solicitacao.telefone))
      : null

    if (telefoneOriginal && telefone && telefone === telefoneOriginal) {
      jaExistia = true
    } else if (!telefone) {
      jaExistia = true
    } else {
      const insercao = await cliente.query(
        `INSERT INTO confirmacoes (solicitacao_id, telefone_normalizado, origem, client_request_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [entrada.solicitacaoId, telefone, origem, clientRequestId]
      )
      if (insercao.rows.length > 0) {
        registrada = true
        confirmacaoId = Number(insercao.rows[0].id)
      } else {
        jaExistia = true
      }
    }

    if (telefoneOriginal) {
      const contagem = await cliente.query(
        `SELECT COUNT(*)::int AS total
           FROM confirmacoes
          WHERE solicitacao_id = $1
            AND telefone_normalizado <> $2`,
        [entrada.solicitacaoId, telefoneOriginal]
      )
      totalMoradores = 1 + Number(contagem.rows[0]?.total ?? 0)
    } else {
      const contagem = await cliente.query(
        `SELECT COUNT(*)::int AS total
           FROM confirmacoes
          WHERE solicitacao_id = $1`,
        [entrada.solicitacaoId]
      )
      totalMoradores = 1 + Number(contagem.rows[0]?.total ?? 0)
    }

    if (!encerrada && !elevacaoJaAplicada && totalMoradores >= LIMIAR_MORADORES_ELEVACAO) {
      const novaPrioridade = elevarPrioridade(prioridadeAtual as Prioridade)
      const atualizacao = await cliente.query(
        `UPDATE solicitacoes
            SET prioridade = $1,
                confirmacoes_elevacao_em = NOW(),
                atualizado_em = NOW()
          WHERE id = $2
            AND confirmacoes_elevacao_em IS NULL
            AND NOT (status_atual = ANY($3::text[]))
          RETURNING prioridade`,
        [novaPrioridade, entrada.solicitacaoId, [...STATUS_FECHADOS_DUPLICIDADE]]
      )
      if (atualizacao.rows.length > 0) {
        elevouPrioridade = true
        prioridadeAnterior = prioridadeAtual
        prioridadeNova = String(atualizacao.rows[0].prioridade)
      }
    }

    if (registrada && confirmacaoId !== null) {
      await cliente.query(
        `INSERT INTO status_logs (solicitacao_id, status_anterior, status_novo, observacao, criado_por)
         VALUES ($1, $2, $2, $3, 'sistema')`,
        [
          entrada.solicitacaoId,
          statusAtual,
          `Confirmacao de morador registrada (telefone ${telefoneMascarado}): total ${totalMoradores} moradores distintos`,
        ]
      )
    }

    if (elevouPrioridade) {
      await cliente.query(
        `INSERT INTO status_logs (solicitacao_id, status_anterior, status_novo, observacao, criado_por)
         VALUES ($1, $2, $2, $3, 'sistema')`,
        [
          entrada.solicitacaoId,
          statusAtual,
          `Prioridade elevada por confirmacoes: ${prioridadeAnterior} -> ${prioridadeNova} (${totalMoradores} moradores distintos)`,
        ]
      )
    }

    await cliente.query('COMMIT')
    transacaoAberta = false
  } catch (erro) {
    if (transacaoAberta) {
      await cliente.query('ROLLBACK').catch(() => undefined)
    }
    if (ehErroDeSchemaDeConfirmacoes(erro)) {
      const mensagem = erro instanceof Error ? erro.message : String(erro)
      console.warn(
        '[CONFIRMACAO] Tabela/coluna de confirmacoes indisponivel (migration Etapa 7 pendente):',
        mensagem
      )
      cliente.release()
      return null
    }
    cliente.release()
    throw erro
  }

  cliente.release()

  if (confirmacaoId !== null) {
    await registrarAuditoria({
      tabela: 'confirmacoes',
      registroId: confirmacaoId,
      acao: 'criar',
      dadosAntes: null,
      dadosDepois: {
        solicitacao_id: entrada.solicitacaoId,
        telefone_mascarado: telefoneMascarado,
        origem,
        total_moradores: totalMoradores,
      },
      usuarioId: null,
      usuarioNome: 'municipe',
    })
  }

  if (elevouPrioridade) {
    await registrarAuditoria({
      tabela: 'solicitacoes',
      registroId: entrada.solicitacaoId,
      acao: 'editar',
      dadosAntes: { prioridade: prioridadeAnterior, confirmacoes_elevacao_em: null },
      dadosDepois: {
        prioridade: prioridadeNova,
        gatilho: 'confirmacoes_3_moradores',
        total_moradores: totalMoradores,
      },
      usuarioId: null,
      usuarioNome: 'sistema',
    })
  }

  return {
    registrada,
    ja_existia: jaExistia,
    total_moradores: totalMoradores,
    elevou_prioridade: elevouPrioridade,
    prioridade_anterior: prioridadeAnterior,
    prioridade_nova: prioridadeNova,
  }
}
