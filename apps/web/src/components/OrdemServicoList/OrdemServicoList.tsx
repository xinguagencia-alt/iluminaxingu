import { useMemo, useState } from 'react'
import { useOrdensServico } from './useOrdensServico'
import { useEquipes } from '../../hooks/useEquipes'
import {
  STATUS_ORDEM_COLORS,
  STATUS_ORDEM_LABELS,
  type OrdemServico,
  type StatusOrdemServico,
} from './types'
import styles from './OrdemServicoList.module.css'

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

function StatusBadge({ status }: { status: StatusOrdemServico }) {
  return (
    <span
      className={styles.badge}
      style={{
        backgroundColor: STATUS_ORDEM_COLORS[status],
        color: 'white',
      }}
    >
      {STATUS_ORDEM_LABELS[status]}
    </span>
  )
}

function statusOptions(current: StatusOrdemServico) {
  const options: StatusOrdemServico[] = ['aberta', 'em_execucao', 'em_manutencao', 'concluida', 'cancelada']
  return options.filter((status) => status !== current)
}

function StatusModal({
  ordem,
  onClose,
  onSave,
}: {
  ordem: OrdemServico
  onClose: () => void
  onSave: (status: StatusOrdemServico, observacao?: string, resultado?: string) => Promise<boolean>
}) {
  const [novoStatus, setNovoStatus] = useState<StatusOrdemServico>(ordem.status)
  const [observacao, setObservacao] = useState('')
  const [resultado, setResultado] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const success = await onSave(novoStatus, observacao, resultado)
    setSaving(false)
    if (success) onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Atualizar ordem</h3>
        <p className={styles.modalProtocol}>Protocolo: {ordem.protocolo}</p>

        <label className={styles.modalLabel}>Novo status</label>
        <select
          className={styles.modalSelect}
          value={novoStatus}
          onChange={(e) => setNovoStatus(e.target.value as StatusOrdemServico)}
          disabled={saving}
        >
          <option value={ordem.status}>{STATUS_ORDEM_LABELS[ordem.status]}</option>
          {statusOptions(ordem.status).map((status) => (
            <option key={status} value={status}>
              {STATUS_ORDEM_LABELS[status]}
            </option>
          ))}
        </select>

        <label className={styles.modalLabel}>Observação</label>
        <textarea
          className={styles.modalTextarea}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          placeholder="Detalhes da execução"
          disabled={saving}
        />

        <label className={styles.modalLabel}>Resultado</label>
        <input
          className={styles.modalInput}
          value={resultado}
          onChange={(e) => setResultado(e.target.value)}
          placeholder="Ex: reparo concluído"
          disabled={saving}
        />

        <div className={styles.modalActions}>
          <button className={styles.modalCancelButton} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className={styles.modalConfirmButton}
            onClick={handleSave}
            disabled={saving || novoStatus === ordem.status}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function OrdemServicoList({ onDetalhes }: { onDetalhes?: (id: number) => void }) {
  const { ordens, loading, error, refetch, atualizarStatus } = useOrdensServico()
  const { equipes } = useEquipes()
  const [filtro, setFiltro] = useState<'' | StatusOrdemServico>('')
  const [filtroEquipe, setFiltroEquipe] = useState<'' | number>('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const ordensFiltradas = useMemo(() => {
    let filtradas = ordens
    if (filtro) {
      filtradas = filtradas.filter((ordem) => ordem.status === filtro)
    }
    if (filtroEquipe !== '') {
      filtradas = filtradas.filter((ordem) => ordem.equipe_id === filtroEquipe)
    }
    return filtradas
  }, [filtro, filtroEquipe, ordens])

  const editingOrdem = editingId ? ordens.find((ordem) => ordem.id === editingId) || null : null

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Carregando ordens de serviço...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h3>Erro ao carregar dados</h3>
          <p>{error}</p>
          <button className={styles.retryButton} onClick={refetch}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {editingOrdem && (
        <StatusModal
          ordem={editingOrdem}
          onClose={() => setEditingId(null)}
          onSave={(status, observacao, resultado) =>
            atualizarStatus(editingOrdem.id, status, observacao, resultado)
          }
        />
      )}

      <div className={styles.header}>
        <h2>Ordens de Serviço</h2>
        <span className={styles.count}>{ordensFiltradas.length} registro(s)</span>
      </div>

      <div className={styles.filters}>
        <select
          className={styles.select}
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as '' | StatusOrdemServico)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_ORDEM_LABELS).map(([status, label]) => (
            <option key={status} value={status}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={filtroEquipe}
          onChange={(e) => setFiltroEquipe(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Todas as equipes</option>
          {equipes.map((equipe) => (
            <option key={equipe.id} value={equipe.id}>
              {equipe.nome}
            </option>
          ))}
        </select>
      </div>

      {ordensFiltradas.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>Nenhuma ordem encontrada</h3>
          <p>Não há ordens de serviço para os filtros atuais.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Status</th>
                <th>Equipe</th>
                <th>Endereco</th>
                <th>Aberta em</th>
                <th>Execução</th>
                <th>Encerramento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordensFiltradas.map((ordem) => (
                <tr key={ordem.id}>
                  <td className={styles.protocol}>{ordem.protocolo}</td>
                  <td>
                    <StatusBadge status={ordem.status} />
                  </td>
                  <td>{ordem.equipe_nome || '-'}</td>
                  <td>{ordem.endereco_informado || '-'}</td>
                  <td>{formatDate(ordem.data_abertura)}</td>
                  <td>{formatDate(ordem.data_execucao)}</td>
                  <td>{formatDate(ordem.data_encerramento)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {onDetalhes && (
                        <button
                          className={styles.editButton}
                          onClick={() => onDetalhes(ordem.id)}
                        >
                          Detalhes
                        </button>
                      )}
                      <button className={styles.editButton} onClick={() => setEditingId(ordem.id)}>
                        Atualizar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
