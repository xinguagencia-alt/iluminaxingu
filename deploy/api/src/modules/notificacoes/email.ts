import nodemailer from 'nodemailer'

const smtpHost = process.env.SMTP_HOST
const smtpPort = Number.parseInt(process.env.SMTP_PORT || '587', 10)
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass)

if (!smtpConfigured) {
  console.log('[EMAIL] SMTP nao configurado. Envio de e-mails desativado. Defina SMTP_HOST, SMTP_USER e SMTP_PASS para ativar.')
}

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number.isNaN(smtpPort) ? 587 : smtpPort,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!transporter) {
    console.log(`[EMAIL] Envio ignorado (SMTP nao configurado). Para: ${options.to}, Assunto: ${options.subject}`)
    return false
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'IluminaXingu <noreply@iluminaxingu.gov.br>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    console.log(`[EMAIL] Enviado com sucesso. Para: ${options.to}, Assunto: ${options.subject}`)
    return true
  } catch (error) {
    console.error('[EMAIL] Erro ao enviar e-mail:', error)
    return false
  }
}

export function isSmtpConfigured(): boolean {
  return smtpConfigured
}
