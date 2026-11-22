import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AccessProfile } from '../lib/access'
import { navSections, canSeeItem, canSeeSection } from '../lib/nav-items'
import { getVisibleNavCategories, getActiveNavHref } from '../lib/nav-categories'

const employee: AccessProfile = { isSuperuser: false, departments: [], superuserDepartments: [] }
const deptAdmin: AccessProfile = {
  isSuperuser: false,
  departments: [{ id: 'engineering', name: 'Engineering', level: 'admin' }],
  superuserDepartments: [],
}
const engineeringSuperuser: AccessProfile = { isSuperuser: true, departments: [], superuserDepartments: ['Engineering'] }
const superuser: AccessProfile = { isSuperuser: true, departments: [], superuserDepartments: ['Executive'] }

test('standard employees see their account and their incidents', () => {
  const categories = getVisibleNavCategories(employee)
  assert.deepEqual(categories.map((c) => c.id), ['me', 'it-service'])
  assert.deepEqual(categories[0].items.map((i) => i.href), ['/profile', '/notifications'])
  assert.deepEqual(categories[1].items.map((i) => i.href), ['/incidents/new', '/incidents'])
})

test('department admins also see Employees, but not Company Settings', () => {
  const me = getVisibleNavCategories(deptAdmin)[0]
  assert.ok(me.items.some((i) => i.href === '/employees'))
  assert.ok(!me.items.some((i) => i.href === '/settings'))
})

test('superusers see Company Settings', () => {
  assert.ok(getVisibleNavCategories(superuser)[0].items.some((i) => i.href === '/settings'))
})

test('only Engineering superusers see reported issues', () => {
  const sees = (profile: AccessProfile) => getVisibleNavCategories(profile).some((c) => c.items.some((i) => i.href === '/issues'))
  assert.ok(sees(engineeringSuperuser))
  for (const profile of [employee, deptAdmin, superuser]) assert.ok(!sees(profile))
})

test('the Service Desk section follows the ITSM roles, not the app access level', () => {
  const desk = (profile: AccessProfile) =>
    getVisibleNavCategories(profile).find((c) => c.id === 'service-desk')?.items.map((i) => i.href) ?? []
  const none = { technician: false, serviceDeskAdmin: false }
  // An app superuser the ITSM service doesn't count as service desk sees no desk pages.
  assert.deepEqual(desk({ ...engineeringSuperuser, itsm: none }), [])
  assert.deepEqual(desk(employee), [])
  assert.deepEqual(desk({ ...employee, itsm: { technician: true, serviceDeskAdmin: false } }), ['/incidents/queue'])
  const admin = desk({ ...employee, itsm: { technician: false, serviceDeskAdmin: true } })
  for (const href of ['/incidents/all', '/incidents/analytics', '/incidents/technicians', '/incidents/settings', '/incidents/audit'])
    assert.ok(admin.includes(href), href)
  assert.ok(!admin.includes('/incidents/queue'))
})

test('regrouping preserves the permission-filtered destination set', () => {
  for (const profile of [employee, deptAdmin, superuser, engineeringSuperuser]) {
    const before = navSections
      .filter((section) => !section.hidden && !section.roadmapOnly && canSeeSection(profile, section))
      .flatMap((section) => section.items.filter((item) => !item.hidden && canSeeItem(profile, item, section)))
      .map((item) => item.href).sort()
    const after = getVisibleNavCategories(profile).flatMap((c) => c.items.map((i) => i.href)).sort()
    assert.deepEqual(after, before)
  }
})

test('the active category follows the most specific match', () => {
  const visible = getVisibleNavCategories(engineeringSuperuser)
  assert.equal(getActiveNavHref('/dashboard', visible), '/dashboard')
  assert.equal(getActiveNavHref('/incidents/123', visible), '/dashboard/it-service')
  assert.equal(getActiveNavHref('/employees', visible), '/dashboard/me')
})
