import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAuthRedirectPath } from '../lib/auth-redirect'

test('recovery always opens the password form, even without next or with dashboard next', () => {
  for (const next of [undefined, null, '/dashboard', '/profile', 'https://example.com']) {
    assert.equal(getAuthRedirectPath(next, true), '/auth/update-password')
  }
})

test('normal sign-ins keep local destinations and default to dashboard', () => {
  assert.equal(getAuthRedirectPath(null), '/dashboard')
  assert.equal(getAuthRedirectPath('/auth/update-password'), '/auth/update-password')
  assert.equal(getAuthRedirectPath('/employees?org=123'), '/employees?org=123')
})

test('auth links cannot redirect to another origin', () => {
  for (const next of ['https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)']) {
    assert.equal(getAuthRedirectPath(next), '/dashboard')
  }
})
