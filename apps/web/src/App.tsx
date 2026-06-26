import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RequestForm } from './components/RequestForm/RequestForm'
import { SolicitacaoList } from './components/SolicitacaoList/SolicitacaoList'
import { PosteList } from './components/PosteList/PosteList'
import { PosteForm } from './components/PosteForm/PosteForm'
import { LoginForm } from './components/LoginForm/LoginForm'
import { BootstrapForm } from './components/BootstrapForm/BootstrapForm'
import { Dashboard } from './components/Dashboard/Dashboard'
import { OrdemServicoList } from './components/OrdemServicoList/OrdemServicoList'
import { OrdemServicoDetail } from './components/OrdemServicoDetail/OrdemServicoDetail'
import { EquipeList } from './components/EquipeList/EquipeList'
import { SolicitacaoPublica } from './components/SolicitacaoPublica/SolicitacaoPublica'

type Page = 'home' | 'consultar' | 'dashboard' | 'admin' | 'postes' | 'postes-novo' | 'ordens' | 'ordem-detail' | 'equipes'

function AppContent() {
  const { user, logout, loading, needsBootstrap, token } = useAuth()
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [selectedOrdemId, setSelectedOrdemId] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="app">
        <header className="header">
          <h1>IluminaXingu</h1>
          <p>Registro de Solicitação de Iluminação Pública</p>
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
          <p>Registro de Solicitação de Iluminação Pública</p>
        </header>
        <main className="main">
          <BootstrapForm />
        </main>
      </div>
    )
  }

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
          {!user && (
            <button
              className={`navButton ${currentPage === 'dashboard' ? 'navButtonActive' : ''}`}
              onClick={() => setCurrentPage('dashboard')}
            >
              Acesso Prefeitura
            </button>
          )}
          {user && (
            <>
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
                className={`navButton ${currentPage === 'postes' || currentPage === 'postes-novo' ? 'navButtonActive' : ''}`}
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
            </>
          )}
          {user && (currentPage === 'admin' || currentPage === 'postes' || currentPage === 'postes-novo' || currentPage === 'dashboard' || currentPage === 'ordens' || currentPage === 'equipes' || currentPage === 'ordem-detail') && (
            <div className="userInfo">
              <span className="userName">{user.nomeCompleto}</span>
              <button className="navButton" onClick={logout}>
                Sair
              </button>
            </div>
          )}
        </nav>
      </header>
      <main className="main">
        {currentPage === 'home' && <RequestForm />}
        {currentPage === 'consultar' && (
          <SolicitacaoPublica onVoltar={() => setCurrentPage('home')} />
        )}
        {currentPage === 'dashboard' && (user ? <Dashboard /> : <LoginForm />)}
        {currentPage === 'admin' && (user ? <SolicitacaoList /> : <LoginForm />)}
        {currentPage === 'ordens' && user && (
          <OrdemServicoList
            onDetalhes={(id) => {
              setSelectedOrdemId(id)
              setCurrentPage('ordem-detail')
            }}
          />
        )}
        {currentPage === 'ordem-detail' && user && selectedOrdemId && (
          <OrdemServicoDetail
            ordemId={selectedOrdemId}
            onVoltar={() => {
              setSelectedOrdemId(null)
              setCurrentPage('ordens')
            }}
          />
        )}
        {currentPage === 'equipes' && (user ? <EquipeList /> : <LoginForm />)}
        {currentPage === 'postes' && user && (
          <PosteList onNovoPoste={() => setCurrentPage('postes-novo')} />
        )}
        {currentPage === 'postes-novo' && user && (
          <PosteForm
            token={token!}
            onSaved={() => setCurrentPage('postes')}
            onCancel={() => setCurrentPage('postes')}
          />
        )}
      </main>
      <footer className="footer">
        <img src="/logo.png" alt="Xingu Marketing & Publicidade" className="footerLogo" />
      </footer>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
