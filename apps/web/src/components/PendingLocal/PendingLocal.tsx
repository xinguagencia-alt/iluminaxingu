import { useEffect, useState } from 'react'
import type { ErroSync, ResultadoProtocolo, SolicitacaoPendente } from '../../offline/types'
import styles from './PendingLocal.module.css'

const LABELS_TIPO: Record<string, string> = {
  poste_danificado: 'Poste danificado',
  lampada_apagada: 'Lâmpada apagada',
  lampada_piscando: 'Lâmpada piscando',
  risco_eletrico: 'Risco elétrico',
  fio_exposto: 'Fio exposto',
  outro: 'Outro',
}

interface PendingLocalProps {
  pendentes: SolicitacaoPendente[]
  onRemover: (idLocal: string) => Promise<void>
  onFechar: () => void
  sincronizando?: boolean
  progresso?: { atual: number; total: number } | null
  resultados?: ResultadoProtocolo[]
  errosSync?: ErroSync[]
  onSincronizar?: () => void
}

function formatarData(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function descreverStatus(item: SolicitacaoPendente): string {
  switch (item.estado) {
    case 'enviando':
      return 'Enviando…'
    case 'enviada':
      return item.protocolo_oficial
        ? `Enviada · protocolo ${item.protocolo_oficial}`
        : 'Enviada'
    case 'erro': {
      const detalhe = item.ultimo_erro
        ? `Erro: ${item.ultimo_erro}`
        : 'Erro no envio'
      const acao =
        item.erro_retryavel === false
          ? 'Nova tentativa somente pelo botão Sincronizar agora.'
          : 'Nova tentativa automática agendada.'
      return `${detalhe} · ${acao}`
    }
    default:
      if (item.protocolo_oficial) {
        return `Aguardando envio dos anexos · protocolo ${item.protocolo_oficial}`
      }
      return 'Aguardando envio'
  }
}

export function PendingLocal({
  pendentes,
  onRemover,
  onFechar,
  sincronizando = false,
  progresso = null,
  resultados = [],
  errosSync = [],
  onSincronizar,
}: PendingLocalProps) {
  const [confirmando, setConfirmando] = useState<string | null>(null)

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  return (
    <div className={styles.overlay} onClick={onFechar} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Solicitacoes salvas neste aparelho"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2>Salvas neste aparelho</h2>
            <p>
              Estas solicitações serão sincronizadas automaticamente quando houver
              conexão. O protocolo oficial é gerado pelo sistema somente após o envio.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {(sincronizando || resultados.length > 0 || errosSync.length > 0) && (
          <div className={styles.statusBox} role="status" aria-live="polite">
            {sincronizando && (
              <p className={styles.statusSincronizando}>
                {progresso && progresso.total > 0
                  ? `Sincronizando… enviando ${progresso.atual} de ${progresso.total}.`
                  : 'Sincronizando…'}
              </p>
            )}
            {!sincronizando && resultados.length > 0 && (
              <p className={styles.statusOk}>
                Protocolo(s) recebido(s): {resultados.map((r) => r.protocolo).join(' · ')}
              </p>
            )}
            {!sincronizando && errosSync.length > 0 && (
              <p className={styles.statusErro}>
                {errosSync.length} solicitação(ões) com erro nesta tentativa.
                Veja o detalhe em cada item abaixo.
              </p>
            )}
          </div>
        )}

        {pendentes.length === 0 ? (
          <p className={styles.vazio}>
            Nenhuma solicitação pendente.
            {!sincronizando && resultados.length > 0 && ' Tudo sincronizado.'}
          </p>
        ) : (
          <ul className={styles.lista}>
            {pendentes.map((item) => (
              <li key={item.id_local} className={styles.card}>
                <div className={styles.cardInfo}>
                  <strong>{item.payload.nome_solicitante}</strong>
                  <span>
                    {LABELS_TIPO[item.payload.tipo_problema] || item.payload.tipo_problema}
                    {' · '}
                    {formatarData(item.criado_em)}
                  </span>
                  {item.protocolo_oficial && (
                    <span className={styles.cardProtocolo}>
                      Protocolo: {item.protocolo_oficial}
                    </span>
                  )}
                  <span
                    className={`${styles.cardMeta} ${
                      item.estado === 'erro' ? styles.cardMetaErro : ''
                    }`}
                  >
                    {descreverStatus(item)}
                    {item.anexos.length > 0 &&
                      ` · ${item.anexos_enviados?.length ?? 0}/${item.anexos.length} anexo(s) enviado(s)`}
                    {item.estado !== 'erro' && item.anexos_descartados &&
                      ' · anexos não puderam ser salvos'}
                  </span>
                </div>

                {confirmando === item.id_local ? (
                  <div className={styles.acoesConfirmar}>
                    <button
                      type="button"
                      className={styles.botaoConfirmar}
                      onClick={async () => {
                        await onRemover(item.id_local)
                        setConfirmando(null)
                      }}
                    >
                      Confirmar exclusão
                    </button>
                    <button
                      type="button"
                      className={styles.botaoCancelar}
                      onClick={() => setConfirmando(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.botaoExcluir}
                    onClick={() => setConfirmando(item.id_local)}
                  >
                    Excluir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.botaoSincronizar}
            onClick={() => onSincronizar?.()}
            disabled={sincronizando || !onSincronizar}
          >
            {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
          <button type="button" className={styles.botaoFechar} onClick={onFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
