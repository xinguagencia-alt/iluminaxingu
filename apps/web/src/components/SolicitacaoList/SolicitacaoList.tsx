import { useState } from 'react'
import { useSolicitacoes } from './useSolicitacoes'
import { useEquipes } from '../../hooks/useEquipes'
import {
  Solicitacao,
  StatusSolicitacao,
  PrioridadeSolicitacao,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  TIPOS_PROBLEMA,
} from './types'
import styles from './SolicitacaoList.module.css'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: StatusSolicitacao }) {
  return (
    <span
      className={styles.badge}
      style={{
        backgroundColor: STATUS_COLORS[status],
        color: 'white',
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function PrioridadeBadge({ prioridade }: { prioridade: PrioridadeSolicitacao }) {
  return (
    <span
      className={styles.badge}
      style={{
        backgroundColor: PRIORIDADE_COLORS[prioridade],
        color: 'white',
      }}
    >
      {PRIORIDADE_LABELS[prioridade]}
    </span>
  )
}

interface StatusEditModalProps {
  solicitacaoId: number
  protocolo: string
  statusAtual: StatusSolicitacao
  onConfirm: (id: number, status: StatusSolicitacao, observacao?: string) => Promise<boolean>
  onClose: () => void
}

function StatusEditModal({
  solicitacaoId,
  protocolo,
  statusAtual,
  onConfirm,
  onClose,
}: StatusEditModalProps) {
  const [novoStatus, setNovoStatus] = useState<StatusSolicitacao>(statusAtual)
  const [observacao, setObservacao] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    setSaving(true)
    const success = await onConfirm(solicitacaoId, novoStatus, observacao)
    setSaving(false)
    if (success) onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Alterar Status</h3>
        <p className={styles.modalProtocol}>Protocolo: {protocolo}</p>

        <label className={styles.modalLabel}>Novo status</label>
        <select
          className={styles.modalSelect}
          value={novoStatus}
          onChange={(e) => setNovoStatus(e.target.value as StatusSolicitacao)}
          disabled={saving}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label className={styles.modalLabel}>Observação (opcional)</label>
        <textarea
          className={styles.modalTextarea}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Motivo da alteração..."
          rows={3}
          disabled={saving}
        />

        <div className={styles.modalActions}>
          <button
            className={styles.modalCancelButton}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className={styles.modalConfirmButton}
            onClick={handleConfirm}
            disabled={saving || novoStatus === statusAtual}
          >
            {saving ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface GerarOrdemModalProps {
  solicitacaoId: number
  protocolo: string
  onConfirm: (id: number, equipeId?: number) => Promise<boolean>
  onClose: () => void
}

function GerarOrdemModal({
  solicitacaoId,
  protocolo,
  onConfirm,
  onClose,
}: GerarOrdemModalProps) {
  const { equipes } = useEquipes()
  const [equipeId, setEquipeId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    if (!equipeId) return
    setSaving(true)
    const success = await onConfirm(solicitacaoId, Number(equipeId))
    setSaving(false)
    if (success) onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Gerar Ordem de Serviço</h3>
        <p className={styles.modalProtocol}>Protocolo: {protocolo}</p>
        <p style={{ margin: '0 0 12px', color: '#374151', fontSize: '0.95rem' }}>
          Selecione a equipe responsável para abrir a ordem.
        </p>

        <label className={styles.modalLabel}>Equipe responsável</label>
        <select
          className={styles.modalSelect}
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
          disabled={saving}
        >
          <option value="">Selecione uma equipe</option>
          {equipes.map((equipe) => (
            <option key={equipe.id} value={equipe.id}>
              {equipe.nome}
            </option>
          ))}
        </select>

        <div className={styles.modalActions}>
          <button
            className={styles.modalCancelButton}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className={styles.modalConfirmButton}
            onClick={handleConfirm}
            disabled={saving || !equipeId || equipes.length === 0}
          >
            {saving ? 'Criando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

function Toast({ message, type, onClose }: ToastProps) {
  return (
    <div className={`${styles.toast} ${type === 'error' ? styles.toastError : styles.toastSuccess}`}>
      <span>{message}</span>
      <button className={styles.toastClose} onClick={onClose}>×</button>
    </div>
  )
}

export function SolicitacaoList() {
  const {
    solicitacoes,
    loading,
    error,
    filtros,
    setFiltro,
    limparFiltros,
    refetch,
    atualizarStatus,
    criarOrdem,
  } = useSolicitacoes()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [gerandoOrdemPara, setGerandoOrdemPara] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const temFiltros = filtros.status || filtros.prioridade || filtros.busca

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function podeGerarOrdem(solicitacao: Solicitacao): boolean {
    if (solicitacao.ordem_servico_id !== null) return false
    if (['concluida', 'cancelada', 'nao_procedente', 'duplicada'].includes(solicitacao.status_atual)) return false
    return true
  }

  async function handleStatusUpdate(
    id: number,
    status: StatusSolicitacao,
    observacao?: string
  ): Promise<boolean> {
    const success = await atualizarStatus(id, status, observacao)
    if (success) {
      showToast('Status atualizado com sucesso!', 'success')
    } else {
      showToast('Erro ao atualizar status.', 'error')
    }
    return success
  }

  async function handleGerarOrdem(solicitacaoId: number, equipeId?: number): Promise<boolean> {
    if (!equipeId) {
      showToast('Selecione uma equipe para criar a ordem.', 'error')
      return false
    }

    const success = await criarOrdem(solicitacaoId, equipeId)
    if (success) {
      showToast('Ordem de serviço criada com sucesso!', 'success')
    } else {
      showToast('Erro ao criar ordem de serviço.', 'error')
    }
    return success
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Carregando solicitações...</p>
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

  const editingSolicitacao = editingId
    ? solicitacoes.find((s) => s.id === editingId)
    : null

  const gerandoOrdemSolicitacao = gerandoOrdemPara
    ? solicitacoes.find((s) => s.id === gerandoOrdemPara)
    : null

  return (
    <div className={styles.container}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {editingSolicitacao && (
        <StatusEditModal
          solicitacaoId={editingSolicitacao.id}
          protocolo={editingSolicitacao.protocolo}
          statusAtual={editingSolicitacao.status_atual}
          onConfirm={handleStatusUpdate}
          onClose={() => setEditingId(null)}
        />
      )}

      {gerandoOrdemSolicitacao && (
        <GerarOrdemModal
          solicitacaoId={gerandoOrdemSolicitacao.id}
          protocolo={gerandoOrdemSolicitacao.protocolo}
          onConfirm={handleGerarOrdem}
          onClose={() => setGerandoOrdemPara(null)}
        />
      )}

      <div className={styles.header}>
        <h2>Solicitações</h2>
        <span className={styles.count}>{solicitacoes.length} registro(s)</span>
      </div>

      <div className={styles.filters}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar por protocolo ou nome..."
          value={filtros.busca}
          onChange={(e) => setFiltro('busca', e.target.value)}
        />

        <select
          className={styles.select}
          value={filtros.status}
          onChange={(e) => setFiltro('status', e.target.value)}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          className={styles.select}
          value={filtros.prioridade}
          onChange={(e) => setFiltro('prioridade', e.target.value)}
        >
          <option value="">Todas as prioridades</option>
          {Object.entries(PRIORIDADE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {temFiltros && (
          <button className={styles.clearButton} onClick={limparFiltros}>
            Limpar filtros
          </button>
        )}
      </div>

      {solicitacoes.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>Nenhuma solicitação encontrada</h3>
          <p>
            {temFiltros
              ? 'Tente ajustar os filtros para encontrar o que procura.'
              : 'Ainda não há solicitações registradas no sistema.'}
          </p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Ordem</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {solicitacoes.map((solicitacao) => (
                <tr key={solicitacao.id}>
                  <td className={styles.protocol}>
                    {solicitacao.protocolo}
                  </td>
                  <td>{solicitacao.nome_solicitante}</td>
                  <td>
                    {TIPOS_PROBLEMA[solicitacao.tipo_problema] ||
                      solicitacao.tipo_problema}
                  </td>
                  <td>
                    <StatusBadge status={solicitacao.status_atual} />
                  </td>
                  <td>
                    <PrioridadeBadge prioridade={solicitacao.prioridade} />
                  </td>
                  <td>
                    {solicitacao.ordem_servico_id !== null ? (
                      <span className={styles.ordemBadge}>
                        OS #{solicitacao.ordem_servico_id}
                      </span>
                    ) : (
                      <span className={styles.ordemVazia}>—</span>
                    )}
                  </td>
                  <td className={styles.date}>
                    {formatDate(solicitacao.criado_em)}
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      <button
                        className={styles.editButton}
                        onClick={() => setEditingId(solicitacao.id)}
                      >
                        Alterar
                      </button>
                      {podeGerarOrdem(solicitacao) && (
                        <button
                          className={styles.gerarOrdemButton}
                          onClick={() => setGerandoOrdemPara(solicitacao.id)}
                        >
                          Gerar Ordem
                        </button>
                      )}
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
