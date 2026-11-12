import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { API_URL } from './config/api'
import { definirApiBaseUrl } from './offline/sync'
import './styles/global.css'

definirApiBaseUrl(API_URL)

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
