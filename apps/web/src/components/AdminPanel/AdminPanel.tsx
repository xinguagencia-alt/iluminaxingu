import { useState } from 'react'
import { useAuditoria } from '../../hooks/useAuditoria'
import { useExport } from '../../hooks/useExport'
import styles from './AdminPanel.module.css'

type Tab = 'auditoria' | 'exportar'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const TABELAS_LABELS: Record<string, string> = {
  postes: 'Postes',
  bairros: 'Bairros',
  ruas: 'Ruas/Avenidas',
  solicitacoes: 'Solicitacoes',
  ordens_servico: 'Ordens de Servico',
  equipes: 'Equipes',
}

const ACOES_LABELS: Record<string, string> = {
  criar: 'Criou',
  editar: 'Editou',
  excluir: 'Excluiu',
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`${styles.toast} ${type === 'error' ? styles.toastError : styles.toastSuccess}`}>
      <span>{message}</span>
      <button className={styles.toastClose} onClick={onClose}>×</button>
    </div>
  )
}

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('auditoria')
  const { logs, total, loading: loadingLogs, error: errorLogs, refetch, carregarMais } = useAuditoria()
  const { summary, loadingSummary, exportando, error: errorExport, fetchSummary, exportar } = useExport()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleExportar(tabela: string) {
    const ok = await exportar(tabela)
    if (ok) {
      showToast(`${TABELAS_LABELS[tabela] || tabela} exportado com sucesso!`, 'success')
    } else {
      showToast('Erro ao exportar dados', 'error')
    }
  }

  return (
    <div className={styles.container}>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className={styles.header}>
        <h2>Painel Administrativo</h2>
        <p className={styles.subtitle}>Auditoria, exportacao e gerenciamento do sistema</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'auditoria' ? styles.tabActive : ''}`}
          onClick={() => setTab('auditoria')}
        >
          Auditoria
        </button>
        <button
          className={`${styles.tab} ${tab === 'exportar' ? styles.tabActive : ''}`}
          onClick={() => {
            setTab('exportar')
            fetchSummary()
          }}
        >
          Exportar Dados
        </button>
      </div>

      <div className={styles.content}>
        {tab === 'auditoria' && (
          <div>
            <div className={styles.auditHeader}>
              <span className={styles.auditCount}>{total} registro(s) de auditoria</span>
              <button className={styles.refreshButton} onClick={refetch} disabled={loadingLogs}>
                Atualizar
              </button>
            </div>

            {errorLogs && <p className={styles.error}>{errorLogs}</p>}

            {loadingLogs && logs.length === 0 ? (
              <div className={styles.loading}>Carregando registros...</div>
            ) : logs.length === 0 ? (
              <div className={styles.empty}>Nenhum registro de auditoria encontrado.</div>
            ) : (
              <>
                <div className={styles.auditList}>
                  {logs.map((log) => (
                    <div key={log.id} className={styles.auditItem}>
                      <div className={styles.auditItemHeader}>
                        <span className={`${styles.acaoBadge} ${styles[`acao_${log.acao}`]}`}>
                          {ACOES_LABELS[log.acao] || log.acao}
                        </span>
                        <span className={styles.tabelaBadge}>{TABELAS_LABELS[log.tabela] || log.tabela}</span>
                        <span className={styles.auditDate}>{formatDate(log.criado_em)}</span>
                      </div>
                      <div className={styles.auditItemBody}>
                        <span className={styles.auditUser}>
                          {log.usuario_nome || 'Sistema'}
                        </span>
                        {log.registro_id && (
                          <span className={styles.auditId}>ID: {log.registro_id}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {logs.length < total && (
                  <button
                    className={styles.loadMoreButton}
                    onClick={carregarMais}
                    disabled={loadingLogs}
                  >
                    {loadingLogs ? 'Carregando...' : 'Carregar mais'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'exportar' && (
          <div>
            {errorExport && <p className={styles.error}>{errorExport}</p>}

            {loadingSummary ? (
              <div className={styles.loading}>Carregando resumo...</div>
            ) : summary ? (
              <div className={styles.exportGrid}>
                {Object.entries(TABELAS_LABELS).map(([tabela, label]) => (
                  <div key={tabela} className={styles.exportCard}>
                    <div className={styles.exportCardInfo}>
                      <h4>{label}</h4>
                      <span className={styles.exportCount}>
                        {(summary as unknown as Record<string, number>)[tabela] || 0} registro(s)
                      </span>
                    </div>
                    <button
                      className={styles.exportButton}
                      onClick={() => handleExportar(tabela)}
                      disabled={exportando}
                    >
                      {exportando ? 'Exportando...' : 'Exportar JSON'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>Nenhum dado disponivel.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
