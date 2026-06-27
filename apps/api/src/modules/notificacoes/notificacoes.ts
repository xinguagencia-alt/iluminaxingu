import { sendEmail } from './email'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const STATUS_LABELS: Record<string, string> = {
  enviada: 'Enviada',
  em_analise: 'Em Analise',
  em_execucao: 'Em Execucao',
  concluida: 'Concluida',
  nao_procedente: 'Nao Procedente',
  cancelada: 'Cancelada',
  duplicada: 'Duplicada',
}

const STATUS_NOTIFY = ['em_analise', 'em_execucao', 'concluida']

interface NotificarStatusParams {
  email: string
  protocolo: string
  statusNovo: string
  observacao?: string | null
}

interface NotificarNovaSolicitacaoParams {
  protocolo: string
  nomeSolicitante: string
  tipoProblema: string
  descricao?: string | null
  endereco?: string | null
}

function buildStatusEmail(
  protocolo: string,
  statusNovo: string,
  observacao?: string | null
): { subject: string; html: string } {
  const statusLabel = STATUS_LABELS[statusNovo] || statusNovo

  const subject = `[IluminaXingu] Status atualizado - ${protocolo}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">IluminaXingu</h1>
        <p style="margin: 8px 0 0 0;">Atualizacao de Solicitacao</p>
      </div>

      <div style="padding: 20px; background: #f8fafc;">
        <p>Ola,</p>

        <p>O status da sua solicitacao foi atualizado:</p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #2563eb;">
          <p style="margin: 0 0 8px 0;"><strong>Protocolo:</strong> ${escapeHtml(protocolo)}</p>
          <p style="margin: 0 0 8px 0;"><strong>Novo status:</strong> <span style="color: #2563eb;">${escapeHtml(statusLabel)}</span></p>
          ${observacao ? `<p style="margin: 8px 0 0 0;"><strong>Observacao:</strong> ${escapeHtml(observacao)}</p>` : ''}
        </div>

        <p style="color: #6b7280; font-size: 0.9rem;">
          Acompanhe sua solicitacao pelo portal IluminaXingu.
        </p>
      </div>

      <div style="background: #e2e8f0; padding: 12px; text-align: center; font-size: 0.8rem; color: #64748b;">
        <p style="margin: 0;">IluminaXingu - Sistema de Gestao de Iluminacao Publica</p>
      </div>
    </div>
  `

  return { subject, html }
}

function buildNovaSolicitacaoEmail(
  protocolo: string,
  nomeSolicitante: string,
  tipoProblema: string,
  descricao?: string | null,
  endereco?: string | null
): { subject: string; html: string } {
  const subject = `[IluminaXingu] Nova solicitacao - ${protocolo}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #b45309; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">IluminaXingu</h1>
        <p style="margin: 8px 0 0 0;">Nova Solicitacao Recebida</p>
      </div>

      <div style="padding: 20px; background: #f8fafc;">
        <p>Uma nova solicitacao foi registrada no sistema:</p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 8px 0;"><strong>Protocolo:</strong> ${escapeHtml(protocolo)}</p>
          <p style="margin: 0 0 8px 0;"><strong>Solicitante:</strong> ${escapeHtml(nomeSolicitante)}</p>
          <p style="margin: 0 0 8px 0;"><strong>Tipo de problema:</strong> ${escapeHtml(tipoProblema)}</p>
          ${endereco ? `<p style="margin: 0 0 8px 0;"><strong>Endereco:</strong> ${escapeHtml(endereco)}</p>` : ''}
          ${descricao ? `<p style="margin: 0 0 8px 0;"><strong>Descricao:</strong> ${escapeHtml(descricao)}</p>` : ''}
        </div>

        <p style="color: #6b7280; font-size: 0.9rem;">
          Acesse o painel administrativo para analisar e responder esta solicitacao.
        </p>
      </div>

      <div style="background: #e2e8f0; padding: 12px; text-align: center; font-size: 0.8rem; color: #64748b;">
        <p style="margin: 0;">IluminaXingu - Sistema de Gestao de Iluminacao Publica</p>
      </div>
    </div>
  `

  return { subject, html }
}

export async function notificarStatusSolicitacao(
  params: NotificarStatusParams
): Promise<void> {
  if (!STATUS_NOTIFY.includes(params.statusNovo)) return

  if (!params.email) return

  const { subject, html } = buildStatusEmail(
    params.protocolo,
    params.statusNovo,
    params.observacao
  )

  await sendEmail({
    to: params.email,
    subject,
    html,
  })
}

export async function notificarNovaSolicitacao(
  params: NotificarNovaSolicitacaoParams
): Promise<void> {
  const emailAdmin = process.env.NOTIFICATION_EMAIL_TO

  if (!emailAdmin) {
    console.log('[NOTIFICACAO] NOTIFICATION_EMAIL_TO nao configurado. Notificacao de nova solicitacao ignorada.')
    return
  }

  const { subject, html } = buildNovaSolicitacaoEmail(
    params.protocolo,
    params.nomeSolicitante,
    params.tipoProblema,
    params.descricao,
    params.endereco
  )

  await sendEmail({
    to: emailAdmin,
    subject,
    html,
  })
}
