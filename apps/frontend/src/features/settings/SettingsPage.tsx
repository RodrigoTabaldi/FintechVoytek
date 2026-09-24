import { useState, type FormEvent } from 'react'
import { voytekApi, type CreatedApiCredential } from '../../api'
import { EmptyState, Field, Modal, Notice, PageHeading, Panel } from '../../components/UI'
import type { SharedPageProps } from '../../app/types'

export default function SettingsPage({ data, errors, loading, canAdmin, onRefresh, notify }: SharedPageProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [createdCredential, setCreatedCredential] = useState<CreatedApiCredential | null>(null)
  const [working, setWorking] = useState('')
  const email = localStorage.getItem('voytek.email') ?? 'E-mail não informado'
  const membershipRaw = localStorage.getItem('voytek.memberships')
  const membership = membershipRaw ? safeMembership(membershipRaw) : null

  async function create(name: string) {
    const credential = await voytekApi.createApiCredential(name)
    setCreatedCredential(credential)
    await onRefresh()
    notify('Credencial criada. Copie o segredo agora; ele não será salvo no navegador.')
  }

  async function revoke(id: string) {
    if (!window.confirm('Revogar esta credencial? Sistemas que usam essa chave perderão acesso.')) return
    setWorking(id)
    try {
      await voytekApi.revokeApiCredential(id)
      await onRefresh()
      notify('Credencial revogada.')
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Não foi possível revogar a credencial.', 'error')
    } finally {
      setWorking('')
    }
  }

  async function copySecret() {
    if (!createdCredential) return
    try {
      await navigator.clipboard.writeText(createdCredential.secret)
      notify('Segredo copiado para a área de transferência.')
    } catch {
      notify('Não foi possível copiar automaticamente. Selecione e copie o segredo exibido.', 'warning')
    }
  }

  return <div className="v-page">
    <PageHeading title="Credenciais de API" description="Gerencie chaves de integração da organização. O backend guarda apenas o hash da chave." action={canAdmin && <button className="v-primary-button" onClick={() => setFormOpen(true)} type="button">Criar credencial</button>} />
    {!canAdmin && <Notice tone="info">Apenas Owner e Admin podem administrar credenciais de API.</Notice>}
    <div className="v-settings-facts">
      <Panel title="Conta autenticada"><p>{email}</p><small className="v-muted">ID de usuário: {localStorage.getItem('voytek.userId') ?? 'indisponível'}</small></Panel>
      <Panel title="Organização selecionada"><p>{membership?.role ?? 'Associação não carregada'}</p><small className="v-muted">Tenant ID: {membership?.tenantId ?? 'indisponível'}</small></Panel>
    </div>
    <Notice tone="warning">O segredo completo aparece somente uma vez. Copie e armazene em um cofre seguro; não o compartilhe nem o coloque no frontend da sua aplicação.</Notice>
    {errors.apiCredentials && <Notice tone="error">{errors.apiCredentials}</Notice>}
    <Panel title="Chaves de integração" description="A listagem não retorna segredos; você verá apenas o prefixo identificador.">
      {loading && data.apiCredentials.length === 0 ? <div className="v-loading-line">Carregando credenciais…</div> : errors.apiCredentials ? <EmptyState title="Credenciais indisponíveis" description="O usuário atual talvez não tenha papel Owner ou Admin, ou a API não respondeu." /> : data.apiCredentials.length === 0 ? <EmptyState title="Nenhuma credencial criada" description="Crie uma chave para integrar um agente ou sistema permitido pela organização." action={canAdmin && <button className="v-secondary-button" onClick={() => setFormOpen(true)} type="button">Criar credencial</button>} /> : (
        <div className="v-table-wrap"><table className="v-table"><thead><tr><th>Nome</th><th>Prefixo</th><th>Criada em</th><th>Status</th>{canAdmin && <th />}</tr></thead>
          <tbody>{data.apiCredentials.map(credential => <tr key={credential.id}><td>{credential.name}</td><td><code>{credential.prefix}…</code></td><td>{new Date(credential.createdAtUtc).toLocaleString('pt-BR')}</td><td>{credential.revokedAtUtc ? 'Revogada' : 'Ativa'}</td>{canAdmin && <td>{!credential.revokedAtUtc && <button className="v-row-action-danger" disabled={working === credential.id} onClick={() => void revoke(credential.id)} type="button">Revogar</button>}</td>}</tr>)}</tbody>
        </table></div>
      )}
    </Panel>
    {createdCredential && <Modal title="Copie o segredo da credencial" description="Por segurança, o segredo ficará disponível somente enquanto esta janela estiver aberta." onClose={() => setCreatedCredential(null)}>
      <div className="v-created-secret">
        <Notice tone="warning">Não feche esta janela antes de guardar a chave em um gerenciador de segredos seguro.</Notice>
        <label className="v-field"><span>Segredo completo</span><textarea aria-label="Segredo completo da credencial" readOnly rows={3} value={createdCredential.secret} onFocus={event => event.target.select()} /></label>
        <div className="v-form-actions"><button className="v-secondary-button" onClick={() => setCreatedCredential(null)} type="button">Fechar</button><button className="v-primary-button" onClick={() => void copySecret()} type="button">Copiar segredo</button></div>
      </div>
    </Modal>}
    {formOpen && <Modal title="Criar credencial de API" description="O valor integral será retornado uma única vez." onClose={() => setFormOpen(false)}>
      <CredentialForm onSubmit={create} onCancel={() => setFormOpen(false)} />
    </Modal>}
  </div>
}

function safeMembership(value: string) {
  try {
    const entries = JSON.parse(value) as { tenantId: string; role: string }[]
    return entries[0] ?? null
  } catch {
    return null
  }
}

function CredentialForm({ onSubmit, onCancel }: { onSubmit: (name: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return setError('Informe um nome para reconhecer esta integração.')
    setBusy(true)
    setError('')
    try {
      await onSubmit(name.trim())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a credencial.')
    } finally {
      setBusy(false)
    }
  }
  return <form className="v-form-stack" onSubmit={submit}>
    <Field label="Nome da integração"><input maxLength={150} required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Agente de compras" /></Field>
    {error && <p className="v-form-error" role="alert">{error}</p>}
    <div className="v-form-actions"><button className="v-secondary-button" onClick={onCancel} type="button">Cancelar</button><button className="v-primary-button" disabled={busy} type="submit">{busy ? 'Criando…' : 'Criar e revelar segredo'}</button></div>
  </form>
}
