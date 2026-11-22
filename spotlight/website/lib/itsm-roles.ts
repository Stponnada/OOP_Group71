import { cache } from 'react'
import type { ItsmRoles } from './access'
import { getMe, isItsmError } from './itsm-api'

/**
 * The caller's service-desk roles, decided by the ITSM service (`GET /api/v1/me`): technician
 * means a technician profile exists, service-desk admin means a superuser or an admin of the
 * IT department. Cached per request, so the layout, the category page and any page that
 * branches on role share one call. If the service is down everyone gets the employee view.
 */
export const getItsmRoles = cache(async (): Promise<ItsmRoles> => {
  const res = await getMe()
  if (isItsmError(res)) return { technician: false, serviceDeskAdmin: false }
  return { technician: res.data.technician === true, serviceDeskAdmin: res.data.serviceDeskAdmin === true }
})
