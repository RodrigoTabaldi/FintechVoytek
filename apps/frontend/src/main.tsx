import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppRoot from './app/AppRoot'
import './styles/index.css'
import './styles/agent-search.css'
import './styles/redesign.css'
import './styles/redesign-v2.css'
import './styles/scale.css'
import './styles/usability.css'
import './styles/login.css'
import './styles/voytek-app.css'
import './styles/dashboard-model.css'
import './styles/workspace-theme.css'
import './styles/home-reference.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
)
