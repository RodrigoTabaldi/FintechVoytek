import { useState, type FormEvent } from 'react'
import type { Agent } from '../../api'

export type AgentDraft = {
  name: string
  description: string
  autonomyLevel: number
  specialization: string
  objectiveName: string
  objectiveDescription: string
}

const specializations = [
  ['Custom', 'Personalizado'],
  ['SaasManagement', 'Gestão de SaaS'],
  ['Procurement', 'Compras e fornecedores'],
  ['EpiInventory', 'Estoque de EPI'],
  ['CloudCost', 'Custos de cloud'],
  ['Marketing', 'Marketing'],
  ['CorporateTravel', 'Viagens corporativas'],
  ['AccountsPayable', 'Contas a pagar'],
  ['ItOperations', 'Operações de TI'],
]

const autonomyOptions = [
  { value: 0, name: 'Manual', description: 'Exige decisão humana para ações sensíveis.' },
  { value: 1, name: 'Supervisionada', description: 'Policies avaliam e encaminham exceções.' },
  { value: 2, name: 'Autônoma', description: 'Pode obter autorização; executor externo ainda não conectado.' },
]

export default function AgentForm({
  onSubmit,
  onCancel,
  initialAgent,
  specializationEditable = true,
}: {
  onSubmit: (draft: AgentDraft) => Promise<void>
  onCancel?: () => void
  initialAgent?: Agent
  specializationEditable?: boolean
}) {
  const [name, setName] = useState(initialAgent?.name ?? '')
  const [mission, setMission] = useState(initialAgent?.description ?? '')
  const [specialization, setSpecialization] = useState(initialAgent?.specialization ?? 'Custom')
  const [autonomyLevel, setAutonomyLevel] = useState(autonomyValue(initialAgent?.autonomyLevel))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedMission = mission.trim()
    if (!trimmedName || !trimmedMission) {
      setError('Informe o nome do agente e o objetivo principal.')
      return
    }
    if (trimmedName.length > 150 || trimmedMission.length > 200) {
      setError('O nome deve ter até 150 caracteres e o objetivo até 200.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await onSubmit({
        name: trimmedName,
        description: trimmedMission,
        autonomyLevel,
        specialization,
        objectiveName: trimmedMission,
        objectiveDescription: trimmedMission,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o agente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="v-agent-form" onSubmit={submit}>
      <label className="v-field">
        Nome do agente
        <input
          maxLength={150}
          required
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Ex.: Analista de despesas"
        />
      </label>
      <label className="v-field">
        Objetivo principal
        <textarea
          maxLength={200}
          required
          rows={3}
          value={mission}
          onChange={event => setMission(event.target.value)}
          placeholder="Descreva o resultado que o agente deve buscar"
        />
      </label>
      <label className="v-field">
        Especialização
        <select disabled={!specializationEditable} value={specialization} onChange={event => setSpecialization(event.target.value)}>
          {specializations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {!specializationEditable && <small>A API atual não permite alterar a especialização depois da criação.</small>}
      </label>
      <fieldset className="v-autonomy-picker">
        <legend>Nível de autonomia</legend>
        <div className="v-autonomy-options">
          {autonomyOptions.map(option => (
            <label className={autonomyLevel === option.value ? 'is-selected' : ''} key={option.value}>
              <input
                checked={autonomyLevel === option.value}
                name="autonomy-level"
                onChange={() => setAutonomyLevel(option.value)}
                type="radio"
                value={option.value}
              />
              <span><strong>{option.name}</strong><small>{option.description}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="v-form-error" role="alert">{error}</p>}
      <div className="v-form-actions">
        {onCancel && <button className="v-secondary-button" onClick={onCancel} type="button">Cancelar</button>}
        <button className="v-primary-button" disabled={busy} type="submit">
          {busy ? 'Salvando…' : initialAgent ? 'Salvar alterações' : 'Criar agente'}
        </button>
      </div>
    </form>
  )
}

function autonomyValue(level?: string) {
  if (level?.toLowerCase() === 'supervised') return 1
  if (level?.toLowerCase() === 'autonomous') return 2
  return 0
}
