import { useState } from 'react'
import { useAdminPostes } from '../../hooks/useAdminPostes'
import styles from './PosteList.module.css'

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR')
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`${styles.toast} ${type === 'error' ? styles.toastError : styles.toastSuccess}`}>
      <span>{message}</span>
      <button className={styles.toastClose} onClick={onClose}>×</button>
    </div>
  )
}

interface PosteListProps {
  onNovoPoste: () => void
}

export function PosteList({ onNovoPoste }: PosteListProps) {
  const { postes, loading, error, busca, setBusca, bairroFiltro, setBairroFiltro, bairrosDisponiveis, ruaFiltro, setRuaFiltro, ruasDisponiveis, refetch, excluir } = useAdminPostes()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleExcluir(id: number, codigo: string) {
    if (!window.confirm(`Tem certeza que deseja excluir o poste ${codigo}?`)) return

    const success = await excluir(id)
    if (success) {
      showToast('Poste excluido com sucesso!', 'success')
    } else {
      showToast('Erro ao excluir poste.', 'error')
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Carregando postes...</p>
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

      <div className={styles.header}>
        <h2>Postes</h2>
        <span className={styles.count}>
          {bairroFiltro || ruaFiltro
            ? `${postes.length} registro(s)${bairroFiltro ? ` em "${bairroFiltro}"` : ''}${ruaFiltro ? ` na "${ruaFiltro}"` : ''}`
            : `${postes.length} registro(s)`}
        </span>
      </div>

      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar por codigo, rua ou bairro..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className={styles.bairroSelect}
          value={bairroFiltro}
          onChange={(e) => setBairroFiltro(e.target.value)}
        >
          <option value="">Todos os bairros</option>
          {bairrosDisponiveis.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          className={styles.bairroSelect}
          value={ruaFiltro}
          onChange={(e) => setRuaFiltro(e.target.value)}
        >
          <option value="">Todas as ruas</option>
          {ruasDisponiveis.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {(bairroFiltro || ruaFiltro) && (
          <button
            className={styles.clearFilterButton}
            onClick={() => {
              setBairroFiltro('')
              setRuaFiltro('')
            }}
          >
            Limpar filtro
          </button>
        )}
        <button className={styles.addButton} onClick={onNovoPoste}>
          Novo Poste
        </button>
      </div>

      {postes.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>Nenhum poste encontrado</h3>
          <p>
            {busca
              ? 'Tente ajustar a busca para encontrar o que procura.'
              : 'Ainda nao ha postes cadastrados no sistema.'}
          </p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Rua</th>
                <th>Numero</th>
                <th>Bairro</th>
                <th>Localizacao</th>
                <th>Luminaria</th>
                <th>Potencia</th>
                <th>Instalacao</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {postes.map((poste) => (
                <tr key={poste.id}>
                  <td className={styles.codigo}>{poste.codigo}</td>
                  <td>{poste.rua || '-'}</td>
                  <td>{poste.numero || '-'}</td>
                  <td>{poste.bairro || 'Sem bairro informado'}</td>
                  <td className={styles.location}>
                    {poste.latitude !== null && poste.longitude !== null
                      ? `${poste.latitude.toFixed(6)}, ${poste.longitude.toFixed(6)}`
                      : '-'}
                  </td>
                  <td>{poste.tipo_luminaria || '-'}</td>
                  <td>{poste.potencia ? `${poste.potencia}W` : '-'}</td>
                  <td>{formatDate(poste.data_instalacao)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                        onClick={() => handleExcluir(poste.id, poste.codigo)}
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