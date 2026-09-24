import { Notice, PageHeading, Panel, Status } from '../../components/UI'
import type { SharedPageProps } from '../../app/types'

const roles = ['Owner', 'Admin', 'Manager', 'Operator', 'Viewer']

const capabilities = [
  { name: 'Consultar dados da organização', allowed: roles },
  { name: 'Criar e operar agentes, objetivos, budgets e policies', allowed: ['Owner', 'Admin', 'Manager'] },
  { name: 'Aprovar ou rejeitar solicitações', allowed: ['Owner', 'Admin', 'Manager'] },
  { name: 'Gerar propostas e analisar assinaturas SaaS', allowed: ['Owner', 'Admin', 'Manager'] },
  { name: 'Avaliar autorizações em Shadow Mode', allowed: roles },
  { name: 'Registrar resultados operacionais', allowed: ['Owner', 'Admin', 'Manager'] },
  { name: 'Criar e revogar credenciais de API', allowed: ['Owner', 'Admin'] },
]

export default function AccessPage({ role }: SharedPageProps) {
  return <div className="v-page">
    <PageHeading title="Equipe e permissões" description="O papel associado à sessão define quais operações a API permite nesta organização." />
    <Panel title="Seu acesso" description="Este papel foi retornado pela API no login e seleção da organização.">
      <div className="v-role-summary"><Status value={role} /><p className="v-muted">A tabela resume as regras atualmente aplicadas pelo backend. A interface apenas oculta ações indisponíveis; a autorização real permanece no servidor.</p></div>
    </Panel>
    <Panel title="Matriz de acesso" description="Owner e Admin também podem administrar credenciais. Manager pode operar o workspace, mas não gerir credenciais de API.">
      <div className="v-table-wrap"><table className="v-table v-permission-table">
        <thead><tr><th>Operação</th>{roles.map(item => <th key={item}>{item}</th>)}</tr></thead>
        <tbody>{capabilities.map(capability => <tr key={capability.name}>
          <td>{capability.name}</td>
          {roles.map(item => <td key={item}><span className={capability.allowed.includes(item) ? 'v-permission-yes' : 'v-permission-no'}>{capability.allowed.includes(item) ? 'Permitido' : 'Sem acesso'}</span></td>)}
        </tr>)}</tbody>
      </table></div>
    </Panel>
    <Notice tone="info">Gerenciamento de membros (convites e alteração de papel) ainda não tem endpoint na API. Por isso esta tela é informativa e não altera acessos.</Notice>
  </div>
}
