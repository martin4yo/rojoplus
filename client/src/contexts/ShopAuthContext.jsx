import { createContext, useContext, useEffect, useState } from 'react'
import tiendaApi from '../services/tiendaApi'

const ShopAuthContext = createContext(null)

export function ShopAuthProvider({ children }) {
  const [customer, setCustomer] = useState(() => tiendaApi.getCustomer())
  const [loading, setLoading] = useState(false)

  // Re-fetch del usuario al inicio si hay token (verifica vigencia)
  useEffect(() => {
    if (tiendaApi.getToken() && !customer) {
      setLoading(true)
      tiendaApi.me()
        .then(c => {
          setCustomer(c)
          localStorage.setItem('tiendaCustomer', JSON.stringify(c))
        })
        .catch(() => {
          tiendaApi.logout()
          setCustomer(null)
        })
        .finally(() => setLoading(false))
    }
  }, []) // solo al montar

  function loginConToken(token, c) {
    tiendaApi.setToken(token, c)
    setCustomer(c)
  }

  function logout() {
    tiendaApi.logout()
    setCustomer(null)
  }

  const value = { customer, isAuthenticated: !!customer, loading, loginConToken, logout, refrescar: () => tiendaApi.me().then(setCustomer) }
  return <ShopAuthContext.Provider value={value}>{children}</ShopAuthContext.Provider>
}

export function useShopAuth() {
  const ctx = useContext(ShopAuthContext)
  if (!ctx) throw new Error('useShopAuth fuera de ShopAuthProvider')
  return ctx
}
