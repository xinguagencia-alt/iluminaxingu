import { useState, useMemo } from 'react'
import { useBairros } from '../../hooks/useBairros'
import { useRuas } from '../../hooks/useRuas'
import { useLocalidades } from '../../hooks/useLocalidades'
import { useAuth } from '../../contexts/AuthContext'
import { API_URL } from '../../config/api'
import styles from './LogradouroManager.module.css'

type Tab = 'bairros' | 'avenidas' | 'ruas' | 'distritos' | 'vilas'

const CORES_DISPONIVEIS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#ff9800',
  '#8bc34a', '#673ab7', '#795548', '#607d8b', '#f44336',
]

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`${styles.toast} ${type === 'error' ? styles.toastError : styles.toastSuccess}`}>
      <span>{message}</span>
      <button className={styles.toastClose} onClick={onClose}>×</button>
    </div>
  )
}

export function LogradouroManager() {
  const { token } = useAuth()
  const { bairros, loading: loadingBairros, criarBairro, excluirBairro, refetch: refetchBairros } = useBairros()
  const { avenidas, ruas, loading: loadingRuas, criarRua, excluirRua } = useRuas()
  const { localidades, loading: loadingLocalidades, criarLocalidade, atualizarLocalidade, desativarLocalidade } = useLocalidades()

  const [tab, setTab] = useState<Tab>('bairros')
  const [busca, setBusca] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState(CORES_DISPONIVEIS[0])
  const [editingCor, setEditingCor] = useState<{ id: number; nome: string; cor: string } | null>(null)
  const [editingLocalidade, setEditingLocalidade] = useState<{ id: number; nome: string; tipo: 'distrito' | 'vila'; ativo: boolean } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const distritos = localidades.filter((l) => l.tipo === 'distrito' && l.ativo)
  const vilas = localidades.filter((l) => l.tipo === 'vila' && l.ativo)

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

  const distritosFiltrados = useMemo(() => {
    if (!busca) return distritos
    const termo = busca.toLowerCase()
    return distritos.filter((d) => d.nome.toLowerCase().includes(termo))
  }, [distritos, busca])

  const vilasFiltradas = useMemo(() => {
    if (!busca) return vilas
    const termo = busca.toLowerCase()
    return vilas.filter((v) => v.nome.toLowerCase().includes(termo))
  }, [vilas, busca])

  const loading = loadingBairros || loadingRuas || loadingLocalidades

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return

    setSalvando(true)
    try {
      if (tab === 'bairros') {
        const result = await criarBairro(novoNome.trim(), novaCor)
        if (!result.ok) {
          showToast(result.erro || 'Erro ao cadastrar bairro', 'error')
          return
        }
        showToast('Bairro cadastrado com sucesso!', 'success')
      } else if (tab === 'avenidas' || tab === 'ruas') {
        const tipo = tab === 'avenidas' ? 'avenida' : 'rua'
        const result = await criarRua(novoNome.trim(), tipo)
        if (!result.ok) {
          showToast(result.erro || 'Erro ao cadastrar rua/avenida', 'error')
          return
        }
        showToast(`${tipo === 'avenida' ? 'Avenida' : 'Rua'} cadastrada com sucesso!`, 'success')
      } else {
        const tipo = tab === 'distritos' ? 'distrito' : 'vila'
        const result = await criarLocalidade(novoNome.trim(), tipo)
        if (!result.ok) {
          showToast(result.erro || 'Erro ao cadastrar localidade', 'error')
          return
        }
        showToast(`${tipo === 'distrito' ? 'Distrito' : 'Vila'} cadastrad${tipo === 'distrito' ? 'o' : 'a'} com sucesso!`, 'success')
      }
      setNovoNome('')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(id: number, nome: string) {
    const tipoLabel = tab === 'bairros' ? 'bairro' : tab === 'avenidas' ? 'avenida' : tab === 'ruas' ? 'rua' : tab === 'distritos' ? 'distrito' : 'vila'
    if (!window.confirm(`Tem certeza que deseja desativar o ${tipoLabel} "${nome}"?`)) return

    try {
      if (tab === 'bairros') {
        const result = await excluirBairro(id)
        if (!result.ok) {
          showToast(result.erro || 'Erro ao excluir bairro', 'error')
          return
        }
      } else if (tab === 'avenidas' || tab === 'ruas') {
        const result = await excluirRua(id)
        if (!result.ok) {
          showToast(result.erro || 'Erro ao excluir rua/avenida', 'error')
          return
        }
      } else {
        const result = await desativarLocalidade(id)
        if (!result.ok) {
          showToast(result.erro || 'Erro ao desativar localidade', 'error')
          return
        }
      }
      showToast(`${tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} desativad${tipoLabel === 'rua' ? 'a' : 'o'} com sucesso!`, 'success')
    } catch {
      showToast('Erro ao desativar item', 'error')
    }
  }

  function handleTabChange(newTab: Tab) {
    setTab(newTab)
    setBusca('')
    setNovoNome('')
  }

  async function handleUpdateCor(id: number, cor: string) {
    try {
      const response = await fetch(`${API_URL}/api/bairros/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cor }),
      })
      if (!response.ok) throw new Error('Erro ao atualizar cor')
      setEditingCor(null)
      showToast('Cor do bairro atualizada!', 'success')
      refetchBairros()
    } catch {
      showToast('Erro ao atualizar cor do bairro', 'error')
    }
  }

  async function handleToggleLocalidadeAtivo(id: number, ativo: boolean) {
    try {
      const result = await atualizarLocalidade(id, { ativo })
      if (!result.ok) {
        showToast(result.erro || 'Erro ao atualizar localidade', 'error')
        return
      }
      showToast(`Localidade ${ativo ? 'ativada' : 'desativada'} com sucesso!`, 'success')
      setEditingLocalidade(null)
    } catch {
      showToast('Erro ao atualizar localidade', 'error')
    }
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
        <p className={styles.subtitle}>Gerenciar bairros, avenidas, ruas, distritos e vilas de Sao Felix do Xingu</p>
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
        <button
          className={`${styles.tab} ${tab === 'distritos' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('distritos')}
        >
          Distritos
          <span className={styles.tabCount}>{distritos.length}</span>
        </button>
        <button
          className={`${styles.tab} ${tab === 'vilas' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('vilas')}
        >
          Vilas
          <span className={styles.tabCount}>{vilas.length}</span>
        </button>
      </div>

      <div className={styles.content}>
        <form className={styles.addForm} onSubmit={handleAdicionar}>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <input
              type="text"
              className={styles.addInput}
              placeholder={
                tab === 'bairros' ? 'Nome do novo bairro...' :
                tab === 'avenidas' ? 'Nome da nova avenida...' :
                tab === 'ruas' ? 'Nome da nova rua...' :
                tab === 'distritos' ? 'Nome do novo distrito...' :
                'Nome da nova vila...'
              }
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              disabled={salvando}
              style={{ flex: 1 }}
            />
            {tab === 'bairros' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="color"
                  value={novaCor}
                  onChange={(e) => setNovaCor(e.target.value)}
                  style={{ width: 36, height: 36, padding: 0, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}
                  title="Cor do bairro"
                />
              </div>
            )}
            <button
              type="submit"
              className={styles.addButton}
              disabled={salvando || !novoNome.trim()}
            >
              {salvando ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>

        <div className={styles.searchWrapper}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={`Buscar ${tab === 'bairros' ? 'bairro' : tab === 'avenidas' ? 'avenida' : tab === 'ruas' ? 'rua' : tab === 'distritos' ? 'distrito' : 'vila'}...`}
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
                  <span
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: b.cor || '#9ca3af', flexShrink: 0,
                      border: '2px solid rgba(0,0,0,0.1)',
                    }}
                  />
                  <span className={styles.itemNome}>{b.nome}</span>
                  <button
                    className={styles.editButton}
                    onClick={() => setEditingCor({
                      id: b.id,
                      nome: b.nome,
                      cor: b.cor || CORES_DISPONIVEIS[0],
                    })}
                    title="Alterar cor"
                  >
                    Cor
                  </button>
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

          {tab === 'distritos' && (
            distritosFiltrados.length === 0 ? (
              <div className={styles.empty}>
                {busca ? 'Nenhum distrito encontrado para essa busca.' : 'Nenhum distrito cadastrado.'}
              </div>
            ) : (
              distritosFiltrados.map((d) => (
                <div key={d.id} className={styles.listItem}>
                  <span className={styles.itemNome}>{d.nome}</span>
                  <button
                    className={styles.editButton}
                    onClick={() => setEditingLocalidade({
                      id: d.id,
                      nome: d.nome,
                      tipo: d.tipo as 'distrito' | 'vila',
                      ativo: d.ativo,
                    })}
                    title="Editar"
                  >
                    Editar
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleExcluir(d.id, d.nome)}
                  >
                    Desativar
                  </button>
                </div>
              ))
            )
          )}

          {tab === 'vilas' && (
            vilasFiltradas.length === 0 ? (
              <div className={styles.empty}>
                {busca ? 'Nenhuma vila encontrada para essa busca.' : 'Nenhuma vila cadastrada.'}
              </div>
            ) : (
              vilasFiltradas.map((v) => (
                <div key={v.id} className={styles.listItem}>
                  <span className={styles.itemNome}>{v.nome}</span>
                  <button
                    className={styles.editButton}
                    onClick={() => setEditingLocalidade({
                      id: v.id,
                      nome: v.nome,
                      tipo: v.tipo as 'distrito' | 'vila',
                      ativo: v.ativo,
                    })}
                    title="Editar"
                  >
                    Editar
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleExcluir(v.id, v.nome)}
                  >
                    Desativar
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
          {tab === 'distritos' && (
            <span>{distritosFiltrados.length} de {distritos.length} distrito(s)</span>
          )}
          {tab === 'vilas' && (
            <span>{vilasFiltradas.length} de {vilas.length} vila(s)</span>
          )}
        </div>
      </div>

      {editingCor && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setEditingCor(null)}
        >
          <div
            style={{
              background: 'white', borderRadius: 12, padding: 24, maxWidth: 360, width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', color: '#1e293b' }}>
              Cor do bairro
            </h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.9rem' }}>
              {editingCor.nome}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {CORES_DISPONIVEIS.map((c) => (
                <button
                  key={c}
                  onClick={() => setEditingCor({ ...editingCor, cor: c })}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', background: c,
                    border: editingCor.cor === c ? '3px solid #1e293b' : '2px solid rgba(0,0,0,0.1)',
                    cursor: 'pointer', transition: 'border 0.15s',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setEditingCor(null)}
                style={{
                  padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
                  background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateCor(editingCor.id, editingCor.cor)}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 8,
                  background: '#f59e0b', color: 'white', cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLocalidade && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setEditingLocalidade(null)}
        >
          <div
            style={{
              background: 'white', borderRadius: 12, padding: 24, maxWidth: 360, width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', color: '#1e293b' }}>
              {editingLocalidade.tipo === 'distrito' ? 'Distrito' : 'Vila'}
            </h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.9rem' }}>
              {editingLocalidade.nome}
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editingLocalidade.ativo}
                onChange={(e) => setEditingLocalidade({ ...editingLocalidade, ativo: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: '#f59e0b' }}
              />
              <span style={{ color: '#1e293b', fontSize: '0.95rem' }}>
                {editingLocalidade.ativo ? 'Ativo' : 'Desativado'}
              </span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setEditingLocalidade(null)}
                style={{
                  padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8,
                  background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleToggleLocalidadeAtivo(editingLocalidade.id, editingLocalidade.ativo)}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: 8,
                  background: '#f59e0b', color: 'white', cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
