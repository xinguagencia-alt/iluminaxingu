import { useState, useEffect, Component, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RequestForm } from './components/RequestForm/RequestForm'
import { SolicitacaoList } from './components/SolicitacaoList/SolicitacaoList'
import { PosteList } from './components/PosteList/PosteList'
import { PosteForm } from './components/PosteForm/PosteForm'
import { Poste } from './components/PosteForm/types'
import { LoginForm } from './components/LoginForm/LoginForm'
import { BootstrapForm } from './components/BootstrapForm/BootstrapForm'
import { Dashboard } from './components/Dashboard/Dashboard'
import { OrdemServicoList } from './components/OrdemServicoList/OrdemServicoList'
import { OrdemServicoDetail } from './components/OrdemServicoDetail/OrdemServicoDetail'
import { EquipeList } from './components/EquipeList/EquipeList'
import { SolicitacaoPublica } from './components/SolicitacaoPublica/SolicitacaoPublica'
import { UserManagement } from './components/UserManagement/UserManagement'
import { LogradouroManager } from './components/LogradouroManager/LogradouroManager'
import { AdminPanel } from './components/AdminPanel/AdminPanel'
import { MapaPostes } from './components/MapaPostes/MapaPostes'

type Page = 'home' | 'consultar' | 'dashboard' | 'admin' | 'postes' | 'postes-novo' | 'postes-editar' | 'ordens' | 'ordem-detail' | 'equipes' | 'usuarios' | 'logradouros' | 'sistema' | 'mapa'

function usePathname() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    function onPopState() {
      setPath(window.location.pathname)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return path
}

class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626' }}>Algo deu errado</h2>
          <p style={{ color: '#6b7280' }}>{this.state.error.message}</p>
          <button
            onClick={() => {
              this.setState({ error: null })
              this.props.onReset?.()
            }}
            style={{
              marginTop: 16, padding: '10px 20px', background: '#f59e0b',
              color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function PublicLayout() {
  const [currentPage, setCurrentPage] = useState<'home' | 'consultar'>('home')

  return (
    <div className="app">
      <header className="header">
        <h1>IluminaXingu</h1>
        <p>Registro de Solicitação de Iluminação Pública</p>
        <nav className="nav">
          <button
            className={`navButton ${currentPage === 'home' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('home')}
          >
            Nova Solicitacao
          </button>
          <button
            className={`navButton ${currentPage === 'consultar' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('consultar')}
          >
            Consultar Protocolo
          </button>
        </nav>
      </header>
      <main className="main">
        {currentPage === 'home' && <RequestForm />}
        {currentPage === 'consultar' && (
          <SolicitacaoPublica onVoltar={() => setCurrentPage('home')} />
        )}
      </main>
      <footer className="footer">
        <img src="/logo.png" alt="Xingu Marketing & Publicidade" className="footerLogo" />
      </footer>
    </div>
  )
}

function AdminLayout() {
  const { user, logout, loading, needsBootstrap, token } = useAuth()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [selectedOrdemId, setSelectedOrdemId] = useState<number | null>(null)
  const [editingPoste, setEditingPoste] = useState<Poste | null>(null)

  function handleLogout() {
    logout()
    setCurrentPage('dashboard')
  }

  if (loading) {
    return (
      <div className="app">
        <header className="header">
          <h1>IluminaXingu</h1>
          <p>Painel Administrativo</p>
        </header>
        <main className="main">
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Carregando...</p>
        </main>
      </div>
    )
  }

  if (needsBootstrap) {
    return (
      <div className="app">
        <header className="header">
          <h1>IluminaXingu</h1>
          <p>Painel Administrativo</p>
        </header>
        <main className="main">
          <BootstrapForm />
        </main>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app">
        <header className="header">
          <h1>IluminaXingu</h1>
          <p>Painel Administrativo</p>
        </header>
        <main className="main">
          <LoginForm />
        </main>
        <footer className="footer">
          <img src="/logo.png" alt="Xingu Marketing & Publicidade" className="footerLogo" />
        </footer>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>IluminaXingu</h1>
        <p>Painel Administrativo</p>
        <nav className="nav">
          <button
            className={`navButton ${currentPage === 'dashboard' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            Painel
          </button>
          <button
            className={`navButton ${currentPage === 'admin' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('admin')}
          >
            Solicitacoes
          </button>
          <button
            className={`navButton ${currentPage === 'postes' || currentPage === 'postes-novo' || currentPage === 'postes-editar' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('postes')}
          >
            Postes
          </button>
          <button
            className={`navButton ${currentPage === 'ordens' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('ordens')}
          >
            Ordens
          </button>
          <button
            className={`navButton ${currentPage === 'equipes' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('equipes')}
          >
            Equipes
          </button>
          <button
            className={`navButton ${currentPage === 'logradouros' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('logradouros')}
          >
            Logradouros
          </button>
          <button
            className={`navButton ${currentPage === 'mapa' ? 'navButtonActive' : ''}`}
            onClick={() => setCurrentPage('mapa')}
          >
            Mapa
          </button>
          {user.perfil === 'admin' && (
            <button
              className={`navButton ${currentPage === 'usuarios' ? 'navButtonActive' : ''}`}
              onClick={() => setCurrentPage('usuarios')}
            >
              Usuarios
            </button>
          )}
          {user.perfil === 'admin' && (
            <button
              className={`navButton ${currentPage === 'sistema' ? 'navButtonActive' : ''}`}
              onClick={() => setCurrentPage('sistema')}
            >
              Sistema
            </button>
          )}
          <div className="userInfo">
            <span className="userName">{user.nomeCompleto}</span>
            <button className="navButton" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </nav>
      </header>
      <main className="main">
        <ErrorBoundary key={currentPage} onReset={() => setCurrentPage('dashboard')}>
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'admin' && <SolicitacaoList />}
          {currentPage === 'ordens' && (
            <OrdemServicoList
              onDetalhes={(id) => {
                setSelectedOrdemId(id)
                setCurrentPage('ordem-detail')
              }}
            />
          )}
          {currentPage === 'ordem-detail' && selectedOrdemId && (
            <OrdemServicoDetail
              ordemId={selectedOrdemId}
              onVoltar={() => {
                setSelectedOrdemId(null)
                setCurrentPage('ordens')
              }}
            />
          )}
          {currentPage === 'equipes' && <EquipeList />}
          {currentPage === 'usuarios' && user.perfil === 'admin' && <UserManagement />}
          {currentPage === 'sistema' && user.perfil === 'admin' && <AdminPanel />}
          {currentPage === 'logradouros' && <LogradouroManager />}
          {currentPage === 'mapa' && <MapaPostes />}
          {currentPage === 'postes' && (
            <PosteList
              onNovoPoste={() => setCurrentPage('postes-novo')}
              onEditar={(poste) => {
                setEditingPoste(poste)
                setCurrentPage('postes-editar')
              }}
            />
          )}
          {currentPage === 'postes-novo' && (
            <PosteForm
              token={token!}
              onSaved={() => setCurrentPage('postes')}
              onCancel={() => setCurrentPage('postes')}
            />
          )}
          {currentPage === 'postes-editar' && editingPoste && (
            <PosteForm
              token={token!}
              editId={editingPoste.id}
              initialData={{
                codigo: editingPoste.codigo,
                rua: editingPoste.rua || '',
                numero: editingPoste.numero || '',
                bairro: editingPoste.bairro || '',
                complemento: editingPoste.complemento || '',
                latitude: editingPoste.latitude != null ? String(editingPoste.latitude) : '',
                longitude: editingPoste.longitude != null ? String(editingPoste.longitude) : '',
                tipo_luminaria: editingPoste.tipo_luminaria || '',
                potencia: editingPoste.potencia != null ? String(editingPoste.potencia) : '',
                data_instalacao: editingPoste.data_instalacao || '',
              }}
              submitLabel="Salvar Alteracoes"
              onSaved={() => {
                setEditingPoste(null)
                setCurrentPage('postes')
              }}
              onCancel={() => {
                setEditingPoste(null)
                setCurrentPage('postes')
              }}
            />
          )}
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <img src="/logo.png" alt="Xingu Marketing & Publicidade" className="footerLogo" />
      </footer>
    </div>
  )
}

function AppRoutes() {
  const path = usePathname()

  if (path.startsWith('/prefeitura')) {
    return <AdminLayout />
  }

  return <PublicLayout />
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App




