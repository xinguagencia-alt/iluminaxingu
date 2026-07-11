import { useMemo, useState } from 'react'
import { usePostesReparados } from './usePostesReparados'
import { useEquipes } from '../../hooks/useEquipes'
import styles from './PostesReparadosList.module.css'

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

export function PostesReparadosList() {
  const { postes, loading, error, refetch } = usePostesReparados()
  const { equipes } = useEquipes()
  const [filtroEquipe, setFiltroEquipe] = useState<'' | number>('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const postesFiltrados = useMemo(() => {
    let filtrados = postes
    if (filtroEquipe !== '') {
      filtrados = filtrados.filter((p) => {
        const equipe = equipes.find((e) => e.id === filtroEquipe)
        return equipe && p.equipe_nome === equipe.nome
      })
    }
    return filtrados
  }, [filtroEquipe, postes, equipes])

  function handleFiltrar() {
    refetch({
      equipe_id: filtroEquipe !== '' ? filtroEquipe : undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
    })
  }

  function handleLimparFiltros() {
    setFiltroEquipe('')
    setDataInicio('')
    setDataFim('')
    refetch()
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Carregando postes reparados...</p>
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
          <button className={styles.retryButton} onClick={() => refetch()}>
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>Relatorio operacional</span>
          <h2>Postes reparados por equipe</h2>
          <p>Consulte quais equipes realizaram reparos, o poste atendido e os detalhes da ordem de servico.</p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <strong>{postesFiltrados.length}</strong>
            <span>reparos encontrados</span>
          </div>
          <div className={styles.heroStat}>
            <strong>{new Set(postesFiltrados.map((p) => p.equipe_nome)).size}</strong>
            <span>equipes ativas</span>
          </div>
        </div>
      </section>

      <div className={styles.filtersCard}>
        <div className={styles.filtersHeader}>
          <div>
            <h3>Filtros</h3>
            <span className={styles.count}>{postesFiltrados.length} registro(s)</span>
          </div>
        </div>

        <div className={styles.filters}>
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
          <input
            type="date"
            className={styles.select}
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            placeholder="Data inicio"
          />
          <input
            type="date"
            className={styles.select}
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            placeholder="Data fim"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className={styles.retryButton} onClick={handleFiltrar}>
            Filtrar
          </button>
          <button
            className={styles.retryButton}
            onClick={handleLimparFiltros}
            style={{ background: '#e2e8f0', color: '#0f172a' }}
          >
            Limpar
          </button>
        </div>
      </div>

      {postesFiltrados.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>Nenhum reparo encontrado</h3>
          <p>Nao ha registros de postes reparados para os filtros atuais.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <div className={styles.tableHint}>No celular, deslize a tabela para o lado para acompanhar todos os campos.</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Equipe</th>
                <th>Poste</th>
                <th>Endereco</th>
                <th>Bairro</th>
                <th>OS</th>
                <th>Abertura</th>
                <th>Execucao</th>
                <th>Encerramento</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {postesFiltrados.map((item, index) => (
                <tr key={`${item.ordem_servico_id}-${index}`}>
                  <td>{item.equipe_nome}</td>
                  <td className={styles.posteCode}>{item.poste_codigo || '-'}</td>
                  <td>{item.poste_endereco || item.poste_rua ? `${item.poste_rua || ''}${item.poste_numero ? ', ' + item.poste_numero : ''}` : '-'}</td>
                  <td>{item.poste_bairro || '-'}</td>
                  <td>#{item.ordem_servico_id}</td>
                  <td>{formatDate(item.data_abertura)}</td>
                  <td>{formatDate(item.data_execucao)}</td>
                  <td>{formatDate(item.data_encerramento)}</td>
                  <td>{item.os_resultado || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
