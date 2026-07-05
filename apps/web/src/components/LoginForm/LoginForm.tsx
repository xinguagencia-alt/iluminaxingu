import { useState, FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import styles from './LoginForm.module.css'

export function LoginForm() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const success = await login(username, password)
    if (!success) setError('Credenciais invalidas')
    setLoading(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>Acesso restrito</span>
          <h2>Login administrativo</h2>
          <p>Entre com o usuario da prefeitura para acompanhar solicitacoes, ordens, postes e configuracoes internas.</p>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="username">Usuario</label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Seu usuario" required />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" required />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button} disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}
