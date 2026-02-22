# 🧪 Testing Integral - Mejoras POS Buffet

**Fecha:** 22 de Febrero 2026
**Estado:** ✅ En progreso
**Responsable:** Claude Sonnet 4.5

---

## 📋 Checklist de Testing

### **✅ Fase 1: Migración de Base de Datos**

- [x] Ejecutar `npx prisma db push`
- [x] Verificar generación Prisma Client
- [x] Campo `propina` agregado a tabla `comandas`
- [x] Campo `propina` agregado a tabla `pedidos_take_away`

**Resultado:** ✅ **EXITOSO**
```
Prisma schema loaded from prisma\schema.prisma
Your database is now in sync with your Prisma schema. Done in 771ms
✔ Generated Prisma Client (v5.22.0)
```

---

### **⏳ Fase 2: Testing Backend API**

#### **Test 2.1: Endpoint Cobrar Comanda - Pago Simple**

**Endpoint:** `POST /admin/buffet/comandas/:id/cobrar`

**Escenario:** Cobrar comanda con un solo medio de pago
```json
{
  "cajaId": 1,
  "medioPagoId": 2,
  "aplicarDescuento": false
}
```

**Esperado:**
- Status: 200
- 1 MovimientoCaja creado
- comanda.estado = 'CERRADA'
- comanda.propina = 0

**Resultado:** ⏳ Pendiente

---

#### **Test 2.2: Endpoint Cobrar Comanda - Con Propina**

**Escenario:** Cobrar comanda con propina
```json
{
  "cajaId": 1,
  "medioPagoId": 2,
  "propina": 500
}
```

**Esperado:**
- Status: 200
- comanda.propina = 500
- comanda.total = subtotal + 500
- movimiento.monto = total con propina

**Resultado:** ⏳ Pendiente

---

#### **Test 2.3: Endpoint Cobrar Comanda - Pagos Múltiples**

**Escenario:** Cobrar con 2 medios de pago
```json
{
  "cajaId": 1,
  "pagosParciales": [
    { "medioPagoId": 2, "monto": 5000 },
    { "medioPagoId": 3, "monto": 3000 }
  ]
}
```

**Esperado:**
- Status: 200
- 2 MovimientoCaja creados
- Suma movimientos = 8000
- comanda.total = 8000

**Resultado:** ⏳ Pendiente

---

#### **Test 2.4: Endpoint Cobrar Comanda - Pagos Múltiples + Propina**

**Escenario:** Pagos múltiples con propina
```json
{
  "cajaId": 1,
  "propina": 500,
  "pagosParciales": [
    { "medioPagoId": 2, "monto": 5500 },
    { "medioPagoId": 3, "monto": 3000 }
  ]
}
```

**Esperado:**
- Status: 200
- 2 MovimientoCaja
- comanda.propina = 500
- comanda.total = 8500

**Resultado:** ⏳ Pendiente

---

#### **Test 2.5: Validación - Suma Incorrecta**

**Escenario:** Suma de pagos no coincide con total
```json
{
  "cajaId": 1,
  "pagosParciales": [
    { "medioPagoId": 2, "monto": 5000 },
    { "medioPagoId": 3, "monto": 2000 }
  ]
}
```
*Total real de la comanda: $8000*

**Esperado:**
- Status: 400
- Error: "La suma de pagos (7000) no coincide con el total (8000)"

**Resultado:** ⏳ Pendiente

---

#### **Test 2.6: Endpoint Kiosco - Pago Simple**

**Endpoint:** `POST /admin/buffet/kiosco/venta`

**Escenario:** Venta kiosco normal
```json
{
  "items": [
    { "productoBuffetId": 1, "cantidad": 2 }
  ],
  "cajaId": 1,
  "medioPagoId": 2
}
```

**Esperado:**
- Status: 200
- 1 MovimientoCaja creado
- total calculado correctamente

**Resultado:** ⏳ Pendiente

---

#### **Test 2.7: Endpoint Kiosco - Con Propina**

**Escenario:** Venta kiosco con propina
```json
{
  "items": [
    { "productoBuffetId": 1, "cantidad": 2 }
  ],
  "cajaId": 1,
  "medioPagoId": 2,
  "propina": 200
}
```

**Esperado:**
- Status: 200
- total = precio_items + 200
- propinaAplicada = 200

**Resultado:** ⏳ Pendiente

---

#### **Test 2.8: Endpoint TakeAway - Pagos Múltiples**

**Endpoint:** `POST /admin/buffet/takeaway/:id/cobrar`

**Escenario:** Cobrar pedido con múltiples pagos
```json
{
  "cajaId": 1,
  "pagosParciales": [
    { "medioPagoId": 2, "monto": 4000 },
    { "medioPagoId": 3, "monto": 2000 }
  ]
}
```

**Esperado:**
- Status: 200
- 2 MovimientoCaja
- pedido.estado = 'ENTREGADO'

**Resultado:** ⏳ Pendiente

---

### **⏳ Fase 3: Testing Frontend - BuffetKiosco**

#### **Test 3.1: Calculadora de Vuelto**

**Pasos:**
1. Abrir BuffetKiosco
2. Agregar productos al carrito
3. Seleccionar "Efectivo"
4. Ingresar monto mayor al total
5. Verificar cálculo de vuelto

**Esperado:**
- Vuelto calculado correctamente
- Color verde si es suficiente
- Color rojo si es insuficiente

**Resultado:** ⏳ Pendiente

---

#### **Test 3.2: Selector Visual de Medios de Pago**

**Pasos:**
1. Abrir modal de cobro
2. Verificar botones visuales de medios de pago
3. Click en "Efectivo", "Tarjeta", "QR"

**Esperado:**
- Botones con iconos visibles
- Selección visual clara
- Cambio de estado al hacer click

**Resultado:** ⏳ Pendiente

---

#### **Test 3.3: Atajos de Teclado**

**Pasos:**
1. Agregar productos al carrito
2. Presionar F5 (Efectivo)
3. Presionar F2 (Cobrar)
4. Presionar ESC (Cancelar)

**Esperado:**
- F5: Selecciona efectivo automáticamente
- F2: Abre modal de cobro
- ESC: Limpia carrito (con confirmación)

**Resultado:** ⏳ Pendiente

---

#### **Test 3.4: Stock Badges**

**Pasos:**
1. Verificar productos con stock bajo (≤5)
2. Verificar productos sin stock (=0)

**Esperado:**
- Badge "Quedan X" (amarillo) cuando stock ≤ 5
- Badge "Sin stock" (rojo) cuando stock = 0
- Botón deshabilitado si stock = 0

**Resultado:** ⏳ Pendiente

---

#### **Test 3.5: Historial de Ventas**

**Pasos:**
1. Realizar 2-3 ventas
2. Click en botón de historial
3. Verificar panel lateral

**Esperado:**
- Panel se abre desde la derecha
- Muestra últimas ventas
- Botón "Reimprimir ticket" visible

**Resultado:** ⏳ Pendiente

---

### **⏳ Fase 4: Testing Frontend - BuffetComanda**

#### **Test 4.1: Modal Cobro Mejorado**

**Pasos:**
1. Abrir comanda de mesa
2. Click en "Cobrar"
3. Verificar modal

**Esperado:**
- Header con gradiente verde
- Total en texto grande (text-4xl)
- Selector visual de medios de pago
- Propina selector visible

**Resultado:** ⏳ Pendiente

---

#### **Test 4.2: Selector de Propina**

**Pasos:**
1. Abrir modal de cobro
2. Click en botones 10%, 15%, 20%
3. Ingresar monto custom

**Esperado:**
- Botones de porcentaje calculan automáticamente
- Input custom funciona
- Total se actualiza con propina

**Resultado:** ⏳ Pendiente

---

#### **Test 4.3: Pagos Múltiples**

**Pasos:**
1. Abrir modal cobro
2. Click en "Pago Múltiple"
3. Agregar 2 pagos parciales
4. Verificar validación

**Esperado:**
- Muestra componente PagoMultiple
- Permite agregar/eliminar pagos
- Botón "Exacto" llena monto pendiente
- Valida total completo antes de cobrar

**Resultado:** ⏳ Pendiente

---

#### **Test 4.4: Split de Cuenta**

**Pasos:**
1. Click en botón "Dividir"
2. Seleccionar "Partes iguales"
3. Ajustar número de personas

**Esperado:**
- Modal SplitCuenta se abre
- Calcula monto por persona
- Muestra total por cada persona

**Resultado:** ⏳ Pendiente

---

#### **Test 4.5: Atajos de Teclado en Modal**

**Pasos:**
1. Abrir modal cobro
2. Presionar Enter
3. Presionar ESC
4. Presionar F9

**Esperado:**
- Enter: Confirma cobro
- ESC: Cierra modal
- F9: Muestra preview de cuenta

**Resultado:** ⏳ Pendiente

---

### **⏳ Fase 5: Testing Integración**

#### **Test 5.1: Flujo Completo Comanda**

**Pasos:**
1. Abrir mesa
2. Agregar items
3. Enviar a cocina
4. Cobrar con propina y descuento
5. Verificar MovimientoCaja en DB

**Esperado:**
- Mesa pasa a LIMPIEZA
- Comanda estado = CERRADA
- MovimientoCaja creado correctamente
- Propina guardada

**Resultado:** ⏳ Pendiente

---

#### **Test 5.2: Flujo Completo Kiosco con Pagos Múltiples**

**Pasos:**
1. Agregar 5 productos
2. Seleccionar "Pago Múltiple"
3. Pagar $3000 efectivo + $2000 tarjeta
4. Verificar DB

**Esperado:**
- 2 MovimientoCaja creados
- Suma = total venta
- Concepto incluye medios de pago

**Resultado:** ⏳ Pendiente

---

### **⏳ Fase 6: Testing Responsive**

#### **Test 6.1: Tablet (768px - 1024px)**

**Pasos:**
1. Abrir Chrome DevTools
2. Seleccionar iPad
3. Probar BuffetKiosco y BuffetComanda

**Esperado:**
- Botones táctiles de tamaño adecuado (≥56px)
- Teclado numérico funcional
- Grid de productos adaptado
- Sin scroll horizontal

**Resultado:** ⏳ Pendiente

---

#### **Test 6.2: Móvil (< 768px)**

**Pasos:**
1. Cambiar a vista móvil
2. Verificar tabs en BuffetComanda

**Esperado:**
- Tabs "Menú" y "Pedido" visibles
- Cambio de vista funcional
- Componentes apilados correctamente

**Resultado:** ⏳ Pendiente

---

### **⏳ Fase 7: Testing de Performance**

#### **Test 7.1: Tiempo de Carga Inicial**

**Métrica:** < 2 segundos

**Resultado:** ⏳ Pendiente

---

#### **Test 7.2: Tiempo por Venta (Kiosco)**

**Métrica objetivo:** < 30 segundos
**Métrica anterior:** ~45 segundos

**Resultado:** ⏳ Pendiente

---

#### **Test 7.3: Clicks por Venta**

**Métrica objetivo:** < 4 clicks
**Métrica anterior:** ~6 clicks

**Resultado:** ⏳ Pendiente

---

## 📊 Resumen de Resultados

| Fase | Total Tests | Pasados | Fallados | Pendientes |
|------|-------------|---------|----------|------------|
| Migración DB | 4 | 4 | 0 | 0 |
| Backend API | 8 | 0 | 0 | 8 |
| Frontend Kiosco | 5 | 0 | 0 | 5 |
| Frontend Comanda | 5 | 0 | 0 | 5 |
| Integración | 2 | 0 | 0 | 2 |
| Responsive | 2 | 0 | 0 | 2 |
| Performance | 3 | 0 | 0 | 3 |
| **TOTAL** | **29** | **4** | **0** | **25** |

**Progreso:** 14% (4/29 tests)

---

## 🐛 Bugs Encontrados

### **Bug #1:** [Título del bug]
- **Severidad:** Alta/Media/Baja
- **Descripción:**
- **Pasos para reproducir:**
- **Esperado vs Real:**
- **Solución:**

---

## ✅ Recomendaciones

1. **Prioridad Alta:**
   - [ ] Completar testing de endpoints backend
   - [ ] Verificar cálculos de propina y descuento
   - [ ] Probar validaciones de pagos múltiples

2. **Prioridad Media:**
   - [ ] Testing responsive en dispositivos reales
   - [ ] Verificar performance en tablet
   - [ ] Probar atajos de teclado

3. **Prioridad Baja:**
   - [ ] Documentar casos edge encontrados
   - [ ] Crear video tutorial para usuarios

---

## 📝 Notas de Testing

### **Fecha: 22/02/2026 - Sesión 1**

**Inicio:** [Hora]
**Estado:** Migración DB completada ✅

**Observaciones:**
- Migración Prisma ejecutada exitosamente
- Cliente Prisma regenerado v5.22.0
- Campos propina agregados a comandas y pedidos_take_away
- Servidor backend iniciado en modo desarrollo

**Próximos pasos:**
- Iniciar testing de endpoints backend
- Verificar que todos los endpoints respondan correctamente
- Probar casos edge con pagos múltiples

---

**Responsable:** Claude Sonnet 4.5
**Última actualización:** 22 de Febrero 2026
