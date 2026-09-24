import { useState, type FormEvent } from 'react'
import { saveSession, voytekApi } from '../../api'

type AuthPageProps = { onAuthenticated: () => void }

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

function passwordIssue(password: string) {
  if (password.length < 12) return 'Use pelo menos 12 caracteres.'
  if (!/[a-z]/.test(password)) return 'Inclua pelo menos uma letra minúscula.'
  if (!/[A-Z]/.test(password)) return 'Inclua pelo menos uma letra maiúscula.'
  if (!/[0-9]/.test(password)) return 'Inclua pelo menos um número.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Inclua pelo menos um símbolo, como ! ou @.'
  return ''
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [register, setRegister] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationSlug, setOrganizationSlug] = useState('')
  const [customSlug, setCustomSlug] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedSlug = slugify(organizationSlug)
    if (register) {
      if (!organizationName.trim()) {
        setError('Informe o nome da organização.')
        return
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
        setError('O slug deve conter letras sem acento, números e hífens simples.')
        return
      }
      const issue = passwordIssue(password)
      if (issue) {
        setError('A senha não atende aos requisitos. ' + issue)
        return
      }
    }
    if (!normalizedEmail || !password) {
      setError('Informe seu e-mail e sua senha.')
      return
    }

    setBusy(true)
    try {
      const session = register
        ? await voytekApi.register({
            email: normalizedEmail,
            password,
            organizationName: organizationName.trim(),
            organizationSlug: normalizedSlug,
          })
        : await voytekApi.login({ email: normalizedEmail, password })
      saveSession(session, normalizedEmail)
      onAuthenticated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível autenticar sua conta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-layout">
        <section className="auth-visual" aria-label="Identidade visual Voytek">
          <div className="auth-visual-brand">VOYTEK / CONTROL</div>
          <div className="auth-visual-placeholder" aria-hidden="true">
            <span>VOYTEK</span>
            <small>Agentes com limites. Ações com controle.</small>
          </div>
        </section>
        <img className="auth-mobile-bear" src="/brand/mobile-bear.png" alt="" aria-hidden="true" />

        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-form-brand">
            <div className="brand">
              <img src="/brand/voytek-logo.png" alt="Voytek" />
            </div>
          </div>
          <p className="eyebrow">{register ? 'CRIE SUA CONTA' : 'BEM-VINDO DE VOLTA'}</p>
          <h1>{register ? 'Comece sua operação.' : 'Acesse seu controle.'}</h1>
          <p className="muted">
            {register
              ? 'Crie sua organização e defina limites claros para seus agentes.'
              : 'Entre para acompanhar agentes, permissões e decisões.'}
          </p>

          <button
            className="google-button"
            type="button"
            onClick={() => setMessage('A autenticação com Google ainda não está configurada. Use seu e-mail.')}
          >
            <span aria-hidden="true">G</span>
            Continuar com Google
          </button>
          <div className="auth-divider"><span>ou continue com e-mail</span></div>

          {register && (
            <>
              <label className="field">
                Organização
                <input
                  autoComplete="organization"
                  maxLength={200}
                  required
                  value={organizationName}
                  onChange={event => {
                    const value = event.target.value
                    setOrganizationName(value)
                    if (!customSlug) setOrganizationSlug(slugify(value))
                  }}
                  placeholder="Nome da organização"
                />
              </label>
              <label className="field">
                Slug
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  maxLength={100}
                  required
                  spellCheck={false}
                  value={organizationSlug}
                  onChange={event => {
                    setCustomSlug(true)
                    setOrganizationSlug(event.target.value)
                  }}
                  placeholder="minha-organizacao"
                />
              </label>
            </>
          )}

          <label className="field">
            E-mail
            <input
              autoCapitalize="none"
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="voce@empresa.com"
            />
          </label>
          <label className="field">
            Senha
            <input
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={register ? 12 : 1}
              required
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={register ? 'Use uma senha forte' : 'Sua senha'}
              aria-describedby={register ? 'password-requirements' : undefined}
            />
          </label>
          {register && (
            <p className="auth-field-hint" id="password-requirements">
              No mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.
            </p>
          )}
          {!register && (
            <button
              className="auth-recovery"
              type="button"
              onClick={() => setMessage('A recuperação de senha ainda não está disponível na API.')}
            >
              Esqueci minha senha
            </button>
          )}
          {error && <p className="form-error" role="alert" aria-live="polite">{error}</p>}
          {message && <p className="auth-info" role="status" aria-live="polite">{message}</p>}
          <button className="primary-button auth-submit" disabled={busy} type="submit">
            {busy ? 'Processando...' : register ? 'Criar organização' : 'Entrar'}
          </button>
          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setRegister(!register)
              setError('')
              setMessage('')
              setPassword('')
            }}
          >
            {register ? 'Já tenho uma conta' : 'Criar uma organização'}
          </button>
          <p className="auth-terms">Ao continuar, você concorda com os Termos e a Política de Privacidade.</p>
        </form>
      </div>
    </main>
  )
}
