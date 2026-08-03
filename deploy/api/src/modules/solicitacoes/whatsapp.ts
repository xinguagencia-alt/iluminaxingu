const STATUS_LABELS: Record<string, string> = {
  enviada: 'Enviada',
  em_analise: 'Em analise',
  em_execucao: 'Em execucao',
  concluida: 'Concluida',
  em_manutencao: 'Em manutencao',
  nao_procedente: 'Nao procedente',
  cancelada: 'Cancelada',
  duplicada: 'Duplicada',
}

export function normalizarTelefone(telefone: string): string | null {
  const apenasNumeros = telefone.replace(/\D/g, '')

  if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
    return `55${apenasNumeros}`
  }

  if (
    (apenasNumeros.length === 12 || apenasNumeros.length === 13) &&
    apenasNumeros.startsWith('55')
  ) {
    return apenasNumeros
  }

  return null
}

export function montarMensagemProtocolo(nome: string, protocolo: string): string {
  const nomeFormatado = nome.split(' ')[0]
  return (
    `Ola, ${nomeFormatado}. Sua solicitacao de iluminacao publica foi registrada no IluminaXingu. ` +
    `Protocolo: ${protocolo}. Guarde este numero para acompanhar o andamento.`
  )
}

export function montarMensagemStatus(nome: string, protocolo: string, status: string): string {
  const nomeFormatado = nome.split(' ')[0]
  const statusLabel = STATUS_LABELS[status] || status
  return (
    `Ola, ${nomeFormatado}. Sua solicitacao ${protocolo} teve o status atualizado para: ${statusLabel}. ` +
    `Acompanhe pelo portal IluminaXingu.`
  )
}

export function montarMensagemConclusao(nome: string, protocolo: string): string {
  const nomeFormatado = nome.split(' ')[0]
  return (
    `Ola, ${nomeFormatado}. Sua solicitacao ${protocolo} foi concluida pela equipe de iluminacao publica. ` +
    `Obrigado por utilizar o IluminaXingu.`
  )
}

export function montarWhatsAppUrl(telefoneNormalizado: string, mensagem: string): string {
  const encoded = encodeURIComponent(mensagem)
  return `https://wa.me/${telefoneNormalizado}?text=${encoded}`
}
