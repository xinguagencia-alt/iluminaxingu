import { useState } from 'react'
import { useAuditoria } from '../../hooks/useAuditoria'
import { useExport } from '../../hooks/useExport'
import { useFluxo } from '../../hooks/useFluxo'
import { useFilaDistribuicao } from '../../hooks/useFilaDistribuicao'
import styles from './AdminPanel.module.css'

type Tab = 'auditoria' | 'exportar' | 'fluxo' | 'fila'

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
  configuracao_fluxo: 'Modo do Fluxo',
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

function FluxoTab({ showToast }: { showToast: (message: string, type: 'success' | 'error') => void }) {
  const { config, loading, saving, error, alterarModo } = useFluxo()
  const modo = config?.modo ?? 'manual'
  const automatico = modo === 'automatico'

  async function handleAlterar(novo: 'manual' | 'automatico') {
    if (novo === modo) return
    const resultado = await alterarModo(novo)
    if (resultado.ok) {
      showToast(novo === 'automatico' ? 'Modo automatico ativado' : 'Modo manual ativado', 'success')
    } else {
      showToast(resultado.error || 'Erro ao alterar o modo', 'error')
    }
  }

  if (loading && !config) {
    return <div className={styles.loading}>Carregando modo do fluxo...</div>
  }

  return (
    <div>
      {error && <p className={styles.error}>{error}</p>}

      <div className={`${styles.fluxoBanner} ${automatico ? styles.fluxoBannerAuto : styles.fluxoBannerManual}`}>
        <div>
          <span className={`${styles.fluxoBadge} ${automatico ? styles.fluxoBadgeAuto : styles.fluxoBadgeManual}`}>
            {automatico ? 'Fluxo automatico' : 'Fluxo manual'}
          </span>
          <p className={styles.fluxoDesc}>
            {automatico
              ? 'Solicitacoes validadas e nao duplicadas ficam elegiveis para criacao automatica de OS (Etapa 5).'
              : 'Nenhuma OS e criada automaticamente. O operador analisa e cria/encaminha as ordens de servico.'}
          </p>
        </div>
      </div>

      <div className={styles.fluxoCard}>
        <div className={styles.fluxoInfo}>
          <h3>Modo operacional do fluxo</h3>
          <p>
            Valor ativo: <strong>{automatico ? 'automatico' : 'manual'}</strong> (padrao: manual).
            Alteracao exige perfil Administrador e fica registrada na auditoria.
            Solicitacoes duplicadas nunca entram no fluxo automatico.
          </p>
        </div>
        <div className={styles.fluxoActions}>
          <button
            className={`${styles.fluxoBtn} ${!automatico ? styles.fluxoBtnActive : ''}`}
            onClick={() => handleAlterar('manual')}
            disabled={saving || !config || modo === 'manual'}
          >
            Manual
          </button>
          <button
            className={`${styles.fluxoBtn} ${automatico ? styles.fluxoBtnActiveAuto : ''}`}
            onClick={() => handleAlterar('automatico')}
            disabled={saving || !config || modo === 'automatico'}
          >
            Automatico
          </button>
        </div>
      </div>
    </div>
  )
}

function FilaTab({ showToast }: { showToast: (message: string, type: 'success' | 'error') => void }) {
  const { fila, loading, saving, error, refetch, processarFila } = useFilaDistribuicao()

  async function handleProcessar() {
    const resultado = await processarFila()
    if (resultado.ok && resultado.resultado) {
      const { processadas, atribuidas, pendentes } = resultado.resultado
      showToast(
        `Fila processada: ${processadas} processada(s), ${atribuidas} atribuida(s), ${pendentes} pendente(s)`,
        'success'
      )
    } else {
      showToast(resultado.error || 'Erro ao processar a fila', 'error')
    }
  }

  if (loading && fila.length === 0 && !error) {
    return <div className={styles.loading}>Carregando fila de distribuicao...</div>
  }

  return (
    <div>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.fluxoBanner} style={{
        background: 'linear-gradient(135deg, rgba(239,246,255,.95), rgba(219,234,254,.9))',
        borderColor: 'rgba(59,130,246,.28)',
        marginBottom: 16,
      }}>
        <div>
          <span className={styles.fluxoBadge} style={{ background: '#dbeafe', color: '#1e40af' }}>
            Fila de equipes
          </span>
          <p className={styles.fluxoDesc}>
            OS abertas sem equipe. A redistribuicao acontece ao liberar uma equipe (PUT) ou
            pelo botao abaixo (acao POST administrativa). Sem polling.
          </p>
        </div>
      </div>

      <div className={styles.auditHeader}>
        <span className={styles.auditCount}>{fila.length} OS aguardando equipe</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.refreshButton} onClick={refetch} disabled={loading || saving}>
            Atualizar
          </button>
          <button
            className={styles.exportButton}
            onClick={handleProcessar}
            disabled={saving || loading}
            style={{ marginTop: 0 }}
          >
            {saving ? 'Processando...' : 'Processar fila'}
          </button>
        </div>
      </div>

      {fila.length === 0 ? (
        <div className={styles.empty}>Nenhuma OS na fila. Todas possuem equipe ou nao ha ordens abertas.</div>
      ) : (
        <div className={styles.auditList}>
          {fila.map((item) => (
            <div key={item.id} className={styles.auditItem}>
              <div className={styles.auditItemHeader}>
                <span className={styles.tabelaBadge}>{item.protocolo}</span>
                <span className={styles.tabelaBadge}>{item.tipo_problema}</span>
                <span className={styles.auditDate}>{item.prioridade || '-'}</span>
              </div>
              <div className={styles.auditItemBody}>
                <span className={styles.auditUser}>
                  {item.equipe_nome || 'Aguardando equipe'}
                </span>
                <span className={styles.auditId} title={item.motivo_detalhe}>
                  Motivo: {item.motivo}
                </span>
              </div>
              <div className={styles.auditItemBody} style={{ marginTop: 6 }}>
                <span className={styles.auditId}>{item.endereco_informado || '-'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
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
        <p className={styles.subtitle}>Auditoria, exportacao, fluxo de atendimento e gerenciamento do sistema</p>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'auditoria' ? styles.tabActive : ''}`}
          onClick={() => setTab('auditoria')}
        >
          Auditoria
        </button>
        <button
          className={`${styles.tab} ${tab === 'fluxo' ? styles.tabActive : ''}`}
          onClick={() => setTab('fluxo')}
        >
          Fluxo
        </button>
        <button
          className={`${styles.tab} ${tab === 'fila' ? styles.tabActive : ''}`}
          onClick={() => setTab('fila')}
        >
          Fila OS
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
        {tab === 'fluxo' && <FluxoTab showToast={showToast} />}
        {tab === 'fila' && <FilaTab showToast={showToast} />}

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
                {Object.entries(TABELAS_LABELS)
                  .filter(([tabela]) => tabela !== 'configuracao_fluxo')
                  .map(([tabela, label]) => (
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
