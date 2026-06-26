import { useState } from 'react'
import { useEquipes, type Equipe } from '../../hooks/useEquipes'
import styles from './EquipeList.module.css'

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`${styles.toast} ${type === 'error' ? styles.toastError : styles.toastSuccess}`}>
      <span>{message}</span>
      <button className={styles.toastClose} onClick={onClose}>×</button>
    </div>
  )
}

function EquipeModal({
  equipe,
  onClose,
  onSave,
}: {
  equipe: Equipe | null
  onClose: () => void
  onSave: (dados: { nome: string; descricao?: string; responsavel?: string }) => Promise<boolean>
}) {
  const [nome, setNome] = useState(equipe?.nome || '')
  const [descricao, setDescricao] = useState(equipe?.descricao || '')
  const [responsavel, setResponsavel] = useState(equipe?.responsavel || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!nome.trim()) return
    setSaving(true)
    const success = await onSave({
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      responsavel: responsavel.trim() || undefined,
    })
    setSaving(false)
    if (success) onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>{equipe ? 'Editar Equipe' : 'Nova Equipe'}</h3>

        <label className={styles.modalLabel}>Nome *</label>
        <input
          className={styles.modalInput}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da equipe"
          disabled={saving}
        />

        <label className={styles.modalLabel}>Responsavel</label>
        <input
          className={styles.modalInput}
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          placeholder="Nome do responsavel"
          disabled={saving}
        />

        <label className={styles.modalLabel}>Descricao</label>
        <textarea
          className={styles.modalTextarea}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          placeholder="Descricao da equipe"
          disabled={saving}
        />

        <div className={styles.modalActions}>
          <button className={styles.modalCancelButton} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className={styles.modalConfirmButton}
            onClick={handleSave}
            disabled={saving || !nome.trim()}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function EquipeList() {
  const { equipes, loading, error, refetch, criar, atualizar, excluir } = useEquipes()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingEquipe, setEditingEquipe] = useState<Equipe | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleCreate(dados: { nome: string; descricao?: string; responsavel?: string }) {
    const success = await criar(dados)
    if (success) {
      showToast('Equipe criada com sucesso!', 'success')
    } else {
      showToast('Erro ao criar equipe.', 'error')
    }
    return success
  }

  async function handleUpdate(dados: { nome: string; descricao?: string; responsavel?: string }) {
    if (!editingEquipe) return false
    const success = await atualizar(editingEquipe.id, dados)
    if (success) {
      showToast('Equipe atualizada com sucesso!', 'success')
    } else {
      showToast('Erro ao atualizar equipe.', 'error')
    }
    return success
  }

  async function handleDelete(id: number, nome: string) {
    if (!window.confirm(`Tem certeza que deseja excluir a equipe "${nome}"?`)) return

    const success = await excluir(id)
    if (success) {
      showToast('Equipe excluida com sucesso!', 'success')
    } else {
      showToast('Erro ao excluir equipe.', 'error')
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Carregando equipes...</p>
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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showModal && (
        <EquipeModal
          equipe={null}
          onClose={() => setShowModal(false)}
          onSave={handleCreate}
        />
      )}

      {editingEquipe && (
        <EquipeModal
          equipe={editingEquipe}
          onClose={() => setEditingEquipe(null)}
          onSave={handleUpdate}
        />
      )}

      <div className={styles.header}>
        <h2>Equipes</h2>
        <span className={styles.count}>{equipes.length} registro(s)</span>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.addButton} onClick={() => setShowModal(true)}>
          Nova Equipe
        </button>
      </div>

      {equipes.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>Nenhuma equipe encontrada</h3>
          <p>Clique em "Nova Equipe" para cadastrar a primeira equipe.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Responsavel</th>
                <th>Descricao</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equipes.map((equipe) => (
                <tr key={equipe.id}>
                  <td className={styles.nome}>{equipe.nome}</td>
                  <td>{equipe.responsavel || '-'}</td>
                  <td>{equipe.descricao || '-'}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.actionButton}
                        onClick={() => setEditingEquipe(equipe)}
                      >
                        Editar
                      </button>
                      <button
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                        onClick={() => handleDelete(equipe.id, equipe.nome)}
                      >
                        Excluir
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