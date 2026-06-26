import { sendEmail } from './email'

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
        <p>Olá,</p>

        <p>O status da sua solicitacao foi atualizado:</p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #2563eb;">
          <p style="margin: 0 0 8px 0;"><strong>Protocolo:</strong> ${protocolo}</p>
          <p style="margin: 0 0 8px 0;"><strong>Novo status:</strong> <span style="color: #2563eb;">${statusLabel}</span></p>
          ${observacao ? `<p style="margin: 8px 0 0 0;"><strong>Observacao:</strong> ${observacao}</p>` : ''}
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