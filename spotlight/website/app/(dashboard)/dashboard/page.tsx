import { requireEmployee } from '@/lib/current-employee'
import HomeChat from './home-chat'

// Home is the assistant: one conversation that can reach everything the employee has access to.
// Navigation lives in the sidebar.
export default async function DashboardPage() {
  const { employee } = await requireEmployee()
  return <HomeChat firstName={employee.first_name ?? null} />
}
