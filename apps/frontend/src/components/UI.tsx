import type { ReactNode } from 'react'

export function PageHeading({
  title,
  description,
  eyebrow = 'VOYTEK',
  action,
}: {
  title: string
  description: string
  eyebrow?: string
  action?: ReactNode
}) {
  return (
    <header className="v-page-heading">
      <div>
        <p className="v-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="v-muted">{description}</p>
      </div>
      {action && <div className="v-heading-action">{action}</div>}
    </header>
  )
}

export function Panel({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={'v-panel ' + className}>
      <div className="v-panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p className="v-muted">{description}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="v-empty-state">
      {icon ? <span className="v-empty-icon" aria-hidden="true">{icon}</span> : <span className="v-empty-mark" aria-hidden="true">V</span>}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'error' | 'success' | 'warning'
}) {
  return <div className={'v-notice is-' + tone} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

export function Status({ value }: { value: string | number | boolean | null | undefined }) {
  const normalized = String(value ?? 'indefinido').toLowerCase()
  const positive = ['active', 'ativo', 'approved', 'aprovado', 'allow', 'aprovado', 'true', '1'].includes(normalized)
  const negative = ['disabled', 'rejected', 'rejeitado', 'deny', 'bloqueado', 'false', '2'].includes(normalized)
  return <span className={'v-status' + (positive ? ' is-positive' : negative ? ' is-negative' : '')}>{formatStatus(value)}</span>
}

export function formatStatus(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return 'Indefinido'
  const numericLabels: Record<number, string> = {
    0: 'Pendente',
    1: 'Aprovado',
    2: 'Rejeitado',
    3: 'Expirado',
    4: 'Cancelado',
  }
  if (typeof value === 'number') return numericLabels[value] ?? String(value)
  if (typeof value === 'boolean') return value ? 'Ativo' : 'Inativo'
  const labels: Record<string, string> = {
    active: 'Ativo',
    approved: 'Aprovado',
    allow: 'Permitido',
    autonomous: 'Autônomo',
    cancelled: 'Cancelado',
    completed: 'Concluído',
    deny: 'Negado',
    disabled: 'Desativado',
    draft: 'Rascunho',
    humanapproval: 'Aprovação humana',
    manual: 'Manual',
    pending: 'Pendente',
    rejected: 'Rejeitado',
    supervised: 'Supervisionado',
    suspended: 'Suspenso',
  }
  return labels[value.toLowerCase()] ?? value
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="v-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="v-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-modal="true" className="v-modal" role="dialog" aria-labelledby="v-modal-title">
        <div className="v-modal-header">
          <div>
            <h2 id="v-modal-title">{title}</h2>
            {description && <p className="v-muted">{description}</p>}
          </div>
          <button aria-label="Fechar" className="v-icon-button" onClick={onClose} type="button">×</button>
        </div>
        {children}
      </section>
    </div>
  )
}
