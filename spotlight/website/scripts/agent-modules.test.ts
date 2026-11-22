import assert from 'node:assert/strict'
import { test } from 'node:test'
import { moduleLive } from '../lib/agent/modules'
import { capabilitiesFor } from '../lib/agent/registry'

test('only pages linked from the menu are live', () => {
  for (const href of ['/incidents', '/incidents/new', '/incidents/queue', '/incidents/all', '/incidents/analytics', '/employees', '/profile', '/notifications'])
    assert.equal(moduleLive(href), true, href)
  assert.equal(moduleLive('/no-such-page'), false)
})

test('Mariner offers the ITSM and people tools, and nothing outside them', () => {
  const ctx = {
    employeeId: 'x', authUserId: 'x', employeeName: 'T', supabase: null, accessLevel: 'superuser', roleSummary: '',
    profile: { isSuperuser: true, departments: [], superuserDepartments: ['Engineering'] },
    isEngineeringSuperuser: true, currentPage: null,
  }
  const names = capabilitiesFor(ctx as never).map((c) => c.name)
  for (const live of ['report_incident', 'list_my_incidents', 'list_employees', 'list_my_notifications']) assert.ok(names.includes(live), live)
  for (const gone of ['get_my_leave', 'list_my_purchase_requests', 'list_my_reimbursements', 'get_inventory_stock']) assert.ok(!names.includes(gone), gone)
})

test('service-desk tools follow the ITSM roles, not the app access level', () => {
  const base = {
    employeeId: 'x', authUserId: 'x', employeeName: 'T', supabase: null, accessLevel: 'superuser', roleSummary: '',
    isEngineeringSuperuser: false, currentPage: null,
  }
  const names = (itsm: { technician: boolean; serviceDeskAdmin: boolean }) =>
    capabilitiesFor({ ...base, profile: { isSuperuser: true, departments: [], superuserDepartments: ['Executive'], itsm } } as never).map((c) => c.name)

  const employee = names({ technician: false, serviceDeskAdmin: false })
  for (const own of ['report_incident', 'list_my_incidents', 'get_incident', 'add_incident_note', 'update_incident_status', 'leave_incident_feedback'])
    assert.ok(employee.includes(own), own)
  for (const desk of ['list_incident_queue', 'assign_incident', 'search_incidents', 'recommend_technicians', 'service_desk_overview'])
    assert.ok(!employee.includes(desk), desk)

  const technician = names({ technician: true, serviceDeskAdmin: false })
  assert.ok(technician.includes('list_incident_queue'))
  assert.ok(!technician.includes('search_incidents'))

  const admin = names({ technician: false, serviceDeskAdmin: true })
  for (const desk of ['list_incident_queue', 'assign_incident', 'search_incidents', 'recommend_technicians', 'service_desk_overview'])
    assert.ok(admin.includes(desk), desk)
})
