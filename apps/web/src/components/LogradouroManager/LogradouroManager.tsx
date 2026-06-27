import { useState, useMemo } from 'react'
import { useBairros } from '../../hooks/useBairros'
import { useRuas } from '../../hooks/useRuas'
import styles from './LogradouroManager.module.css'

type Tab = 'bairros' | 'avenidas' | 'ruas'

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`${styles.toast} ${type === 'error' ? styles.toastError : styles.toastSuccess}`}>
      <span>{message}</span>
      <button className={styles.toastClose} onClick={onClose}>×</button>
    </div>
  )
}

export function LogradouroManager() {
  const { bairros, loading: loadingBairros, criarBairro, excluirBairro } = useBairros()
  const { avenidas, ruas, loading: loadingRuas, criarRua, excluirRua } = useRuas()

  const [tab, setTab] = useState<Tab>('bairros')
  const [busca, setBusca] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const bairrosFiltrados = useMemo(() => {
    if (!busca) return bairros
    const termo = busca.toLowerCase()
    return bairros.filter((b) => b.nome.toLowerCase().includes(termo))
  }, [bairros, busca])

  const avenidasFiltradas = useMemo(() => {
    if (!busca) return avenidas
    const termo = busca.toLowerCase()
    return avenidas.filter((a) => a.nome.toLowerCase().includes(termo))
  }, [avenidas, busca])

  const ruasFiltradas = useMemo(() => {
    if (!busca) return ruas
    const termo = busca.toLowerCase()
    return ruas.filter((r) => r.nome.toLowerCase().includes(termo))
  }, [ruas, busca])

  const loading = loadingBairros || loadingRuas

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return

    setSalvando(true)
    try {
      if (tab === 'bairros') {
        const result = await criarBairro(novoNome.trim())
        if (!result.ok) {
          showToast(result.erro || 'Erro ao cadastrar bairro', 'error')
          return
        }
        showToast('Bairro cadastrado com sucesso!', 'success')
      } else {
        const tipo = tab === 'avenidas' ? 'avenida' : 'rua'
        const result = await criarRua(novoNome.trim(), tipo)
        if (!result.ok) {
          showToast(result.erro || 'Erro ao cadastrar rua/avenida', 'error')
          return
        }
        showToast(`${tipo === 'avenida' ? 'Avenida' : 'Rua'} cadastrada com sucesso!`, 'success')
      }
      setNovoNome('')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id: number, nome: string) {
    const tipoLabel = tab === 'bairros' ? 'bairro' : tab === 'avenidas' ? 'avenida' : 'rua'
    if (!window.confirm(`Tem certeza que deseja excluir o ${tipoLabel} "${nome}"?`)) return

    try {
      if (tab === 'bairros') {
        const result = await excluirBairro(id)
        if (!result.ok) {
          showToast(result.erro || 'Erro ao excluir bairro', 'error')
          return
        }
      } else {
        const result = await excluirRua(id)
        if (!result.ok) {
          showToast(result.erro || 'Erro ao excluir rua/avenida', 'error')
          return
        }
      }
      showToast(`${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} excluido(a) com sucesso!`, 'success')
    } catch {
      showToast('Erro ao excluir item', 'error')
    }
  }

  function handleTabChange(newTab: Tab) {
    setTab(newTab)
    setBusca('')
    setNovoNome('')
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Carregando logradouros...</p>
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
        <h2>Logradouros</h2>
        <p className={styles.subtitle}>Gerenciar bairros, avenidas e ruas de Sao Felix do Xingu</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'bairros' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('bairros')}
        >
          Bairros
          <span className={styles.tabCount}>{bairros.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === 'avenidas' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('avenidas')}
        >
          Avenidas
          <span className={styles.tabCount}>{avenidas.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === 'ruas' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('ruas')}
        >
          Ruas
          <span className={styles.tabCount}>{ruas.length}</span>
        </button>
      </div>

      <div className={styles.content}>
        <form className={styles.addForm} onSubmit={handleAdicionar}>
          <input
            type="text"
            className={styles.addInput}
            placeholder={
              tab === 'bairros' ? 'Nome do novo bairro...' :
              tab === 'avenidas' ? 'Nome da nova avenida...' :
              'Nome da nova rua...'
            }
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            disabled={salvando}
          />
          <button
            type="submit"
            className={styles.addButton}
            disabled={salvando || !novoNome.trim()}
          >
            {salvando ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>

        <div className={styles.searchWrapper}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={`Buscar ${tab === 'bairros' ? 'bairro' : tab === 'avenidas' ? 'avenida' : 'rua'}...`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button className={styles.clearSearch} onClick={() => setBusca('')}>
              Limpar
            </button>
          )}
        </div>

        <div className={styles.list}>
          {tab === 'bairros' && (
            bairrosFiltrados.length === 0 ? (
              <div className={styles.empty}>
                {busca ? 'Nenhum bairro encontrado para essa busca.' : 'Nenhum bairro cadastrado.'}
              </div>
            ) : (
              bairrosFiltrados.map((b) => (
                <div key={b.id} className={styles.listItem}>
                  <span className={styles.itemNome}>{b.nome}</span>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleExcluir(b.id, b.nome)}
                  >
                    Excluir
                  </button>
                </div>
              ))
            )
          )}

          {tab === 'avenidas' && (
            avenidasFiltradas.length === 0 ? (
              <div className={styles.empty}>
                {busca ? 'Nenhuma avenida encontrada para essa busca.' : 'Nenhuma avenida cadastrada.'}
              </div>
            ) : (
              avenidasFiltradas.map((a) => (
                <div key={a.id} className={styles.listItem}>
                  <span className={styles.itemNome}>{a.nome}</span>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleExcluir(a.id, a.nome)}
                  >
                    Excluir
                  </button>
                </div>
              ))
            )
          )}

          {tab === 'ruas' && (
            ruasFiltradas.length === 0 ? (
              <div className={styles.empty}>
                {busca ? 'Nenhuma rua encontrada para essa busca.' : 'Nenhuma rua cadastrada.'}
              </div>
            ) : (
              ruasFiltradas.map((r) => (
                <div key={r.id} className={styles.listItem}>
                  <span className={styles.itemNome}>{r.nome}</span>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleExcluir(r.id, r.nome)}
                  >
                    Excluir
                  </button>
                </div>
              ))
            )
          )}
        </div>

        <div className={styles.footer}>
          {tab === 'bairros' && (
            <span>{bairrosFiltrados.length} de {bairros.length} bairro(s)</span>
          )}
          {tab === 'avenidas' && (
            <span>{avenidasFiltradas.length} de {avenidas.length} avenida(s)</span>
          )}
          {tab === 'ruas' && (
            <span>{ruasFiltradas.length} de {ruas.length} rua(s)</span>
          )}
        </div>
      </div>
    </div>
  )
}
