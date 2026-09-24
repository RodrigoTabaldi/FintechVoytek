import { useState } from 'react'
import { clearSession, hasSession } from '../api'
import AuthPage from '../features/auth/AuthPage'
import Workspace from './Workspace'

export default function AppRoot() {
  const [authenticated, setAuthenticated] = useState(hasSession)

  if (!authenticated) {
    return <AuthPage onAuthenticated={() => setAuthenticated(true)} />
  }

  return (
    <Workspace
      onLogout={() => {
        clearSession()
        setAuthenticated(false)
      }}
    />
  )
}
