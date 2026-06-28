import { useState } from 'react'
import { useOrdemServicoDetail } from './useOrdemServicoDetail'
import { useAnexos } from '../../hooks/useAnexos'
import {
  STATUS_ORDEM_COLORS,
  STATUS_ORDEM_LABELS,
} from '../OrdemServicoList/types'
import { STATUS_LABELS, STATUS_COLORS, TIPOS_PROBLEMA, type StatusSolicitacao } from '../SolicitacaoList/types'
import { FileUpload } from '../FileUpload/FileUpload'
import { API_URL } from '../../config/api'
import styles from './OrdemServicoDetail.module.css'

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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusBadge({ status, color }: { status: string; color: string }) {
  return (
    <span className={styles.badge} style={{ backgroundColor: color }}>
      {status}
    </span>
  )
}

interface OrdemServicoDetailProps {
  ordemId: number
  onVoltar: () => void
}

export function OrdemServicoDetail({ ordemId, onVoltar }: OrdemServicoDetailProps) {
  const { data, loading, error, refetch } = useOrdemServicoDetail(ordemId)
  const { uploading, upload, remover, download } = useAnexos()
  const [removingId, setRemovingId] = useState<number | null>(null)

  async function handleUpload(file: File): Promise<boolean> {
    const result = await upload(file, undefined, ordemId)
    if (result) {
      refetch()
      return true
    }
    return false
  }

  async function handleRemove(id: number) {
    setRemovingId(id)
    const success = await remover(id)
    setRemovingId(null)
    if (success) refetch()
  }

  async function handleDownload(id: number, filename: string) {
    await download(id, filename)
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Carregando detalhes...</p>
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

  if (!data) return null

  const { ordem, historico, anexos } = data
  const enderecoPoste = [ordem.poste_rua, ordem.poste_numero, ordem.poste_bairro, ordem.poste_complemento]
    .filter(Boolean)
    .join(', ')
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onVoltar}>
          ← Voltar
        </button>
        <h2>Detalhe da OS</h2>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Dados da Ordem de Serviço</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Protocolo</span>
            <span className={`${styles.infoValue} ${styles.protocolValue}`}>
              {ordem.protocolo}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Status</span>
            <StatusBadge
              status={STATUS_ORDEM_LABELS[ordem.status]}
              color={STATUS_ORDEM_COLORS[ordem.status]}
            />
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Equipe</span>
            <span className={styles.infoValue}>{ordem.equipe_nome || '-'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Problema</span>
            <span className={styles.infoValue}>
              {TIPOS_PROBLEMA[ordem.tipo_problema] || ordem.tipo_problema}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Prioridade</span>
            <span className={styles.infoValue}>{ordem.prioridade || 'Média'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Endereço</span>
            <span className={styles.infoValue}>{ordem.endereco_informado || '-'}</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Dados do Solicitante</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Nome</span>
            <span className={styles.infoValue}>{ordem.nome_solicitante}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Telefone</span>
            <span className={styles.infoValue}>{ordem.telefone || '-'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>E-mail</span>
            <span className={styles.infoValue}>{ordem.email || '-'}</span>
          </div>
          {ordem.codigo_poste_informado && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Código Poste</span>
              <span className={styles.infoValue}>{ordem.codigo_poste_informado}</span>
            </div>
          )}
        </div>
        {ordem.solicitacao_descricao && (
          <div style={{ marginTop: 16 }}>
            <span className={styles.infoLabel}>Descrição</span>
            <div className={styles.description}>{ordem.solicitacao_descricao}</div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Localização e endereço</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Endereço informado</span>
            <span className={styles.infoValue}>{ordem.endereco_informado || '-'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Latitude</span>
            <span className={styles.infoValue}>{ordem.solicitacao_latitude ?? '-'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Longitude</span>
            <span className={styles.infoValue}>{ordem.solicitacao_longitude ?? '-'}</span>
          </div>
        </div>
        {(ordem.poste_id || ordem.poste_codigo || ordem.poste_endereco) && (
          <div style={{ marginTop: 16 }}>
            <span className={styles.infoLabel}>Poste vinculado</span>
            <div className={styles.description}>
              {ordem.poste_codigo && <div><strong>Código:</strong> {ordem.poste_codigo}</div>}
              {enderecoPoste && <div><strong>Endereço:</strong> {enderecoPoste}</div>}
              {(ordem.poste_latitude !== null || ordem.poste_longitude !== null) && (
                <div>
                  <strong>Coordenadas:</strong>{' '}
                  {ordem.poste_latitude ?? '-'}, {ordem.poste_longitude ?? '-'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Datas</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Criação</span>
            <span className={styles.infoValue}>{formatDate(ordem.criado_em)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Abertura</span>
            <span className={styles.infoValue}>{formatDate(ordem.data_abertura)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Início Execução</span>
            <span className={styles.infoValue}>{formatDate(ordem.data_execucao)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Encerramento</span>
            <span className={styles.infoValue}>{formatDate(ordem.data_encerramento)}</span>
          </div>
        </div>
        {(ordem.observacao_execucao || ordem.resultado) && (
          <div style={{ marginTop: 16 }}>
            {ordem.observacao_execucao && (
              <div style={{ marginBottom: 12 }}>
                <span className={styles.infoLabel}>Observação de Execução</span>
                <div className={styles.description}>{ordem.observacao_execucao}</div>
              </div>
            )}
            {ordem.resultado && (
              <div>
                <span className={styles.infoLabel}>Resultado</span>
                <div className={styles.description}>{ordem.resultado}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Histórico de Status</h3>
        {historico.length === 0 ? (
          <div className={styles.emptyTimeline}>Nenhum registro de status encontrado.</div>
        ) : (
          <div className={styles.timeline}>
            {historico.map((item) => {
              const statusNovoLabel =
                STATUS_LABELS[item.status_novo as StatusSolicitacao] || item.status_novo
              const statusNovoColor =
                STATUS_COLORS[item.status_novo as StatusSolicitacao] || '#64748b'

              return (
                <div key={item.id} className={styles.timelineItem}>
                  <div
                    className={styles.timelineDot}
                    style={{ backgroundColor: statusNovoColor }}
                  />
                  <div className={styles.timelineHeader}>
                    <div className={styles.timelineStatus}>
                      {item.status_anterior && (
                        <>
                          <StatusBadge
                            status={
                              STATUS_LABELS[item.status_anterior as StatusSolicitacao] ||
                              item.status_anterior
                            }
                            color={
                              STATUS_COLORS[item.status_anterior as StatusSolicitacao] ||
                              '#64748b'
                            }
                          />
                          <span className={styles.timelineArrow}>→</span>
                        </>
                      )}
                      <StatusBadge status={statusNovoLabel} color={statusNovoColor} />
                    </div>
                    <span className={styles.timelineDate}>{formatDate(item.criado_em)}</span>
                  </div>
                  {(item.criado_por || item.criado_por_username) && (
                    <div className={styles.timelineUser}>
                      Por: {item.criado_por_username || item.criado_por}
                    </div>
                  )}
                  {item.observacao && (
                    <div className={styles.timelineObservation}>{item.observacao}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Anexos</h3>
        <FileUpload onUpload={handleUpload} uploading={uploading} />
        {anexos.length === 0 ? (
          <div className={styles.emptyAttachments}>Nenhum anexo encontrado.</div>
        ) : (
          <div className={styles.attachmentsList}>
            {anexos.map((anexo) => {
              const isImage = anexo.arquivo_tipo?.startsWith('image/')
              return (
                <div key={anexo.id} className={styles.attachmentItem}>
                  {isImage && (
                    <div className={styles.attachmentPreview}>
                      <img
                        src={`${API_URL}/api/anexos/${anexo.id}/view`}
                        alt={anexo.arquivo_nome}
                        className={styles.attachmentThumb}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.attachmentLink}
                    onClick={() => handleDownload(anexo.id, anexo.arquivo_nome)}
                    title="Baixar anexo"
                  >
                    <div className={styles.attachmentIcon}>{isImage ? '🖼️' : '📄'}</div>
                    <div className={styles.attachmentInfo}>
                      <div className={styles.attachmentName}>{anexo.arquivo_nome}</div>
                      <div className={styles.attachmentMeta}>
                        {anexo.arquivo_tipo || 'Arquivo'}{' '}
                        {anexo.tamanho_bytes ? `· ${formatFileSize(anexo.tamanho_bytes)}` : ''}{' '}
                        · {formatDate(anexo.criado_em)}
                      </div>
                    </div>
                  </button>
                  <button
                    className={styles.removeButton}
                    onClick={() => handleRemove(anexo.id)}
                    disabled={removingId === anexo.id}
                    title="Remover anexo"
                  >
                    {removingId === anexo.id ? '...' : '×'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
