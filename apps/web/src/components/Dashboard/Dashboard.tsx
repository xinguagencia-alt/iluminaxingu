import { useDashboard } from '../../hooks/useDashboard'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  TIPOS_PROBLEMA,
  STATUS_SLA_LABELS,
  type StatusSla,
} from '../SolicitacaoList/types'
import styles from './Dashboard.module.css'

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR')
}

function formatTempoHoras(horas: number): string {
  if (horas < 1) return '< 1h'
  if (horas < 24) return `${Math.round(horas)}h`
  const dias = Math.floor(horas / 24)
  const horasRestantes = Math.round(horas % 24)
  if (horasRestantes === 0) return `${dias}d`
  return `${dias}d ${horasRestantes}h`
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ALL_STATUSES_ORDER = [
  'enviada',
  'em_analise',
  'em_execucao',
  'em_manutencao',
  'concluida',
  'nao_procedente',
  'cancelada',
  'duplicada',
]

const ALL_PRIORIDADES_ORDER = ['urgente', 'alta', 'media', 'baixa']

const TIPOS_PROBLEMA_LABELS: Record<string, string> = {
  poste_danificado: 'Poste danificado',
  lampada_apagada: 'Lampada apagada',
  lampada_piscando: 'Lampada piscando',
  risco_eletrico: 'Risco eletrico',
  fio_exposto: 'Fio exposto',
  outro: 'Outro',
}

const SLA_BADGE_CLASSES: Record<string, string> = {
  dentro_do_prazo: styles.slaOk,
  vence_hoje: styles.slaAtencao,
  atrasada: styles.slaAtrasado,
  concluida_no_prazo: styles.slaOk,
  concluida_com_atraso: styles.slaAtrasado,
}

export function Dashboard() {
  const { data, loading, error, refetch } = useDashboard()

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Carregando painel executivo...</p>
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
            <button className={styles.secondaryButton} onClick={refetch}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { contadores, ordens, sla, por_status, por_prioridade, por_bairro, por_tipo_problema, urgentes } = data

  const maxBairro = Math.max(...por_bairro.map((b) => b.total), 1)
  const maxTipo = Math.max(...por_tipo_problema.map((t) => t.total), 1)
  const maxStatus = Math.max(...Object.values(por_status), 1)
  const maxPrioridade = Math.max(...Object.values(por_prioridade), 1)

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div>
          <span className={styles.kicker}>Painel Executivo</span>
          <h2>Dashboard da Prefeitura</h2>
          <p>Indicadores operacionais de iluminacao publica em tempo real.</p>
        </div>
        <div className={styles.heroMetrics}>
          <div className={styles.heroMetric}>
            <strong>{contadores.taxa_conclusao}%</strong>
            <span>Taxa de conclusao</span>
          </div>
          <div className={styles.heroMetric}>
            <strong>{formatTempoHoras(contadores.tempo_medio_horas)}</strong>
            <span>Tempo medio de atendimento</span>
          </div>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: '#eff6ff', color: '#2563eb' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total de solicitacoes</span>
            <strong className={styles.kpiValue}>{formatCount(contadores.total)}</strong>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: '#fef3c7', color: '#d97706' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Abertas</span>
            <strong className={styles.kpiValue}>{formatCount(contadores.abertas)}</strong>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Em atendimento</span>
            <strong className={styles.kpiValue}>{formatCount(contadores.em_atendimento)}</strong>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: '#dcfce7', color: '#16a34a' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Concluidas</span>
            <strong className={styles.kpiValue}>{formatCount(contadores.concluidas)}</strong>
          </div>
        </article>

        <article className={`${styles.kpiCard} ${contadores.atrasadas > 0 ? styles.kpiCardAlert : ''}`}>
          <div className={styles.kpiIcon} style={{ background: '#fef2f2', color: '#dc2626' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Atrasadas no SLA</span>
            <strong className={`${styles.kpiValue} ${contadores.atrasadas > 0 ? styles.kpiValueAlert : ''}`}>
              {formatCount(contadores.atrasadas)}
            </strong>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: '#fff7ed', color: '#ea580c' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Prioridade alta/urgente</span>
            <strong className={styles.kpiValue}>{formatCount(contadores.alta_ou_urgente)}</strong>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: '#f0fdf4', color: '#15803d' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Ordens de servico abertas</span>
            <strong className={styles.kpiValue}>{formatCount(ordens.abertas + ordens.em_execucao)}</strong>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: '#f8fafc', color: '#475569' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Postes ativos</span>
            <strong className={styles.kpiValue}>{formatCount(contadores.postes_ativos)}</strong>
          </div>
        </article>
      </div>

      <div className={styles.slaSection}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Visao geral do SLA</h3>
          </div>
          <div className={styles.slaBar}>
            <div
              className={`${styles.slaSegment} ${styles.slaSegmentOk}`}
              style={{ flex: Math.max(sla.dentro_do_prazo, 1) }}
            >
              <span className={styles.slaBarLabel}>Dentro do prazo</span>
              <strong>{formatCount(sla.dentro_do_prazo)}</strong>
            </div>
            <div
              className={`${styles.slaSegment} ${styles.slaSegmentAtencao}`}
              style={{ flex: Math.max(sla.vence_hoje, 1) }}
            >
              <span className={styles.slaBarLabel}>Vence hoje</span>
              <strong>{formatCount(sla.vence_hoje)}</strong>
            </div>
            <div
              className={`${styles.slaSegment} ${styles.slaSegmentAtrasado}`}
              style={{ flex: Math.max(sla.atrasada, 1) }}
            >
              <span className={styles.slaBarLabel}>Atrasado</span>
              <strong>{formatCount(sla.atrasada)}</strong>
            </div>
          </div>
          <div className={styles.slaLegend}>
            <span className={styles.slaLegendItem}>
              <span className={`${styles.slaDot} ${styles.slaDotOk}`} /> Dentro do prazo
            </span>
            <span className={styles.slaLegendItem}>
              <span className={`${styles.slaDot} ${styles.slaDotAtencao}`} /> Vence hoje
            </span>
            <span className={styles.slaLegendItem}>
              <span className={`${styles.slaDot} ${styles.slaDotAtrasado}`} /> Atrasado
            </span>
          </div>
        </section>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Solicitacoes por bairro</h3>
            <span className={styles.panelBadge}>{por_bairro.length} bairro(s)</span>
          </div>
          {por_bairro.length === 0 ? (
            <p className={styles.emptyText}>Nenhuma solicitacao registrada.</p>
          ) : (
            <div className={styles.barChart}>
              {por_bairro.slice(0, 10).map(({ bairro, total }) => (
                <div key={bairro} className={styles.barRow}>
                  <span className={styles.barLabel}>{bairro}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(total / maxBairro) * 100}%`,
                        backgroundColor: '#f59e0b',
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{formatCount(total)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Tipos de problema mais comuns</h3>
            <span className={styles.panelBadge}>{por_tipo_problema.length} tipo(s)</span>
          </div>
          {por_tipo_problema.length === 0 ? (
            <p className={styles.emptyText}>Nenhuma solicitacao registrada.</p>
          ) : (
            <div className={styles.barChart}>
              {por_tipo_problema.map(({ tipo, total }) => (
                <div key={tipo} className={styles.barRow}>
                  <span className={styles.barLabel}>{TIPOS_PROBLEMA_LABELS[tipo] || tipo}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(total / maxTipo) * 100}%`,
                        backgroundColor: '#ea580c',
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{formatCount(total)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Solicitacoes por status</h3>
          </div>
          <div className={styles.barChart}>
            {ALL_STATUSES_ORDER.map((status) => {
              const count = por_status[status] || 0
              if (count === 0) return null
              return (
                <div key={status} className={styles.barRow}>
                  <span className={styles.barLabel}>{STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(count / maxStatus) * 100}%`,
                        backgroundColor: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
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
            {ALL_PRIORIDADES_ORDER.map((prioridade) => {
              const count = por_prioridade[prioridade] || 0
              if (count === 0) return null
              return (
                <div key={prioridade} className={styles.barRow}>
                  <span className={styles.barLabel}>{PRIORIDADE_LABELS[prioridade as keyof typeof PRIORIDADE_LABELS]}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(count / maxPrioridade) * 100}%`,
                        backgroundColor: PRIORIDADE_COLORS[prioridade as keyof typeof PRIORIDADE_COLORS],
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

      {urgentes.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Solicitacoes mais urgentes</h3>
            <span className={`${styles.panelBadge} ${styles.panelBadgeRed}`}>{urgentes.length}</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Solicitante</th>
                  <th>Problema</th>
                  <th>Prioridade</th>
                  <th>Status</th>
                  <th>SLA</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {urgentes.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className={styles.protocolTag}>{s.protocolo}</span>
                    </td>
                    <td className={styles.tdName}>{s.nome_solicitante}</td>
                    <td>{TIPOS_PROBLEMA[s.tipo_problema] || s.tipo_problema}</td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{
                          backgroundColor: PRIORIDADE_COLORS[s.prioridade as keyof typeof PRIORIDADE_COLORS],
                        }}
                      >
                        {PRIORIDADE_LABELS[s.prioridade as keyof typeof PRIORIDADE_LABELS]}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{
                          backgroundColor: STATUS_COLORS[s.status_atual as keyof typeof STATUS_COLORS],
                        }}
                      >
                        {STATUS_LABELS[s.status_atual as keyof typeof STATUS_LABELS]}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.slaBadge} ${SLA_BADGE_CLASSES[s.status_sla] || ''}`}>
                        {STATUS_SLA_LABELS[s.status_sla as StatusSla]}
                      </span>
                    </td>
                    <td className={styles.tdDate}>{formatDateTime(s.prazo_sla)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Ordens de servico</h3>
          </div>
          <div className={styles.statStack}>
            <div>
              <span>Total de ordens</span>
              <strong>{formatCount(ordens.total)}</strong>
            </div>
            <div>
              <span>Abertas</span>
              <strong>{formatCount(ordens.abertas)}</strong>
            </div>
            <div>
              <span>Em execucao</span>
              <strong>{formatCount(ordens.em_execucao)}</strong>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Resumo geral</h3>
          </div>
          <div className={styles.statStack}>
            <div>
              <span>Total de solicitacoes</span>
              <strong>{formatCount(contadores.total)}</strong>
            </div>
            <div>
              <span>Solicitacoes abertas</span>
              <strong>{formatCount(contadores.abertas)}</strong>
            </div>
            <div>
              <span>Prazo medio de resposta</span>
              <strong>{formatTempoHoras(contadores.tempo_medio_horas)}</strong>
            </div>
            <div>
              <span>Postes ativos no sistema</span>
              <strong>{formatCount(contadores.postes_ativos)}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
