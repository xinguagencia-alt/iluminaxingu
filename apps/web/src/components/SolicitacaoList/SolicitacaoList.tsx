import { useState } from 'react'
import { useSolicitacoes } from './useSolicitacoes'
import { useEquipes } from '../../hooks/useEquipes'
import { useAuth } from '../../contexts/AuthContext'
import { API_URL } from '../../config/api'
import {
  Solicitacao,
  StatusSolicitacao,
  PrioridadeSolicitacao,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  STATUS_SLA_LABELS,
  STATUS_SLA_COLORS,
  TIPOS_PROBLEMA,
  type StatusSla,
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
      className={`${styles.badge} ${prioridade === 'urgente' ? styles.badgeUrgente : ''}`}
      style={{
        backgroundColor: PRIORIDADE_COLORS[prioridade],
        color: 'white',
      }}
    >
      {PRIORIDADE_LABELS[prioridade]}
    </span>
  )
}

function SlaBadge({ statusSla, prazoSla }: { statusSla: StatusSla; prazoSla: string }) {
  const prazoFormatado = new Date(prazoSla).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <span
      className={`${styles.badge} ${statusSla === 'atrasada' ? styles.badgeAtrasada : ''}`}
      style={{
        backgroundColor: STATUS_SLA_COLORS[statusSla],
        color: 'white',
      }}
      title={`Prazo: ${prazoFormatado}`}
    >
      {STATUS_SLA_LABELS[statusSla]}
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

  const { token } = useAuth()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [gerandoOrdemPara, setGerandoOrdemPara] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const temFiltros = filtros.status || filtros.prioridade || filtros.busca || filtros.status_sla

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function podeGerarOrdem(solicitacao: Solicitacao): boolean {
    if (solicitacao.ordem_servico_id !== null) return false
    if (['concluida', 'cancelada', 'nao_procedente', 'duplicada'].includes(solicitacao.status_atual)) return false
    return true
  }

  function statusFechado(status: string): boolean {
    return ['concluida', 'cancelada', 'nao_procedente', 'duplicada'].includes(status)
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

  async function handleWhatsApp(solicitacao: Solicitacao) {
    const tipo = solicitacao.status_atual === 'concluida' ? 'concluida' : 'status'

    try {
      const response = await fetch(
        `${API_URL}/api/solicitacoes/${solicitacao.id}/mensagem-whatsapp?tipo=${tipo}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!response.ok) {
        showToast('Erro ao gerar mensagem.', 'error')
        return
      }

      const data = await response.json()

      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, '_blank')
      } else {
        try {
          await navigator.clipboard.writeText(data.mensagem)
        } catch {
          const textarea = document.createElement('textarea')
          textarea.value = data.mensagem
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }
        showToast('Telefone invalido. Mensagem copiada para a area de transferencia.', 'success')
      }
    } catch {
      showToast('Erro ao conectar com o servidor.', 'error')
    }
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

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>Central de atendimento</span>
          <h2>Solicitações registradas</h2>
          <p>Filtre, acompanhe prioridades, atualize status e gere ordens de serviço a partir do painel operacional.</p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <strong>{solicitacoes.length}</strong>
            <span>registro(s)</span>
          </div>
          <div className={styles.heroStat}>
            <strong>{solicitacoes.filter((s) => !statusFechado(s.status_atual)).length}</strong>
            <span>em acompanhamento</span>
          </div>
          <div className={styles.heroStat}>
            <strong style={{ color: '#dc2626' }}>{solicitacoes.filter((s) => s.status_sla === 'atrasada').length}</strong>
            <span>atrasadas</span>
          </div>
          <div className={styles.heroStat}>
            <strong style={{ color: '#d97706' }}>{solicitacoes.filter((s) => s.status_sla === 'vence_hoje').length}</strong>
            <span>vence hoje</span>
          </div>
        </div>
      </section>

      <div className={styles.filtersCard}>
        <div className={styles.filtersHeader}>
          <div>
            <h3>Filtros da operação</h3>
            <span className={styles.count}>{solicitacoes.length} registro(s) visiveis</span>
          </div>
        </div>

        <div className={styles.filters}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar por protocolo, nome ou telefone..."
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

        <select
          className={styles.select}
          value={filtros.status_sla}
          onChange={(e) => setFiltro('status_sla', e.target.value)}
        >
          <option value="">Todos os SLA</option>
          {Object.entries(STATUS_SLA_LABELS).map(([value, label]) => (
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
          <div className={styles.tableHint}>No celular, deslize a tabela para o lado para ver todas as colunas.</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>SLA</th>
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
                    {solicitacao.auto_identificado && (
                      <span
                        title="Poste identificado automaticamente por GPS"
                        style={{
                          display: 'inline-block',
                          marginLeft: 4,
                          padding: '1px 5px',
                          fontSize: '0.7rem',
                          backgroundColor: '#7c3aed',
                          color: 'white',
                          borderRadius: 4,
                          verticalAlign: 'middle',
                        }}
                      >
                        GPS
                      </span>
                    )}
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
                    <SlaBadge statusSla={solicitacao.status_sla} prazoSla={solicitacao.prazo_sla} />
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
                      {!statusFechado(solicitacao.status_atual) && (
                        <button
                          className={styles.editButton}
                          onClick={() => setEditingId(solicitacao.id)}
                        >
Atualizar status
                        </button>
                      )}
                      {podeGerarOrdem(solicitacao) && (
                        <button
                          className={styles.gerarOrdemButton}
                          onClick={() => setGerandoOrdemPara(solicitacao.id)}
                        >
 Gerar OS
                        </button>
                      )}
                      <button
                        className={styles.whatsappButton}
                        onClick={() => handleWhatsApp(solicitacao)}
                        title="Enviar mensagem via WhatsApp"
                      >
WhatsApp
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
