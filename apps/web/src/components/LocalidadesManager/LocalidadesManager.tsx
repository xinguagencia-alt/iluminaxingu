import { useMemo, useState, type FormEvent } from 'react'
import { useAdminLocalidades } from '../../hooks/useAdminLocalidades'
import { TIPO_LOCALIDADE_LABELS, type Localidade, type TipoLocalidade } from '../../localidades'
import styles from './LocalidadesManager.module.css'

type TipoFormulario = TipoLocalidade | ''
type ToastFn = (message: string, type: 'success' | 'error') => void

const TIPOS: TipoLocalidade[] = ['sede', 'distrito', 'vila']

function nomeValidado(nome: string): string | null {
  const valor = nome.trim().replace(/\s+/g, ' ')
  return valor.length > 0 ? valor : null
}

export function LocalidadesManager({ showToast }: { showToast: ToastFn }) {
  const { localidades, loading, saving, error, recarregar, criar, atualizar, desativar } = useAdminLocalidades()
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoFormulario>('')
  const [editando, setEditando] = useState<Localidade | null>(null)
  const [erroFormulario, setErroFormulario] = useState<string | null>(null)

  const agrupadas = useMemo(() => TIPOS.map((tipoLocalidade) => ({
    tipo: tipoLocalidade,
    itens: localidades.filter((localidade) => localidade.tipo === tipoLocalidade),
  })), [localidades])

  function cancelarEdicao() {
    setEditando(null)
    setNome('')
    setTipo('')
    setErroFormulario(null)
  }

  function iniciarEdicao(localidade: Localidade) {
    setEditando(localidade)
    setNome(localidade.nome)
    setTipo(localidade.tipo)
    setErroFormulario(null)
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nomeLimpo = nomeValidado(nome)
    if (!nomeLimpo) {
      setErroFormulario('Informe o nome da localidade.')
      return
    }
    if (!tipo) {
      setErroFormulario('Selecione Sede, Distrito ou Vila.')
      return
    }

    setErroFormulario(null)
    const resultado = editando
      ? await atualizar(editando.id, nomeLimpo, tipo)
      : await criar(nomeLimpo, tipo)

    if (!resultado.ok) {
      setErroFormulario(resultado.error || 'Não foi possível salvar a localidade.')
      return
    }

    showToast(editando ? 'Localidade atualizada.' : 'Localidade cadastrada.', 'success')
    cancelarEdicao()
  }

  async function handleDesativar(localidade: Localidade) {
    const confirmado = window.confirm(
      `Desativar ${TIPO_LOCALIDADE_LABELS[localidade.tipo].toLowerCase()} "${localidade.nome}"? Ela deixará de aparecer em novas solicitações, mas registros antigos serão preservados.`
    )
    if (!confirmado) return

    const resultado = await desativar(localidade.id)
    if (!resultado.ok) {
      showToast(resultado.error || 'Não foi possível desativar a localidade.', 'error')
      return
    }
    if (editando?.id === localidade.id) cancelarEdicao()
    showToast('Localidade desativada. Os registros existentes foram preservados.', 'success')
  }

  return (
    <section className={styles.container} aria-labelledby="localidades-titulo">
      <header className={styles.header}>
        <div>
          <h3 id="localidades-titulo">Localidades</h3>
          <p>Cadastre a Sede, os Distritos e as Vilas que poderão ser selecionados nas solicitações.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => void recarregar()} disabled={loading || saving}>
          Atualizar lista
        </button>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <form className={styles.form} onSubmit={salvar} noValidate>
        <div className={styles.field}>
          <label htmlFor="localidade-nome">Nome da localidade</label>
          <input
            id="localidade-nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            maxLength={120}
            placeholder="Ex.: Sede, Vila Nova ou Distrito..."
            disabled={saving}
            aria-describedby={erroFormulario ? 'localidade-form-error' : undefined}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="localidade-tipo">Tipo</label>
          <select
            id="localidade-tipo"
            value={tipo}
            onChange={(event) => setTipo(event.target.value as TipoFormulario)}
            disabled={saving}
          >
            <option value="">Selecione...</option>
            {TIPOS.map((item) => <option key={item} value={item}>{TIPO_LOCALIDADE_LABELS[item]}</option>)}
          </select>
        </div>
        <div className={styles.formActions}>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar localidade'}
          </button>
          {editando && (
            <button type="button" className={styles.secondaryButton} onClick={cancelarEdicao} disabled={saving}>
              Cancelar edição
            </button>
          )}
        </div>
        {erroFormulario && <p id="localidade-form-error" className={styles.error} role="alert">{erroFormulario}</p>}
      </form>

      {loading && localidades.length === 0 ? (
        <p className={styles.state} role="status">Carregando localidades...</p>
      ) : localidades.length === 0 ? (
        <p className={styles.state}>Nenhuma localidade ativa cadastrada. Use o formulário acima para começar.</p>
      ) : (
        <div className={styles.groups}>
          {agrupadas.filter((grupo) => grupo.itens.length > 0).map((grupo) => (
            <section key={grupo.tipo} className={styles.group} aria-labelledby={`localidades-${grupo.tipo}`}>
              <h4 id={`localidades-${grupo.tipo}`}>{TIPO_LOCALIDADE_LABELS[grupo.tipo]} <span>({grupo.itens.length})</span></h4>
              <ul className={styles.list}>
                {grupo.itens.map((localidade) => (
                  <li key={localidade.id} className={styles.item}>
                    <span className={styles.name}>{localidade.nome}</span>
                    <div className={styles.itemActions}>
                      <button type="button" className={styles.secondaryButton} onClick={() => iniciarEdicao(localidade)} disabled={saving}>
                        Editar
                      </button>
                      <button type="button" className={styles.deactivateButton} onClick={() => void handleDesativar(localidade)} disabled={saving}>
                        Desativar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className={styles.note}>Desativar não apaga a localidade nem altera solicitações já registradas.</p>
    </section>
  )
}
