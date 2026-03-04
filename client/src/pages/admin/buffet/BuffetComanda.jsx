import { useParams, useNavigate } from 'react-router-dom'
import GestionPedido from '../../../components/buffet/GestionPedido'

export default function BuffetComanda() {
  const { mesaId } = useParams()
  const navigate = useNavigate()

  return (
    <GestionPedido
      tipo="mesa"
      id={parseInt(mesaId)}
      onVolver={() => navigate('/admin/buffet/estado')}
    />
  )
}
