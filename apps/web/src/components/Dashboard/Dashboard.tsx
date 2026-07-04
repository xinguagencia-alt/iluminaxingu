import { useMemo } from 'react'
import { useSolicitacoes } from '../SolicitacaoList/useSolicitacoes'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  TIPOS_PROBLEMA,
  type StatusSolicitacao,
  type PrioridadeSolicitacao,
} from '../SolicitacaoList/types'
import { useAdminPostes } from '../../hooks/useAdminPostes'
import { useOrdensServico } from '../OrdemServicoList/useOrdensServico'
import styles from './Dashboard.module.css'

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`
}

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR')
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const ALL_STATUSES: StatusSolicitacao[] = [
  'enviada',
  'em_analise',
  'em_execucao',
  'concluida',
  'nao_procedente',
  'cancelada',
  'duplicada',
]

const ALL_PRIORIDADES: PrioridadeSolicitacao[] = ['urgente', 'alta', 'media', 'baixa']

export function Dashboard() {
  const {
    solicitacoes,
    loading: loadingSolicitacoes,
    error: errorSolicitacoes,
    refetch: refetchSolicitacoes,
  } = useSolicitacoes()
  const {
    postes,
    loading: loadingPostes,
    error: errorPostes,
    refetch: refetchPostes,
  } = useAdminPostes()
  const {
    ordens,
    loading: loadingOrdens,
    error: errorOrdens,
    refetch: refetchOrdens,
  } = useOrdensServico()

  const loading = loadingSolicitacoes || loadingPostes || loadingOrdens
  const error = errorSolicitacoes || errorPostes || errorOrdens

  const metrics = useMemo(() => {
    const totalSolicitacoes = solicitacoes.length
    const porStatus = solicitacoes.reduce<Record<string, number>>((acc, s) => {
      acc[s.status_atual] = (acc[s.status_atual] || 0) + 1
      return acc
    }, {})

    const porPrioridade = solicitacoes.reduce<Record<string, number>>((acc, s) => {
      acc[s.prioridade] = (acc[s.prioridade] || 0) + 1
      return acc
    }, {})

    const abertas = solicitacoes.filter(
      (s) =>
        s.status_atual !== 'concluida' &&
        s.status_atual !== 'cancelada' &&
        s.status_atual !== 'nao_procedente' &&
        s.status_atual !== 'duplicada'
    ).length

    const urgentes = solicitacoes.filter((s) => s.prioridade === 'urgente').length
    const concluidas = porStatus.concluida || 0
    const postesComLocalizacao = postes.filter(
      (p) => p.latitude !== null && p.longitude !== null
    ).length
    const postesAtivos = postes.filter((p) => p.status_ativo).length

    const maxStatusCount = Math.max(...Object.values(porStatus), 1)
    const maxPrioridadeCount = Math.max(...Object.values(porPrioridade), 1)

    const ultimasSolicitacoes = [...solicitacoes]
      .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
      .slice(0, 5)

    const ultimosPostes = postes.slice(0, 5)

    const ordensPorEquipe = ordens.reduce<Record<string, number>>((acc, ordem) => {
      const nome = ordem.equipe_nome || 'Sem equipe'
      acc[nome] = (acc[nome] || 0) + 1
      return acc
    }, {})

    const equipesMaisCarregadas = Object.entries(ordensPorEquipe)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const ordensAbertas = ordens.filter((ordem) => ordem.status === 'aberta').length
    const ordensEmExecucao = ordens.filter((ordem) => ordem.status === 'em_execucao').length

    const postesPorBairro = postes
      .filter((p) => p.status_ativo)
      .reduce<Record<string, number>>((acc, p) => {
        const bairro = p.bairro || 'Sem bairro informado'
        acc[bairro] = (acc[bairro] || 0) + 1
        return acc
      }, {})

    const bairrosOrdenados = Object.entries(postesPorBairro)
      .map(([bairro, total]) => ({ bairro, total }))
      .sort((a, b) => b.total - a.total)

    const maxBairroCount = Math.max(...bairrosOrdenados.map((b) => b.total), 1)

    return {
      totalSolicitacoes,
      abertas,
      urgentes,
      concluidas,
      postesAtivos,
      postesComLocalizacao,
      taxaConclusao: totalSolicitacoes > 0 ? (concluidas / totalSolicitacoes) * 100 : 0,
      porStatus,
      porPrioridade,
      maxStatusCount,
      maxPrioridadeCount,
      ultimasSolicitacoes,
      ultimosPostes,
      totalOrdens: ordens.length,
      ordensAbertas,
      ordensEmExecucao,
      equipesMaisCarregadas,
      bairrosOrdenados,
      maxBairroCount,
    }
  }, [ordens, postes, solicitacoes])

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Montando o painel...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h3>Erro ao carregar o painel</h3>
          <p>{error}</p>
          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              onClick={() => {
                refetchSolicitacoes()
                refetchPostes()
                refetchOrdens()
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div>
          <span className={styles.kicker}>Resumo operacional</span>
          <h2>Painel do sistema</h2>
          <p>
            Acompanhe solicitações, postes, ordens e a saúde geral da operação em um
            lugar só.
          </p>
        </div>
        <div className={styles.heroMetric}>
          <strong>{formatPercent(metrics.taxaConclusao)}</strong>
          <span>taxa de conclusão</span>
        </div>
      </div>

      <div className={styles.grid}>
        <article className={styles.card}>
          <span className={styles.cardLabel}>Solicitações</span>
          <strong>{formatCount(metrics.totalSolicitacoes)}</strong>
          <p>Total registradas no sistema</p>
        </article>
        <article className={styles.card}>
          <span className={styles.cardLabel}>Em aberto</span>
          <strong>{formatCount(metrics.abertas)}</strong>
          <p>Precisam de atenção da equipe</p>
        </article>
        <article className={styles.card}>
          <span className={styles.cardLabel}>Ordens</span>
          <strong>{formatCount(metrics.totalOrdens)}</strong>
          <p>Ordens de serviço criadas</p>
        </article>
        <article className={styles.card}>
          <span className={styles.cardLabel}>Postes ativos</span>
          <strong>{formatCount(metrics.postesAtivos)}</strong>
          <p>Cadastros ativos disponíveis</p>
        </article>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Solicitações por status</h3>
          </div>
          <div className={styles.barChart}>
            {ALL_STATUSES.map((status) => {
              const count = metrics.porStatus[status] || 0
              const pct = (count / metrics.maxStatusCount) * 100
              return (
                <div key={status} className={styles.barRow}>
                  <span className={styles.barLabel}>{STATUS_LABELS[status]}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: STATUS_COLORS[status],
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{formatCount(count)}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Prioridades</h3>
          </div>
          <div className={styles.barChart}>
            {ALL_PRIORIDADES.map((prioridade) => {
              const count = metrics.porPrioridade[prioridade] || 0
              const pct = (count / metrics.maxPrioridadeCount) * 100
              return (
                <div key={prioridade} className={styles.barRow}>
                  <span className={styles.barLabel}>{PRIORIDADE_LABELS[prioridade]}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: PRIORIDADE_COLORS[prioridade],
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{formatCount(count)}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Últimas solicitações</h3>
            <span className={styles.panelBadge}>{metrics.ultimasSolicitacoes.length}</span>
          </div>
          {metrics.ultimasSolicitacoes.length === 0 ? (
            <p className={styles.emptyText}>Nenhuma solicitação registrada.</p>
          ) : (
            <div className={styles.listSection}>
              {metrics.ultimasSolicitacoes.map((s) => (
                <div key={s.id} className={styles.listItem}>
                  <div className={styles.listItemHeader}>
                    <span className={styles.protocolTag}>{s.protocolo}</span>
                    <span
                      className={styles.miniBadge}
                      style={{
                        backgroundColor: STATUS_COLORS[s.status_atual],
                        color: 'white',
                      }}
                    >
                      {STATUS_LABELS[s.status_atual]}
                    </span>
                    <span
                      className={styles.miniBadge}
                      style={{
                        backgroundColor: PRIORIDADE_COLORS[s.prioridade],
                        color: 'white',
                      }}
                    >
                      {PRIORIDADE_LABELS[s.prioridade]}
                    </span>
                  </div>
                  <div className={styles.listItemBody}>
                    <span className={styles.listItemName}>{s.nome_solicitante}</span>
                    <span className={styles.listItemType}>
                      {TIPOS_PROBLEMA[s.tipo_problema] || s.tipo_problema}
                    </span>
                  </div>
                  <span className={styles.listItemDate}>{formatDate(s.criado_em)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Ordens por equipe</h3>
            <span className={styles.panelBadge}>{metrics.ordensEmExecucao + metrics.ordensAbertas}</span>
          </div>
          {metrics.equipesMaisCarregadas.length === 0 ? (
            <p className={styles.emptyText}>Nenhuma ordem de serviço registrada.</p>
          ) : (
            <div className={styles.listSection}>
              {metrics.equipesMaisCarregadas.map((item) => (
                <div key={item.nome} className={styles.listItem}>
                  <div className={styles.listItemHeader}>
                    <span className={styles.protocolTag}>{item.nome}</span>
                    <span className={styles.miniBadgeNeutral}>{formatCount(item.total)} OS</span>
                  </div>
                  <div className={styles.listItemBody}>
                    <span className={styles.listItemType}>
                      Volume de ordens atribuídas para a equipe
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Postes cadastrados</h3>
            <span className={styles.panelBadge}>{postes.length}</span>
          </div>
          {metrics.ultimosPostes.length === 0 ? (
            <p className={styles.emptyText}>Nenhum poste cadastrado.</p>
          ) : (
            <div className={styles.listSection}>
              {metrics.ultimosPostes.map((p) => (
                <div key={p.id} className={styles.listItem}>
                  <div className={styles.listItemHeader}>
                    <span className={styles.protocolTag}>{p.codigo}</span>
                    {p.tipo_luminaria && (
                      <span className={styles.miniBadgeNeutral}>{p.tipo_luminaria}</span>
                    )}
                    {p.potencia && (
                      <span className={styles.miniBadgeNeutral}>{p.potencia}W</span>
                    )}
                  </div>
                  <div className={styles.listItemBody}>
                    <span className={styles.listItemName}>
                      {[p.rua, p.numero].filter(Boolean).join(', ') || 'Sem endereco informado'}
                    </span>
                    <span className={styles.miniBadgeNeutral}>
                      {p.bairro || 'Sem bairro informado'}
                    </span>
                  </div>
                  {p.latitude != null && p.longitude != null && (
                    <span className={styles.listItemDate}>
                      {Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Status das ordens</h3>
          </div>
          <div className={styles.statStack}>
            <div>
              <span>Abertas</span>
              <strong>{formatCount(metrics.ordensAbertas)}</strong>
            </div>
            <div>
              <span>Em execução</span>
              <strong>{formatCount(metrics.ordensEmExecucao)}</strong>
            </div>
            <div>
              <span>Postes com geolocalização</span>
              <strong>{formatCount(metrics.postesComLocalizacao)}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3>Postes por bairro</h3>
          <span className={styles.panelBadge}>{metrics.bairrosOrdenados.length} bairro(s)</span>
        </div>
        {metrics.bairrosOrdenados.length === 0 ? (
          <p className={styles.emptyText}>Nenhum poste com bairro informado.</p>
        ) : (
          <div className={styles.barChart}>
            {metrics.bairrosOrdenados.map(({ bairro, total }) => {
              const pct = (total / metrics.maxBairroCount) * 100
              return (
                <div key={bairro} className={styles.barRow}>
                  <span className={styles.barLabel}>{bairro}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: '#f59e0b',
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{formatCount(total)}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
