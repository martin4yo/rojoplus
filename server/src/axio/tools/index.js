/**
 * Registry de tools por rol. El adapter en chat.js usa getToolsForRole(role)
 * para armar la lista que se manda al hub AXIO.
 */

import { ADMIN_TOOLS } from './adminTools.js'
import { CAMARERO_TOOLS } from './camareroTools.js'
import { SOCIO_TOOLS } from './socioTools.js'

const TOOLS_BY_ROLE = {
  admin: ADMIN_TOOLS,
  camarero: CAMARERO_TOOLS,
  socio: SOCIO_TOOLS,
}

export function getToolsForRole(role) {
  return TOOLS_BY_ROLE[role] || []
}

export { ADMIN_TOOLS, CAMARERO_TOOLS, SOCIO_TOOLS }
