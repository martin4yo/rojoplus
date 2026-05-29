import { Outlet } from 'react-router-dom'
import PublicHeader from './PublicHeader'
import PublicFooter from './PublicFooter'
import PortalSocioFab from '../../../components/PortalSocioFab'

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-400">
      <PublicHeader />
      <main className="flex-grow">
        <Outlet />
      </main>
      <PublicFooter />
      <PortalSocioFab />
    </div>
  )
}
