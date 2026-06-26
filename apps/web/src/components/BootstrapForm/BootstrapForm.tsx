import { useState, FormEvent } from 'react'
import { API_URL } from '../../config/api'
import styles from './BootstrapForm.module.css'

export function BootstrapForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          nomeCompleto,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao criar administrador')
        setLoading(false)
        return
      }

      localStorage.setItem('token', data.token)
      setSuccess(true)

      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch {
      setError('Erro ao conectar com o servidor')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.success}>
          <h2>Administrador criado com sucesso!</h2>
          <p>Redirecionando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2>Configuracao Inicial</h2>
        <p className={styles.subtitle}>
          Crie o primeiro administrador do sistema.
          <br />
          Esta tela so aparece quando nao existe nenhum administrador cadastrado.
        </p>

        <div className={styles.field}>
          <label htmlFor="nomeCompleto">Nome completo</label>
          <input
            id="nomeCompleto"
            type="text"
            value={nomeCompleto}
            onChange={(e) => setNomeCompleto(e.target.value)}
            placeholder="Seu nome completo"
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Seu usuario de login"
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 6 caracteres"
            minLength={6}
            required
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? 'Criando...' : 'Criar Administrador'}
        </button>
      </form>
    </div>
  )
}
