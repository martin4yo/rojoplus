import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Carrito persistido en localStorage.
 * Item: { productoId, varianteId, nombre, talle, color, precio, foto, cantidad }
 * Identidad: varianteId
 */
const CART_KEY = 'tiendaCarrito'
const ShopCartContext = createContext(null)

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveCart(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)) } catch {}
}

export function ShopCartProvider({ children }) {
  const [items, setItems] = useState(() => loadCart())

  useEffect(() => { saveCart(items) }, [items])

  const totalItems = useMemo(() => items.reduce((s, i) => s + i.cantidad, 0), [items])
  const totalPrecio = useMemo(() => items.reduce((s, i) => s + i.cantidad * i.precio, 0), [items])

  function addItem(item) {
    setItems(prev => {
      const idx = prev.findIndex(p => p.varianteId === item.varianteId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + (item.cantidad || 1) }
        return next
      }
      return [...prev, { ...item, cantidad: item.cantidad || 1 }]
    })
  }

  function setCantidad(varianteId, cantidad) {
    setItems(prev => prev.map(i => i.varianteId === varianteId ? { ...i, cantidad: Math.max(1, cantidad) } : i))
  }

  function removeItem(varianteId) {
    setItems(prev => prev.filter(i => i.varianteId !== varianteId))
  }

  function clear() { setItems([]) }

  const value = { items, totalItems, totalPrecio, addItem, setCantidad, removeItem, clear }
  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>
}

export function useShopCart() {
  const ctx = useContext(ShopCartContext)
  if (!ctx) throw new Error('useShopCart fuera de ShopCartProvider')
  return ctx
}
