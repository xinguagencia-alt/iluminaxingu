import { useState } from 'react'
import { AdminUser, useAdminUsers, UserPayload } from '../../hooks/useAdminUsers'
import { useAuth } from '../../contexts/AuthContext'
import styles from './UserManagement.module.css'

const PERFIS = [
  { value: 'admin', label: 'Administrador', description: 'Gerencia usuarios e acessa todos os modulos.' },
  { value: 'gestor', label: 'Gestor', description: 'Acompanha e opera solicitacoes, ordens, equipes e postes.' },
  { value: 'operador', label: 'Operador', description: 'Atende solicitacoes e ordens de servico.' },
  { value: 'consulta', label: 'Consulta', description: 'Acesso interno para acompanhamento.' },
]

function getPerfilLabel(perfil: string) {
  return PERFIS.find((item) => item.value === perfil)?.label || perfil
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`${styles.toast} ${type === 'error' ? styles.toastError : styles.toastSuccess}`}>
      <span>{message}</span>
      <button className={styles.toastClose} onClick={onClose}>x</button>
    </div>
  )
}

function UserModal({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser | null
  onClose: () => void
  onSave: (payload: UserPayload) => Promise<boolean>
}) {
  const [username, setUsername] = useState(user?.username || '')
  const [nomeCompleto, setNomeCompleto] = useState(user?.nomeCompleto || '')
  const [perfil, setPerfil] = useState(user?.perfil || 'operador')
  const [ativo, setAtivo] = useState(user?.ativo ?? true)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const passwordRequired = !user
  const canSave = username.trim() && nomeCompleto.trim() && (!passwordRequired || password.length >= 6) && (!password || password.length >= 6)

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const payload: UserPayload = {
      username: username.trim(),
      nomeCompleto: nomeCompleto.trim(),
      perfil,
      ativo,
    }
    if (password) payload.password = password
    const success = await onSave(payload)
    setSaving(false)
    if (success) onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>{user ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
        <p className={styles.modalHint}>Somente administradores podem cadastrar ou alterar colaboradores.</p>

        <label className={styles.modalLabel}>Nome completo *</label>
        <input
          className={styles.modalInput}
          value={nomeCompleto}
          onChange={(e) => setNomeCompleto(e.target.value)}
          placeholder="Ex: Maria Silva"
          disabled={saving}
        />

        <label className={styles.modalLabel}>Usuario *</label>
        <input
          className={styles.modalInput}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ex: maria.silva"
          disabled={saving}
        />

        <label className={styles.modalLabel}>{user ? 'Nova senha' : 'Senha *'}</label>
        <input
          className={styles.modalInput}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={user ? 'Deixe em branco para manter' : 'Minimo 6 caracteres'}
          disabled={saving}
        />

        <label className={styles.modalLabel}>Perfil de acesso</label>
        <select className={styles.modalInput} value={perfil} onChange={(e) => setPerfil(e.target.value)} disabled={saving}>
          {PERFIS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <p className={styles.perfilHelp}>{PERFIS.find((item) => item.value === perfil)?.description}</p>

        {user && (
          <label className={styles.checkboxLine}>
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} disabled={saving} />
            Usuario ativo
          </label>
        )}

        <div className={styles.modalActions}>
          <button className={styles.cancelButton} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.saveButton} onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function UserManagement() {
  const { user: currentUser } = useAuth()
  const { users, loading, error, refetch, createUser, updateUser } = useAdminUsers()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleCreate(payload: UserPayload) {
    const success = await createUser(payload)
    showToast(success ? 'Colaborador criado com sucesso!' : 'Erro ao criar colaborador.', success ? 'success' : 'error')
    return success
  }

  async function handleUpdate(payload: UserPayload) {
    if (!editingUser) return false
    const success = await updateUser(editingUser.id, payload)
    showToast(success ? 'Colaborador atualizado com sucesso!' : 'Erro ao atualizar colaborador.', success ? 'success' : 'error')
    return success
  }

  if (currentUser?.perfil !== 'admin') {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h3>Acesso restrito</h3>
          <p>Somente administradores podem gerenciar usuarios do sistema.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Carregando usuarios...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h3>Erro ao carregar usuarios</h3>
          <p>{error}</p>
          <button className={styles.saveButton} onClick={refetch}>Tentar novamente</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {showModal && <UserModal user={null} onClose={() => setShowModal(false)} onSave={handleCreate} />}
      {editingUser && <UserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleUpdate} />}

      <div className={styles.header}>
        <div>
          <h2>Usuarios da Prefeitura</h2>
          <p>Cadastre colaboradores e defina quem pode administrar o sistema.</p>
        </div>
        <button className={styles.addButton} onClick={() => setShowModal(true)}>Novo Colaborador</button>
      </div>

      <div className={styles.cards}>
        {PERFIS.map((perfil) => (
          <div key={perfil.value} className={styles.perfilCard}>
            <strong>{perfil.label}</strong>
            <span>{perfil.description}</span>
          </div>
        ))}
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Usuario</th>
              <th>Perfil</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((adminUser) => (
              <tr key={adminUser.id}>
                <td className={styles.name}>{adminUser.nomeCompleto}</td>
                <td>{adminUser.username}</td>
                <td><span className={styles.badge}>{getPerfilLabel(adminUser.perfil)}</span></td>
                <td>
                  <span className={`${styles.status} ${adminUser.ativo ? styles.statusActive : styles.statusInactive}`}>
                    {adminUser.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <button className={styles.actionButton} onClick={() => setEditingUser(adminUser)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
