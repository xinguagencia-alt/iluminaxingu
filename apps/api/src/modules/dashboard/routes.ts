import { Router, Request, Response } from 'express'
import { db } from '../../db.js'
import { calcularStatusSla, type StatusSla } from '../solicitacoes/sla.js'

const router = Router()

const STATUS_FECHADOS = ['concluida', 'cancelada', 'nao_procedente', 'duplicada']

interface SlaInfo {
  prazo_sla: string
  status_sla: StatusSla
  horas_restantes: number | null
}

function calcularSla(prioridade: string, criadoEm: string, statusAtual: string, atualizadoEm: string): SlaInfo {
  const resultado = calcularStatusSla({ prioridade, criado_em: criadoEm, status_atual: statusAtual, atualizado_em: atualizadoEm })
  return {
    prazo_sla: resultado.prazo_sla.toISOString(),
    status_sla: resultado.status_sla,
    horas_restantes: resultado.horas_restantes,
  }
}

router.get('/resumo', async (_req: Request, res: Response) => {
  try {
    const [solicitacoesResult, ordensResult, postesResult] = await Promise.all([
      db.query(
        `SELECT s.id, s.protocolo, s.nome_solicitante, s.tipo_problema,
                s.status_atual, s.prioridade, s.criado_em, s.atualizado_em,
                s.endereco_informado,
                os.id as ordem_servico_id
         FROM solicitacoes s
         LEFT JOIN ordens_servico os ON os.solicitacao_id = s.id
         ORDER BY s.criado_em DESC`
      ),
      db.query(
        `SELECT os.id, os.solicitacao_id, os.equipe_id, os.status,
                os.data_abertura, os.data_encerramento,
                e.nome as equipe_nome
         FROM ordens_servico os
         LEFT JOIN equipes e ON e.id = os.equipe_id`
      ),
      db.query(
        `SELECT p.id, p.bairro, p.status_ativo
         FROM postes p
         WHERE p.status_ativo = TRUE`
      ),
    ])

    const solicitacoes = solicitacoesResult.rows
    const ordens = ordensResult.rows
    const postes = postesResult.rows

    const totalSolicitacoes = solicitacoes.length

    const porStatus: Record<string, number> = {}
    const porPrioridade: Record<string, number> = {}
    let abertas = 0
    let emAtendimento = 0
    let concluidas = 0
    let atrasadas = 0
    let venceHoje = 0
    let dentroDoPrazo = 0
    let altaOuUrgente = 0

    let somaTempoResolucao = 0
    let countResolvidas = 0

    for (const s of solicitacoes) {
      porStatus[s.status_atual] = (porStatus[s.status_atual] || 0) + 1
      porPrioridade[s.prioridade] = (porPrioridade[s.prioridade] || 0) + 1

      const isFechado = STATUS_FECHADOS.includes(s.status_atual)

      if (!isFechado) {
        abertas++
        if (s.status_atual === 'em_execucao' || s.status_atual === 'em_manutencao') {
          emAtendimento++
        }
      } else if (s.status_atual === 'concluida') {
        concluidas++
      }

      if (s.prioridade === 'urgente' || s.prioridade === 'alta') {
        if (!isFechado) {
          altaOuUrgente++
        }
      }

      const sla = calcularSla(s.prioridade, s.criado_em, s.status_atual, s.atualizado_em)

      if (!isFechado) {
        if (sla.status_sla === 'atrasada') atrasadas++
        else if (sla.status_sla === 'vence_hoje') venceHoje++
        else if (sla.status_sla === 'dentro_do_prazo') dentroDoPrazo++
      }

      if (s.status_atual === 'concluida') {
        const criado = new Date(s.criado_em).getTime()
        const atualizado = new Date(s.atualizado_em).getTime()
        const diffHoras = (atualizado - criado) / (1000 * 60 * 60)
        somaTempoResolucao += diffHoras
        countResolvidas++
      }
    }

    const tempoMedioHoras = countResolvidas > 0 ? somaTempoResolucao / countResolvidas : 0

    const totalOrdens = ordens.length
    const ordensAbertas = ordens.filter((o: Record<string, unknown>) => o.status === 'aberta').length
    const ordensEmExecucao = ordens.filter((o: Record<string, unknown>) => o.status === 'em_execucao').length

    const porBairro: Record<string, number> = {}
    for (const s of solicitacoes) {
      const bairro = (s.bairro as string) || (s.endereco_informado as string)?.split(',').pop()?.trim() || 'Nao informado'
      porBairro[bairro] = (porBairro[bairro] || 0) + 1
    }

    const porTipoProblema: Record<string, number> = {}
    for (const s of solicitacoes) {
      porTipoProblema[s.tipo_problema] = (porTipoProblema[s.tipo_problema] || 0) + 1
    }

    const urgentes = solicitacoes
      .filter((s) => {
        const isFechado = STATUS_FECHADOS.includes(s.status_atual)
        return !isFechado && (s.prioridade === 'urgente' || s.prioridade === 'alta')
      })
      .slice(0, 10)
      .map((s) => {
        const sla = calcularSla(s.prioridade, s.criado_em, s.status_atual, s.atualizado_em)
        return {
          id: s.id,
          protocolo: s.protocolo,
          nome_solicitante: s.nome_solicitante,
          tipo_problema: s.tipo_problema,
          status_atual: s.status_atual,
          prioridade: s.prioridade,
          criado_em: s.criado_em,
          prazo_sla: sla.prazo_sla,
          status_sla: sla.status_sla,
          horas_restantes: sla.horas_restantes,
        }
      })

    const postesAtivos = postes.length

    const postesPorBairro: Record<string, number> = {}
    for (const p of postes) {
      const bairro = (p.bairro as string) || 'Nao informado'
      postesPorBairro[bairro] = (postesPorBairro[bairro] || 0) + 1
    }

    const taxaConclusao = totalSolicitacoes > 0 ? (concluidas / totalSolicitacoes) * 100 : 0

    const slaGeral = {
      dentro_do_prazo: dentroDoPrazo,
      vence_hoje: venceHoje,
      atrasada: atrasadas,
    }

    res.json({
      contadores: {
        total: totalSolicitacoes,
        abertas,
        em_atendimento: emAtendimento,
        concluidas,
        atrasadas,
        vence_hoje: venceHoje,
        alta_ou_urgente: altaOuUrgente,
        tempo_medio_horas: Math.round(tempoMedioHoras * 10) / 10,
        taxa_conclusao: Math.round(taxaConclusao * 10) / 10,
        postes_ativos: postesAtivos,
      },
      ordens: {
        total: totalOrdens,
        abertas: ordensAbertas,
        em_execucao: ordensEmExecucao,
      },
      sla: slaGeral,
      por_status: porStatus,
      por_prioridade: porPrioridade,
      por_bairro: Object.entries(porBairro)
        .map(([bairro, total]) => ({ bairro, total }))
        .sort((a, b) => b.total - a.total),
      por_tipo_problema: Object.entries(porTipoProblema)
        .map(([tipo, total]) => ({ tipo, total }))
        .sort((a, b) => b.total - a.total),
      urgentes,
      postes_por_bairro: Object.entries(postesPorBairro)
        .map(([bairro, total]) => ({ bairro, total }))
        .sort((a, b) => b.total - a.total),
    })
  } catch (error) {
    console.error('Erro ao buscar resumo do dashboard:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
