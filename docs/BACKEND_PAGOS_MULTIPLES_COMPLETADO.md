# ✅ Backend Pagos Múltiples - Implementación Completada

**Fecha:** 22 de Febrero 2026
**Módulo:** Sistema POS Buffet
**Estado:** ✅ Completado (100%)

---

## 📊 Resumen Ejecutivo

Se implementó soporte completo para **pagos múltiples** y **propinas** en el sistema POS del Buffet, permitiendo:

- 💳 **Pagos combinados**: Ej: $5000 efectivo + $3000 tarjeta
- 💰 **Propinas**: Monto adicional en comandas y pedidos
- ✅ **Validación**: Suma de pagos debe coincidir con el total (tolerancia 0.01)
- 📝 **Múltiples movimientos**: Un MovimientoCaja por cada medio de pago

---

## 🗂️ Archivos Modificados

### **1. Schema Prisma** (`server/prisma/schema.prisma`)

#### Cambios en modelo `Comanda`:
```prisma
model Comanda {
  // ... campos existentes ...
  subtotal        Decimal          @default(0) @db.Decimal(12, 2)
  descuento       Decimal          @default(0) @db.Decimal(12, 2)
  propina         Decimal          @default(0) @db.Decimal(12, 2)  // ⬅️ NUEVO
  total           Decimal          @default(0) @db.Decimal(12, 2)
  // ... resto del modelo ...
}
```

#### Cambios en modelo `PedidoTakeAway`:
```prisma
model PedidoTakeAway {
  // ... campos existentes ...
  subtotal        Decimal              @default(0) @db.Decimal(12, 2)
  descuento       Decimal              @default(0) @db.Decimal(12, 2)
  propina         Decimal              @default(0) @db.Decimal(12, 2)  // ⬅️ NUEVO
  total           Decimal              @default(0) @db.Decimal(12, 2)
  // ... resto del modelo ...
}
```

---

### **2. Endpoint Cobrar Comanda** (`server/src/routes/buffet.js:1498`)

**Endpoint:** `POST /admin/buffet/comandas/:id/cobrar`

#### Nuevos parámetros en body:
```javascript
{
  medioPagoId: number,           // Obligatorio si no hay pagosParciales
  cajaId: number,                // Obligatorio
  observaciones: string,         // Opcional
  aplicarDescuento: boolean,     // Opcional
  propina: number,               // Opcional - monto de propina
  pagosParciales: [              // Opcional - array para pagos múltiples
    {
      medioPagoId: number,       // ID del medio de pago
      monto: number,             // Monto del pago parcial
      cajaId: number             // Opcional - si no se especifica usa cajaId principal
    }
  ]
}
```

#### Lógica implementada:
1. **Calcular descuento** (si aplica para socio)
2. **Calcular propina** (si se especificó)
3. **Calcular total final** = subtotal - descuento + propina
4. **Determinar modo de pago:**
   - Si `pagosParciales` existe y tiene items → **Modo múltiple**
   - Si no → **Modo simple**

5. **Modo pago múltiple:**
   - Validar suma de pagos = total final (tolerancia 0.01)
   - Crear un `MovimientoCaja` por cada pago
   - Concepto incluye nombre del medio de pago

6. **Modo pago simple:**
   - Crear un solo `MovimientoCaja`

7. **Actualizar comanda:**
   ```javascript
   {
     estado: 'CERRADA',
     descuento: descuentoMonto,
     propina: propinaMonto,      // ⬅️ NUEVO
     total: totalFinal,
     horaCierre: new Date(),
     cerradoPor: req.admin.id
   }
   ```

8. **Liberar mesa** (estado → LIMPIEZA)
9. **Notificar** vía Socket.io

#### Response:
```javascript
{
  success: true,
  data: {
    comanda: { ... },              // Comanda actualizada
    movimientos: [ ... ],          // Array de MovimientoCaja creados
    descuentoAplicado: {
      porcentaje: 10,
      monto: 500
    },
    propinaAplicada: 200           // Null si no hay propina
  }
}
```

---

### **3. Endpoint Cobrar Take Away** (`server/src/routes/buffet.js:1959`)

**Endpoint:** `POST /admin/buffet/takeaway/:id/cobrar`

#### Cambios similares a comanda:
- ✅ Soporte `propina` y `pagosParciales`
- ✅ Validación suma de pagos
- ✅ Múltiples MovimientoCaja
- ✅ Actualización campo propina en PedidoTakeAway

#### Diferencia con comanda:
- No hay descuento de socio
- No libera mesa (es take away)
- Estado final: `ENTREGADO`

---

### **4. Endpoint Venta Kiosco** (`server/src/routes/buffet.js:2112`)

**Endpoint:** `POST /admin/buffet/kiosco/venta`

#### Nuevos parámetros:
```javascript
{
  items: [...],                  // Array de productos
  medioPagoId: number,           // Obligatorio si no hay pagosParciales
  cajaId: number,                // Obligatorio
  socioId: number,               // Opcional
  observaciones: string,         // Opcional
  propina: number,               // ⬅️ NUEVO
  pagosParciales: [...]          // ⬅️ NUEVO
}
```

#### Lógica:
1. Calcular total de items
2. Sumar propina al total
3. Crear MovimientoCaja (simple o múltiples)
4. No se crea comanda ni pedido (venta directa)

---

## 📄 Script de Migración SQL

**Archivo:** `server/prisma/migrations/add_propina_field.sql`

```sql
-- Migración: Agregar campo propina a Comanda y PedidoTakeAway
-- Fecha: 22 de Febrero 2026

-- Agregar columna propina a comandas
ALTER TABLE "comandas"
ADD COLUMN IF NOT EXISTS "propina" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Agregar columna propina a pedidos_take_away
ALTER TABLE "pedidos_take_away"
ADD COLUMN IF NOT EXISTS "propina" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Comentarios
COMMENT ON COLUMN "comandas"."propina" IS 'Monto de propina agregado al total de la comanda';
COMMENT ON COLUMN "pedidos_take_away"."propina" IS 'Monto de propina agregado al total del pedido';
```

---

## 🔧 Instrucciones de Deployment

### **Desarrollo:**
```bash
cd server
npx prisma db push
npx prisma generate
npm run dev
```

### **Producción:**
```bash
cd server

# 1. Ejecutar migración SQL
psql -U postgres -d rojoplus < prisma/migrations/add_propina_field.sql

# 2. Regenerar cliente Prisma
npx prisma generate

# 3. Reiniciar servidor
pm2 restart server
```

---

## 🧪 Casos de Prueba

### **Caso 1: Pago simple con propina**
```javascript
// Request
POST /admin/buffet/comandas/123/cobrar
{
  cajaId: 1,
  medioPagoId: 2,  // Efectivo
  propina: 500
}

// Expected
// - Total = subtotal - descuento + 500
// - 1 MovimientoCaja con monto total
// - comanda.propina = 500
```

### **Caso 2: Pago múltiple sin propina**
```javascript
// Request
POST /admin/buffet/comandas/123/cobrar
{
  cajaId: 1,
  pagosParciales: [
    { medioPagoId: 2, monto: 5000 },   // Efectivo
    { medioPagoId: 3, monto: 3000 }    // Tarjeta
  ]
}

// Expected
// - Total = 8000
// - 2 MovimientoCaja (5000 + 3000)
// - comanda.propina = 0
```

### **Caso 3: Pago múltiple CON propina**
```javascript
// Request
POST /admin/buffet/comandas/123/cobrar
{
  cajaId: 1,
  propina: 500,
  pagosParciales: [
    { medioPagoId: 2, monto: 5500 },   // Efectivo
    { medioPagoId: 3, monto: 3000 }    // Tarjeta
  ]
}

// Expected
// - Total = subtotal - descuento + 500 = 8500
// - 2 MovimientoCaja (5500 + 3000)
// - comanda.propina = 500
```

### **Caso 4: Error - Suma incorrecta**
```javascript
// Request
POST /admin/buffet/comandas/123/cobrar
{
  cajaId: 1,
  pagosParciales: [
    { medioPagoId: 2, monto: 5000 },
    { medioPagoId: 3, monto: 2000 }    // Suma = 7000
  ]
}
// Total real = 8000

// Expected
// - Error 400
// - Message: "La suma de pagos (7000) no coincide con el total (8000)"
```

---

## 📊 Impacto en Base de Datos

### **Tablas afectadas:**
- ✅ `comandas` - Agregado campo `propina`
- ✅ `pedidos_take_away` - Agregado campo `propina`
- ✅ `movimientos_caja` - Ahora puede haber múltiples por comanda/pedido

### **Relaciones:**
- Un `Comanda` → Muchos `MovimientoCaja` (1:N)
- Un `PedidoTakeAway` → Muchos `MovimientoCaja` (1:N)

---

## 🔍 Validaciones Implementadas

1. **Suma de pagos múltiples:**
   ```javascript
   if (Math.abs(totalPagos - totalFinal) > 0.01) {
     return res.status(400).json({ error: '...' })
   }
   ```

2. **Medio de pago existe:**
   ```javascript
   const medioPago = await prisma.medioPago.findUnique({ ... })
   if (!medioPago) {
     return res.status(400).json({ error: 'Medio de pago no encontrado' })
   }
   ```

3. **Caja existe:**
   ```javascript
   const caja = await prisma.caja.findUnique({ ... })
   if (!caja) {
     return res.status(400).json({ error: 'Caja no encontrada' })
   }
   ```

4. **Estado de comanda/pedido:**
   ```javascript
   if (comanda.estado === 'CERRADA') {
     return res.status(400).json({ error: 'La comanda ya fue cobrada' })
   }
   ```

---

## 🎯 KPIs y Métricas

| Métrica | Antes | Después |
|---------|-------|---------|
| Métodos de pago por venta | 1 | 1-5 |
| Soporte propina | ❌ No | ✅ Sí |
| MovimientosCaja por venta | 1 | 1-N |
| Validación pagos | Manual | Automática |
| Tolerancia decimal | N/A | 0.01 |

---

## 📝 Notas de Implementación

### **Tolerancia de 0.01:**
Debido a precisión decimal en JavaScript, se acepta una diferencia de hasta $0.01 entre la suma de pagos y el total.

### **Números de movimiento:**
Cada MovimientoCaja genera su propio número secuencial:
```javascript
const nuevoNumero = `MOV-${String((ultimoMov?.id || 0) + 1).padStart(8, '0')}`
```

### **Concepto de movimiento:**
Incluye información detallada:
```
Venta Buffet - Comanda C20260222-0001 - Efectivo (Desc. 10%) + Propina
```

### **Backward Compatibility:**
El sistema sigue soportando pagos simples (sin `pagosParciales`), manteniendo compatibilidad con código existente.

---

## 🚀 Próximos Pasos

1. ✅ **Ejecutar migración** en desarrollo
2. ✅ **Testing manual** de todos los casos
3. ⏳ **Testing integral** (Tarea #15)
4. ⏳ **Deployment a producción**
5. ⏳ **Capacitación usuarios**

---

## 📚 Documentación Relacionada

- `PROGRESO_MEJORAS_POS.md` - Estado general del proyecto
- `MEJORAS_UI_POS_BUFFET.md` - Análisis UI/UX original
- `server/src/routes/buffet.js` - Código fuente endpoints

---

**Responsable:** Claude Sonnet 4.5
**Revisión:** Pendiente
**Deployment:** Pendiente
