import { useState, FormEvent, useEffect } from 'react'
import { useSolicitacaoPublica } from './useSolicitacaoPublica'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  STATUS_SLA_LABELS,
  STATUS_SLA_COLORS,
  TIPOS_PROBLEMA,
  type StatusSolicitacao,
  type StatusSla,
} from '../SolicitacaoList/types'
import { STATUS_ORDEM_LABELS, STATUS_ORDEM_COLORS, type StatusOrdemServico } from '../OrdemServicoList/types'
import styles from './SolicitacaoPublica.module.css'

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ label, color, large }: { label: string; color: string; large?: boolean }) {
  return (
    <span
      className={`${styles.badge} ${large ? styles.badgeLarge : ''}`}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  )
}

interface SolicitacaoPublicaProps {
  onVoltar?: () => void
  initialProtocolo?: string
}

export function SolicitacaoPublica({ onVoltar, initialProtocolo }: SolicitacaoPublicaProps) {
  const { data, loading, error, buscar, limpar } = useSolicitacaoPublica()
  const [protocolo, setProtocolo] = useState(initialProtocolo || '')

  useEffect(() => {
    if (initialProtocolo && initialProtocolo.trim()) {
      buscar(initialProtocolo)
    }
  }, [initialProtocolo, buscar])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (protocolo.trim()) {
      buscar(protocolo)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <span>Buscando solicitacao...</span>
        </div>
      </div>
    )
  }

  if (data) {
    const { solicitacao, historico } = data
    const statusColor = STATUS_COLORS[solicitacao.status_atual]
    const prioridadeColor = PRIORIDADE_COLORS[solicitacao.prioridade]

    return (
      <div className={styles.container}>
        {onVoltar && (
          <button className={styles.backLink} onClick={onVoltar}>
            ← Nova consulta
          </button>
        )}

        <div className={styles.hero}>
          <div className={styles.heroBadge} style={{ backgroundColor: statusColor }}>
            {STATUS_LABELS[solicitacao.status_atual]}
          </div>
          <h1 className={styles.heroProtocol}>{solicitacao.protocolo}</h1>
          <p className={styles.heroDate}>Aberto em {formatDate(solicitacao.criado_em)}</p>
        </div>

        <div className={styles.pills}>
          <span className={styles.pill}>
            <span className={styles.pillLabel}>Tipo</span>
            <span className={styles.pillValue}>{TIPOS_PROBLEMA[solicitacao.tipo_problema] || solicitacao.tipo_problema}</span>
          </span>
          <span className={styles.pill}>
            <span className={styles.pillLabel}>Prioridade</span>
            <span className={styles.pillValue} style={{ color: prioridadeColor }}>
              {PRIORIDADE_LABELS[solicitacao.prioridade]}
            </span>
          </span>
          {solicitacao.codigo_poste_informado && (
            <span className={styles.pill}>
              <span className={styles.pillLabel}>Poste</span>
              <span className={styles.pillValue}>{solicitacao.codigo_poste_informado}</span>
            </span>
          )}
        </div>

        <div className={styles.slaCard}>
          <div className={styles.slaHeader}>
            <span className={styles.slaLabel}>Prazo estimado</span>
            <span
              className={styles.slaBadge}
              style={{ backgroundColor: STATUS_SLA_COLORS[solicitacao.status_sla as StatusSla] }}
            >
              {STATUS_SLA_LABELS[solicitacao.status_sla as StatusSla]}
            </span>
          </div>
          <div className={styles.slaValue}>
            {new Date(solicitacao.prazo_sla).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Ordem de Servico</h2>
          {solicitacao.ordem_servico_id ? (
            <div
              className={styles.osBox}
              style={{ borderLeftColor: STATUS_ORDEM_COLORS[solicitacao.os_status as StatusOrdemServico] || '#64748b' }}
            >
              <div className={styles.osTop}>
                <span className={styles.osNumber}>#{solicitacao.ordem_servico_id}</span>
                <StatusBadge
                  label={STATUS_ORDEM_LABELS[solicitacao.os_status as StatusOrdemServico] || solicitacao.os_status || '-'}
                  color={STATUS_ORDEM_COLORS[solicitacao.os_status as StatusOrdemServico] || '#64748b'}
                />
              </div>
              <div className={styles.osGrid}>
                <div className={styles.osField}>
                  <span className={styles.osFieldLabel}>Abertura</span>
                  <span className={styles.osFieldValue}>{formatDate(solicitacao.os_data_abertura)}</span>
                </div>
                <div className={styles.osField}>
                  <span className={styles.osFieldLabel}>Encerramento</span>
                  <span className={styles.osFieldValue}>{formatDate(solicitacao.os_data_encerramento)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.osPending}>
              <span className={styles.osPendingIcon}>⏳</span>
              <div>
                <p className={styles.osPendingTitle}>Ainda nao foi gerada ordem de servico</p>
                <p className={styles.osPendingText}>
                  Sua solicitacao esta sendo analisada pela equipe tecnica.
                  Assim que uma ordem for criada, voce vera os detalhes aqui.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Andamento</h2>
          {historico.length === 0 ? (
            <div className={styles.emptyBox}>Nenhum registro encontrado.</div>
          ) : (
            <div className={styles.timeline}>
              {historico.map((item, index) => {
                const novoLabel = STATUS_LABELS[item.status_novo as StatusSolicitacao] || item.status_novo
                const novoColor = STATUS_COLORS[item.status_novo as StatusSolicitacao] || '#64748b'
                const isLast = index === historico.length - 1

                return (
                  <div key={item.id} className={styles.timelineItem}>
                    <div className={styles.timelineLeft}>
                      <div
                        className={`${styles.timelineDot} ${isLast ? styles.timelineDotActive : ''}`}
                        style={{ backgroundColor: novoColor }}
                      />
                      {index < historico.length - 1 && <div className={styles.timelineLine} />}
                    </div>
                    <div className={styles.timelineBody}>
                      <div className={styles.timelineTop}>
                        <div className={styles.timelineStatuses}>
                          {item.status_anterior && (
                            <>
                              <StatusBadge
                                label={STATUS_LABELS[item.status_anterior as StatusSolicitacao] || item.status_anterior}
                                color={STATUS_COLORS[item.status_anterior as StatusSolicitacao] || '#64748b'}
                              />
                              <span className={styles.timelineArrow}>→</span>
                            </>
                          )}
                          <StatusBadge label={novoLabel} color={novoColor} />
                        </div>
                        <span className={styles.timelineDate}>{formatDate(item.criado_em)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <button
          className={styles.newSearchBtn}
          onClick={() => {
            limpar()
            setProtocolo('')
          }}
        >
          Nova Consulta
        </button>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchCard}>
        <div className={styles.searchIcon}>🔍</div>
        <h1 className={styles.searchTitle}>Consultar Solicitacao</h1>
        <p className={styles.searchDesc}>
          Informe o numero do protocolo para acompanhar o andamento da sua solicitacao.
        </p>

        <form onSubmit={handleSubmit} className={styles.searchForm}>
          <input
            type="text"
            className={styles.searchInput}
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value)}
            placeholder="Ex: ILX20260625-ABC123"
            autoFocus
          />
          <button
            type="submit"
            className={styles.searchBtn}
            disabled={!protocolo.trim() || loading}
          >
            {loading ? 'Buscando...' : 'Consultar'}
          </button>
        </form>

        {error && <div className={styles.searchError}>{error}</div>}
      </div>
    </div>
  )
}
