const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
export const API_BASE_URL = configuredApiUrl
  ? configuredApiUrl.replace(/\/$/, '')
  : 'http://localhost:8080'
export const SESSION_EXPIRED_EVENT = 'voytek:session-expired'

export type Membership = { tenantId: string; role: string }
export type AuthResponse = {
  accessToken: string
  userId: string
  memberships: Membership[]
}

export type Agent = {
  id: string
  name: string
  description: string | null
  status: string
  autonomyLevel: string
  specialization: string
  createdAtUtc: string
  updatedAtUtc: string
  killSwitchActivatedAtUtc: string | null
}

export type Objective = {
  id: string
  agentId: string
  name: string
  description: string | null
  status: string
  startDate: string
  endDate: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

export type Budget = {
  id: string
  agentId: string
  objectiveId: string | null
  name: string
  totalAmount: number
  reservedAmount: number
  spentAmount: number
  availableAmount: number
  currency: string
  status: string
}

export type Policy = {
  id: string
  agentId: string
  name: string
  actionType: string
  maximumAmount: number | null
  approvalThreshold: number | null
  isActive: boolean
}

export type Approval = {
  id: string
  authorizationRequestId: string
  status: string | number
  createdAtUtc: string
  decidedAtUtc?: string | null
  decidedByUserId?: string | null
}

export type AuthorizationResult = {
  id: string
  decision: string
  decisionReason: string
  decidedAtUtc: string
}

export type ShadowAction = {
  id: string
  authorizationRequestId: string
  decision: string | number
  createdAtUtc: string
}

export type LedgerEntry = {
  id: string
  agentId: string
  objectiveId: string
  budgetId: string
  authorizationId: string
  amount: number
  currency: string
  type: string | number
  correlationId: string
  createdAtUtc: string
}

export type AuditEvent = {
  id: string
  actorUserId: string | null
  action: string
  resourceType: string
  resourceId: string
  correlationId: string
  createdAtUtc: string
}

export type Outcome = {
  id: string
  agentId: string
  objectiveId: string
  authorizationId: string | null
  metric: string
  value: number
  unit: string
  description: string | null
  createdAtUtc: string
}

export type SaasSubscription = {
  id: string
  agentId: string | null
  provider: string
  productName: string
  monthlyCost: number
  currency: string
  purchasedSeats: number
  activeUsers: number
  renewalDate: string | null
  status: string | number
  createdAtUtc: string
}

export type SaasRecommendation = {
  id: string
  subscriptionId: string
  type: string | number
  reason: string
  createdAtUtc: string
}

export type ApiCredential = {
  id: string
  name: string
  prefix: string
  createdAtUtc: string
  revokedAtUtc: string | null
}

export type CreatedApiCredential = ApiCredential & { secret: string }

type RequestOptions = RequestInit & { auth?: boolean }
type ApiProblem = {
  title?: string
  detail?: string
  message?: string
  errors?: Record<string, string[]>
}

const knownValidationMessages: Record<string, string> = {
  PasswordTooShort: 'A senha precisa ter pelo menos 12 caracteres.',
  PasswordRequiresDigit: 'A senha precisa incluir pelo menos um número.',
  PasswordRequiresLower: 'A senha precisa incluir uma letra minúscula.',
  PasswordRequiresUpper: 'A senha precisa incluir uma letra maiúscula.',
  PasswordRequiresNonAlphanumeric: 'A senha precisa incluir um símbolo, como ! ou @.',
  DuplicateEmail: 'Este e-mail já está cadastrado. Tente entrar na sua conta.',
  DuplicateUserName: 'Este e-mail já está cadastrado. Tente entrar na sua conta.',
}

function describeProblem(problem: ApiProblem | null, status: number): string {
  if (problem?.detail) return problem.detail
  if (problem?.message) return problem.message

  const validationMessages = Object.entries(problem?.errors ?? {}).flatMap(([key, messages]) =>
    messages.map(message => knownValidationMessages[key] ?? message),
  )
  if (validationMessages.length > 0) return Array.from(new Set(validationMessages)).join(' ')
  if (status === 401) return 'Credenciais inválidas ou sessão expirada. Confira o e-mail e a senha; se já estiver conectado, entre novamente.'
  if (status === 403) return 'Seu papel na organização não permite esta ação.'

  return problem?.title ?? 'Não foi possível concluir a solicitação (erro ' + status + ').'
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = options.auth === false ? null : localStorage.getItem('voytek.accessToken')
  if (token) headers.set('Authorization', 'Bearer ' + token)

  let response: Response
  try {
    response = await fetch(API_BASE_URL + path, { ...options, headers })
  } catch {
    throw new Error('A API Voytek não respondeu em ' + API_BASE_URL + '. Confira se ela está ativa e se a URL está correta.')
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSession()
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    const problem = await response.json().catch(() => null) as ApiProblem | null
    throw new Error(describeProblem(problem, response.status))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const voytekApi = {
  register: (payload: { email: string; password: string; organizationName: string; organizationSlug: string }) =>
    request<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
    }),

  login: async (payload: { email: string; password: string }) => {
    const session = await request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
    })
    const membership = session.memberships[0]
    if (!membership) {
      throw new Error('Esta conta ainda não está vinculada a uma organização Voytek.')
    }

    localStorage.setItem('voytek.accessToken', session.accessToken)
    try {
      return await request<AuthResponse>('/api/v1/auth/select-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenantId: membership.tenantId }),
      })
    } catch (error) {
      clearSession()
      throw error
    }
  },

  listAgents: () => request<Agent[]>('/api/v1/agents'),
  createAgent: (payload: {
    name: string
    description: string
    autonomyLevel: number
    specialization: string
    objectiveName: string
    objectiveDescription: string
  }) => request<Agent>('/api/v1/agents', { method: 'POST', body: JSON.stringify(payload) }),
  updateAgent: (agentId: string, payload: { name: string; description: string; autonomyLevel: number }) =>
    request<Agent>('/api/v1/agents/' + agentId, { method: 'PUT', body: JSON.stringify(payload) }),
  changeAgentState: (agentId: string, action: 'activate' | 'suspend' | 'disable' | 'kill-switch/activate' | 'kill-switch/deactivate') =>
    request<Agent>('/api/v1/agents/' + agentId + '/' + action, { method: 'POST' }),
  generateProposal: (agentId: string, instruction: string) =>
    request<Record<string, unknown>>('/api/v1/agents/' + agentId + '/proposals', {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }),

  listObjectives: () => request<Objective[]>('/api/v1/objectives'),
  createObjective: (payload: { agentId: string; name: string; description: string; startDate: string; endDate?: string | null }) =>
    request<Objective>('/api/v1/objectives', { method: 'POST', body: JSON.stringify(payload) }),
  updateObjective: (id: string, payload: { name: string; description: string; startDate: string; endDate?: string | null }) =>
    request<Objective>('/api/v1/objectives/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
  changeObjectiveState: (id: string, action: 'activate' | 'complete') =>
    request<Objective>('/api/v1/objectives/' + id + '/' + action, { method: 'POST' }),

  listBudgets: () => request<Budget[]>('/api/v1/budgets'),
  createBudget: (payload: { agentId: string; objectiveId: string | null; name: string; totalAmount: number; currency: string }) =>
    request<Budget>('/api/v1/budgets', { method: 'POST', body: JSON.stringify(payload) }),
  closeBudget: (id: string) => request<Budget>('/api/v1/budgets/' + id + '/close', { method: 'POST' }),

  listPolicies: () => request<Policy[]>('/api/v1/policies'),
  createPolicy: (payload: {
    agentId: string
    name: string
    actionType: string
    maximumAmount: number | null
    approvalThreshold: number | null
  }) => request<Policy>('/api/v1/policies', { method: 'POST', body: JSON.stringify(payload) }),
  deactivatePolicy: (id: string) => request<Policy>('/api/v1/policies/' + id + '/deactivate', { method: 'POST' }),

  authorize: (payload: {
    agentId: string
    objectiveId: string
    budgetId: string
    actionType: string
    amount: number
    currency: string
    purpose: string
    idempotencyKey: string
    shadowMode: boolean
  }) => request<AuthorizationResult>('/api/v1/authorizations', { method: 'POST', body: JSON.stringify(payload) }),
  listApprovals: () => request<Approval[]>('/api/v1/approvals'),
  approveApproval: (id: string) => request<Approval>('/api/v1/approvals/' + id + '/approve', { method: 'POST' }),
  rejectApproval: (id: string) => request<Approval>('/api/v1/approvals/' + id + '/reject', { method: 'POST' }),
  listShadowActions: () => request<ShadowAction[]>('/api/v1/shadow'),
  listLedger: () => request<LedgerEntry[]>('/api/v1/ledger'),
  listAudit: () => request<AuditEvent[]>('/api/v1/audit'),

  listOutcomes: () => request<Outcome[]>('/api/v1/outcomes'),
  createOutcome: (payload: {
    agentId: string
    objectiveId: string
    authorizationId: string | null
    metric: string
    value: number
    unit: string
    description: string
  }) => request<Outcome>('/api/v1/outcomes', { method: 'POST', body: JSON.stringify(payload) }),

  listSaasSubscriptions: () => request<SaasSubscription[]>('/api/v1/saas-subscriptions'),
  createSaasSubscription: (payload: {
    agentId: string | null
    provider: string
    productName: string
    monthlyCost: number
    currency: string
    purchasedSeats: number
    activeUsers: number
    renewalDate: string | null
  }) => request<SaasSubscription>('/api/v1/saas-subscriptions', { method: 'POST', body: JSON.stringify(payload) }),
  analyzeSaasSubscriptions: () =>
    request<SaasRecommendation[]>('/api/v1/saas-subscriptions/analyze', { method: 'POST' }),

  listApiCredentials: () => request<ApiCredential[]>('/api/v1/api-credentials'),
  createApiCredential: (name: string) =>
    request<CreatedApiCredential>('/api/v1/api-credentials/' + encodeURIComponent(name), { method: 'POST' }),
  revokeApiCredential: (id: string) =>
    request<void>('/api/v1/api-credentials/' + id + '/revoke', { method: 'POST' }),
}

export function saveSession(session: AuthResponse, email: string) {
  localStorage.setItem('voytek.accessToken', session.accessToken)
  localStorage.setItem('voytek.userId', session.userId)
  localStorage.setItem('voytek.memberships', JSON.stringify(session.memberships))
  localStorage.setItem('voytek.email', email.trim().toLowerCase())
}

export function clearSession() {
  localStorage.removeItem('voytek.accessToken')
  localStorage.removeItem('voytek.userId')
  localStorage.removeItem('voytek.memberships')
  localStorage.removeItem('voytek.email')
}

export function hasSession() {
  return Boolean(localStorage.getItem('voytek.accessToken'))
}

export function currentMembership(): Membership | null {
  try {
    const value = localStorage.getItem('voytek.memberships')
    const memberships = value ? JSON.parse(value) as Membership[] : []
    return memberships[0] ?? null
  } catch {
    return null
  }
}

export async function checkApiHealth() {
  try {
    const response = await fetch(API_BASE_URL + '/health/ready')
    return response.ok
  } catch {
    return false
  }
}
