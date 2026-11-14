import type { ConfirmacaoInfo } from './types'

export const MENSAGEM_DUPLICIDADE_SEM_CONFIRMACAO =
  'Já existe um atendimento em aberto para este problema. Consulte o protocolo para acompanhar.'

export const MENSAGEM_DUPLICIDADE_COM_CONFIRMACAO =
  'Outro morador já relatou este mesmo problema nesta localização, então não é preciso abrir outra solicitação. A sua confirmação foi registrada e ajuda a priorizar o atendimento.'

export function confirmacaoRegistrada(
  confirmacao: ConfirmacaoInfo | null | undefined
): boolean {
  return confirmacao?.registrada === true
}

export function mensagemDuplicidade(
  confirmacao: ConfirmacaoInfo | null | undefined
): string {
  return confirmacaoRegistrada(confirmacao)
    ? MENSAGEM_DUPLICIDADE_COM_CONFIRMACAO
    : MENSAGEM_DUPLICIDADE_SEM_CONFIRMACAO
}

export function totalMoradoresConfirmados(
  confirmacao: ConfirmacaoInfo | null | undefined
): number | null {
  if (!confirmacaoRegistrada(confirmacao)) return null
  return confirmacao?.total_moradores ?? null
}

export function elevouPrioridadeConfirmada(
  confirmacao: ConfirmacaoInfo | null | undefined
): boolean {
  return confirmacaoRegistrada(confirmacao) && Boolean(confirmacao?.elevou_prioridade)
}
