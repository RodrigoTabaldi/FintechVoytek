import { useEffect, useState } from 'react'
import { clearSession, hasSession, SESSION_EXPIRED_EVENT } from '../api'
import AuthPage from '../features/auth/AuthPage'
import Workspace from './Workspace'

export default function AppRoot() {
  const [authenticated, setAuthenticated] = useState(hasSession)

  useEffect(() => {
    const handleSessionExpired = () => setAuthenticated(false)
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

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
