export const TIPOS_PROBLEMA_PERMITIDOS = [
  'poste_danificado',
  'lampada_apagada',
  'lampada_piscando',
  'lampada_acesa_dia',
  'risco_eletrico',
  'fio_exposto',
] as const

export type TipoProblemaPermitido = (typeof TIPOS_PROBLEMA_PERMITIDOS)[number]

export const ERRO_POSTE_NAO_ENCONTRADO = 'Poste informado nao encontrado no sistema'

const ALIASES_TIPO_PROBLEMA: Record<string, string> = {
  luminaria_acesa_24h: 'lampada_acesa_dia',
}

export type ResultadoCampo<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: string }

export type ResultadoOk = { ok: true }
export type ResultadoErro = { ok: false; erro: string }

export interface CamposSolicitacao {
  nome_solicitante?: unknown
  telefone?: unknown
  email?: unknown
  poste_id?: unknown
  codigo_poste?: unknown
  endereco_informado?: unknown
  latitude?: unknown
  longitude?: unknown
  tipo_problema?: unknown
  descricao?: unknown
  consentimento_lgpd?: unknown
}

export interface OpcoesValidacaoSolicitacao {
  poste_encontrado?: boolean | null
}

export interface ValoresSolicitacao {
  nome_solicitante: string
  telefone: string
  email: string | null
  tipo_problema: string
  descricao: string | null
  endereco_informado: string | null
  poste_id: number | null
  codigo_poste: string | null
  latitude: number | null
  longitude: number | null
}

export type ResultadoSolicitacao =
  | { ok: true; valores: ValoresSolicitacao }
  | { ok: false; erros: string[] }

export interface DadosLocalizacao {
  poste_id?: unknown
  codigo_poste?: unknown
  endereco_informado?: unknown
  latitude?: unknown
  longitude?: unknown
  poste_encontrado?: boolean | null
}

export function normalizarEspacos(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  return valor.replace(/\s+/g, ' ').trim()
}

export function normalizarCampoOpcional(valor: unknown): string | null {
  const texto = normalizarEspacos(valor)
  return texto === '' ? null : texto
}

export function normalizarTipoProblema(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  const limpo = valor.trim()
  return ALIASES_TIPO_PROBLEMA[limpo] ?? limpo
}

export function ehTipoPermitido(valor: unknown): boolean {
  return (TIPOS_PROBLEMA_PERMITIDOS as readonly string[]).includes(
    normalizarTipoProblema(valor)
  )
}

export function validarNomeCompleto(valor: unknown): ResultadoCampo<string> {
  const nome = normalizarEspacos(valor)
  if (!nome) return { ok: false, erro: 'Nome completo e obrigatorio' }
  if (nome.length > 200) {
    return { ok: false, erro: 'Nome completo muito longo (maximo 200 caracteres)' }
  }
  const partes = nome.split(' ')
  if (partes.length < 2 || partes.some((parte) => parte.length < 2)) {
    return { ok: false, erro: 'Informe nome e sobrenome' }
  }
  return { ok: true, valor: nome }
}

const DDDS_BRASILEIROS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24',
  '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46',
  '47', '48', '49',
  '51', '53', '54', '55',
  '61',
  '62', '64',
  '63',
  '65', '66',
  '67',
  '68', '69',
  '71', '73', '74', '75', '77',
  '79',
  '81', '87',
  '82',
  '83',
  '84',
  '85', '88',
  '86', '89',
  '91', '93', '94',
  '92', '97',
  '95',
  '96',
  '98', '99',
])

export function validarTelefone(valor: unknown): ResultadoCampo<string> {
  const bruto =
    typeof valor === 'number' ? String(valor) : typeof valor === 'string' ? valor : ''
  if (!bruto.trim()) {
    return {
      ok: false,
      erro: 'Informe um telefone para receber o protocolo e o retorno',
    }
  }

  const digitos = bruto.replace(/\D/g, '')
  const mensagemPadrao =
    'Telefone invalido. Use o numero com DDD, ex.: 69 99999-0001'

  let nacional = digitos
  if ((nacional.length === 12 || nacional.length === 13) && nacional.startsWith('55')) {
    nacional = nacional.slice(2)
  }

  if (nacional.length !== 10 && nacional.length !== 11) {
    return { ok: false, erro: mensagemPadrao }
  }
  if (!DDDS_BRASILEIROS.has(nacional.slice(0, 2))) {
    return { ok: false, erro: mensagemPadrao }
  }
  if (!/^[2-9]/.test(nacional.slice(2))) {
    return { ok: false, erro: mensagemPadrao }
  }
  if (/^(\d)\1+$/.test(nacional)) {
    return { ok: false, erro: mensagemPadrao }
  }
  return { ok: true, valor: nacional }
}

export function validarEmail(valor: unknown): ResultadoCampo<string | null> {
  const email = normalizarCampoOpcional(valor)
  if (email === null) return { ok: true, valor: null }
  if (email.length > 200) {
    return { ok: false, erro: 'E-mail muito longo (maximo 200 caracteres)' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, erro: 'E-mail invalido' }
  }
  return { ok: true, valor: email }
}

export function validarCoordenadas(
  latitude: unknown,
  longitude: unknown
): ResultadoCampo<{ latitude: number | null; longitude: number | null }> {
  const temLatitude =
    latitude !== undefined && latitude !== null && latitude !== ''
  const temLongitude =
    longitude !== undefined && longitude !== null && longitude !== ''

  if (!temLatitude && !temLongitude) {
    return { ok: true, valor: { latitude: null, longitude: null } }
  }
  if (temLatitude !== temLongitude) {
    return {
      ok: false,
      erro: 'Latitude e longitude devem ser informadas juntas',
    }
  }

  const lat = Number(latitude)
  const lng = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, erro: 'Coordenadas invalidas' }
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, erro: 'Coordenadas invalidas' }
  }
  return { ok: true, valor: { latitude: lat, longitude: lng } }
}

const PADRAO_RUA =
  /\b(rua|avenida|av|travessa|tv|alameda|al|rodovia|rod|estrada|beco|praca|praça|viela|largo)\b/i

export function extrairRuaBairro(
  endereco: unknown
): { rua: string | null; bairro: string | null } {
  const texto = normalizarEspacos(endereco)
  if (!texto) return { rua: null, bairro: null }

  const partes = texto
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean)

  const parteRua = partes.find((parte) => PADRAO_RUA.test(parte)) ?? null
  let rua: string | null = null
  if (parteRua) {
    const antesDoHifen = parteRua.split('-')[0].trim()
    rua = antesDoHifen && PADRAO_RUA.test(antesDoHifen) ? antesDoHifen : parteRua
  } else if (PADRAO_RUA.test(texto)) {
    rua = partes[0] ?? null
  }

  let bairro: string | null = null
  const explicito = /bairro\s*[:\-]?\s*(.+)/i.exec(texto)
  if (explicito) {
    bairro = normalizarEspacos(explicito[1]) || null
  } else {
    for (const parte of [...partes].reverse()) {
      if (parte === rua) continue
      if (/^\d+$/.test(parte)) continue
      if (PADRAO_RUA.test(parte)) continue
      bairro = parte
      break
    }
    if (!bairro && !texto.includes(',')) {
      const aposHifen = /-\s*([^,-]+)$/.exec(texto)
      if (aposHifen) bairro = normalizarEspacos(aposHifen[1]) || null
    }
  }

  return { rua, bairro }
}

export function validarLocalizacao(
  dados: DadosLocalizacao
): ResultadoOk | ResultadoErro {
  const coordenadas = validarCoordenadas(dados.latitude, dados.longitude)
  if (!coordenadas.ok) return coordenadas

  const temPosteId =
    dados.poste_id !== undefined && dados.poste_id !== null && dados.poste_id !== ''
  const codigoPoste = normalizarCampoOpcional(dados.codigo_poste)
  const temCodigo = codigoPoste !== null

  if (temPosteId) {
    const id = Number(dados.poste_id)
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, erro: 'Poste informado invalido' }
    }
  }

  if (temPosteId || temCodigo) {
    if (dados.poste_encontrado === false) {
      return { ok: false, erro: ERRO_POSTE_NAO_ENCONTRADO }
    }
    return { ok: true }
  }

  if (coordenadas.valor.latitude !== null && coordenadas.valor.longitude !== null) {
    return { ok: true }
  }

  const endereco = normalizarCampoOpcional(dados.endereco_informado)
  if (endereco !== null) {
    const { rua, bairro } = extrairRuaBairro(endereco)
    if (rua && bairro) return { ok: true }
    return { ok: false, erro: 'Endereco incompleto. Informe a rua e o bairro' }
  }

  return {
    ok: false,
    erro: 'Informe a localizacao do problema: poste, coordenadas ou endereco com rua e bairro',
  }
}

export function validarSolicitacao(
  body: unknown,
  opcoes: OpcoesValidacaoSolicitacao = {}
): ResultadoSolicitacao {
  const campos: CamposSolicitacao =
    body && typeof body === 'object' ? (body as CamposSolicitacao) : {}

  const erros: string[] = []

  const nome = validarNomeCompleto(campos.nome_solicitante)
  if (!nome.ok) erros.push(nome.erro)

  const telefone = validarTelefone(campos.telefone)
  if (!telefone.ok) erros.push(telefone.erro)

  const email = validarEmail(campos.email)
  if (!email.ok) erros.push(email.erro)

  const tipoProblema = normalizarTipoProblema(campos.tipo_problema)
  if (!ehTipoPermitido(tipoProblema)) {
    erros.push('Tipo de problema invalido. Escolha uma das opcoes disponiveis')
  }

  if (!campos.consentimento_lgpd) {
    erros.push(
      'O consentimento com a LGPD e obrigatorio para enviar a solicitacao'
    )
  }

  const localizacao = validarLocalizacao({
    poste_id: campos.poste_id,
    codigo_poste: campos.codigo_poste,
    endereco_informado: campos.endereco_informado,
    latitude: campos.latitude,
    longitude: campos.longitude,
    poste_encontrado: opcoes.poste_encontrado ?? null,
  })
  if (!localizacao.ok) erros.push(localizacao.erro)

  const coordenadas = validarCoordenadas(campos.latitude, campos.longitude)

  if (
    erros.length > 0 ||
    !nome.ok ||
    !telefone.ok ||
    !email.ok ||
    !localizacao.ok ||
    !coordenadas.ok
  ) {
    return { ok: false, erros }
  }

  const temPosteId =
    campos.poste_id !== undefined &&
    campos.poste_id !== null &&
    campos.poste_id !== ''

  return {
    ok: true,
    valores: {
      nome_solicitante: nome.valor,
      telefone: telefone.valor,
      email: email.valor,
      tipo_problema: tipoProblema,
      descricao: normalizarCampoOpcional(campos.descricao),
      endereco_informado: normalizarCampoOpcional(campos.endereco_informado),
      poste_id: temPosteId ? Number(campos.poste_id) : null,
      codigo_poste: normalizarCampoOpcional(campos.codigo_poste),
      latitude: coordenadas.valor.latitude,
      longitude: coordenadas.valor.longitude,
    },
  }
}

export function primeiraMensagemDeErro(erros: string[]): string {
  return erros.length > 0 ? erros[0] : ''
}

export function garantirSolicitacaoValida(body: unknown): void {
  const resultado = validarSolicitacao(body)
  if (!resultado.ok) {
    throw new Error(resultado.erros.join(' '))
  }
}
