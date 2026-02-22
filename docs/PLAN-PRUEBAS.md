# Plan de Pruebas - Funcionalidades Desarrolladas
*Fecha: 22 Enero 2026*

---

## 🎯 Funcionalidades a Probar

1. **Asientos Contables Automáticos** ✅ Integrado
2. **Presupuesto Anual** ✅ Completo
3. **Asistencia a Entrenamientos** ✅ Completo

---

## 1️⃣ ASIENTOS CONTABLES AUTOMÁTICOS

### Estado: ✅ **INTEGRADO**
- Backend: `server/src/services/asientosContables.js`
- Integrado en:
  - `admin.js` línea 4076 → Pagos de cuotas
  - `tesoreria.js` línea 306 → Movimientos de caja
  - `movimientosContables.js` → Facturas, ordenes de pago, recibos

### Pruebas a Realizar:

#### Test 1.1: Pago de Cuota (genera asiento)
**Ruta:** `/admin/cuotas` → Cobranza
1. Buscar un socio con cuotas pendientes
2. Registrar un pago de cuota social
3. Verificar en **Libro Diario** (`/admin/contabilidad/asientos`) que se creó el asiento:
   - **Debe:** Caja Efectivo (cuenta 1.1.1.01) → $monto
   - **Haber:** Ingresos por Cuotas (cuenta 4.1.01) → $monto
4. Verificar que el asiento está balanceado (Debe = Haber)

#### Test 1.2: Movimiento de Caja Manual (genera asiento)
**Ruta:** `/admin/tesoreria/movimientos`
1. Crear un **Ingreso** manual (ej: Donación $5.000)
2. Verificar asiento en Libro Diario:
   - **Debe:** Caja → $5.000
   - **Haber:** Otros Ingresos → $5.000
3. Crear un **Egreso** manual (ej: Servicios $3.000)
4. Verificar asiento:
   - **Debe:** Gastos Varios → $3.000
   - **Haber:** Caja → $3.000

#### Test 1.3: Factura de Compra (genera asiento con IVA)
**Ruta:** `/admin/egresos/facturas`
1. Crear factura de compra a proveedor:
   - Subtotal: $10.000
   - IVA 21%: $2.100
   - Total: $12.100
2. Verificar asiento:
   - **Debe:** Mercadería/Gasto → $10.000
   - **Debe:** IVA Crédito Fiscal 21% → $2.100
   - **Haber:** Proveedores → $12.100

#### Test 1.4: Orden de Pago (genera asiento)
**Ruta:** `/admin/egresos/ordenes-pago`
1. Crear orden de pago para cancelar la factura anterior ($12.100)
2. Verificar asiento:
   - **Debe:** Proveedores → $12.100
   - **Haber:** Caja/Banco → $12.100

#### Test 1.5: Libro Mayor - Verificar Saldos
**Ruta:** `/admin/contabilidad/libro-mayor`
1. Seleccionar cuenta "Caja Efectivo"
2. Verificar que muestra todos los movimientos (cobranzas, ingresos, egresos)
3. Verificar que el **saldo acumulado** es correcto
4. Verificar indicador **D** (Deudor) o **H** (Acreedor)

#### Test 1.6: Plan de Cuentas - Balance
**Ruta:** `/admin/contabilidad/plan-cuentas`
1. Verificar que muestra 3 columnas: **Debe**, **Haber**, **Saldo**
2. Verificar que cuentas agrupadoras suman correctamente
3. Verificar totales al pie de la tabla
4. Verificar indicadores D/H según naturaleza:
   - **Deudoras (D):** ACTIVO, EGRESO
   - **Acreedoras (H):** PASIVO, PATRIMONIO, INGRESO

---

## 2️⃣ PRESUPUESTO ANUAL

### Estado: ✅ **COMPLETO**
- Backend: `server/src/routes/presupuesto.js` (registrado en index.js línea 66)
- Frontend:
  - `PresupuestosLista.jsx` → Lista de presupuestos
  - `PresupuestoEditor.jsx` → Crear/editar presupuesto
  - `PresupuestoVigente.jsx` → Ver presupuesto vigente
  - `PresupuestoEjecucion.jsx` → Comparar presupuesto vs real

### Pruebas a Realizar:

#### Test 2.1: Crear Presupuesto Nuevo
**Ruta:** `/admin/contabilidad/presupuestos`
1. Click en "Crear Presupuesto"
2. Ingresar:
   - Año: 2026
   - Nombre: "Presupuesto Anual 2026"
3. Guardar → Debe crear presupuesto en estado **BORRADOR**
4. Verificar que aparece en la lista

#### Test 2.2: Cargar Líneas de Presupuesto
**Ruta:** `/admin/contabilidad/presupuestos/:id` (Editor)
1. Abrir el presupuesto creado
2. Agregar líneas para distintas cuentas:
   - **Ingresos por Cuotas:** $50.000/mes (enero a diciembre)
   - **Gastos de Servicios:** $10.000/mes
   - **Sueldos Personal:** $30.000/mes
3. Guardar → Verificar que se guardaron correctamente
4. Verificar que muestra **totales por mes** y **total anual**

#### Test 2.3: Aprobar Presupuesto
1. Cambiar estado de BORRADOR a **APROBADO**
2. Verificar que se guarda fecha de aprobación
3. Verificar que ya no se puede editar (opcional)

#### Test 2.4: Ver Ejecución Presupuestaria
**Ruta:** `/admin/contabilidad/presupuestos/:id/ejecucion`
1. Abrir "Ver Ejecución"
2. Verificar que compara:
   - **Monto Presupuestado** (lo cargado en el presupuesto)
   - **Monto Ejecutado** (real desde asientos contables)
   - **Diferencia** (presupuestado - ejecutado)
   - **% Ejecución** (ejecutado / presupuestado * 100)
3. Realizar algunos pagos/cobros reales
4. Refrescar → Verificar que **monto ejecutado** se actualiza automáticamente

#### Test 2.5: Presupuesto Vigente
**Ruta:** `/admin/contabilidad/presupuestos/vigente`
1. Verificar que muestra el presupuesto marcado como **principal**
2. Si hay varias versiones, verificar que muestra la correcta
3. Verificar resumen ejecutivo (opcional)

#### Test 2.6: Copiar Presupuesto
**Ruta:** `/admin/contabilidad/presupuestos/:id`
1. Click en "Copiar Presupuesto"
2. Opciones:
   - Copiar al mismo año (nueva versión)
   - Copiar a año siguiente (2027)
   - Aplicar ajuste porcentual (+10%)
3. Verificar que crea nueva versión con líneas copiadas
4. Verificar que aplica el ajuste porcentual correctamente

---

## 3️⃣ ASISTENCIA A ENTRENAMIENTOS

### Estado: ✅ **COMPLETO**
- Backend: `server/src/routes/deportes.js` (endpoints de asistencia)
- Frontend: `client/src/pages/admin/deportes/AsistenciaEntrenamiento.jsx`
- Ruta: `/admin/deportes/asistencia/:id`

### Pruebas a Realizar:

#### Test 3.1: Acceder a Toma de Asistencia
**Pre-requisito:** Tener un entrenamiento creado con horario
1. Ir a `/admin/deportes/entrenamientos` (Calendario)
2. Click en un entrenamiento programado
3. Debe abrir detalle del entrenamiento
4. Buscar botón/link "Tomar Asistencia"
5. Debe redirigir a `/admin/deportes/asistencia/:id`

#### Test 3.2: Visualizar Lista de Inscriptos
**Ruta:** `/admin/deportes/asistencia/:id`
1. Verificar que carga:
   - Datos del entrenamiento (fecha, hora, espacio, categoría)
   - Lista de socios inscriptos en esa categoría
   - Foto/inicial de cada socio
   - Estado actual de asistencia (si ya fue tomada)
2. Verificar que muestra contador de presentes/ausentes

#### Test 3.3: Marcar Asistencia Individual
1. Para cada socio, debe haber botones de estado:
   - **Presente** (verde) ✓
   - **Ausente** (rojo) ✗
   - **Tarde** (amarillo) 🕒
   - **Justificado** (azul) ℹ️
2. Click en cada estado → Verificar que cambia visualmente
3. Verificar que aparece indicador de "Cambios pendientes"

#### Test 3.4: Marcar Todos
1. Buscar botón "Marcar Todos como Presente"
2. Click → Verificar que marca todos los socios como PRESENTE
3. Buscar botón "Marcar Todos como Ausente"
4. Click → Verificar que marca todos como AUSENTE

#### Test 3.5: Agregar Observaciones
1. Click en icono de comentario/nota de un socio
2. Debe abrir modal para ingresar observaciones
3. Ingresar texto (ej: "Llegó 10 min tarde")
4. Guardar → Verificar que se muestra icono de que tiene observación

#### Test 3.6: Guardar Asistencia
1. Marcar varios socios con distintos estados
2. Click en "Guardar Asistencia"
3. Verificar mensaje de éxito
4. Refrescar página → Verificar que persiste la asistencia guardada

#### Test 3.7: Visualizar Asistencia Guardada
1. Salir de la página
2. Volver a entrar al mismo entrenamiento
3. Verificar que muestra la asistencia previamente guardada
4. Verificar que permite modificarla
5. Guardar cambios → Verificar que actualiza correctamente

#### Test 3.8: Reporte de Asistencia (Opcional)
**Ruta:** `/admin/deportes/reportes/asistencia` (si existe)
1. Filtrar por categoría y período
2. Verificar que muestra % de asistencia por socio
3. Verificar que muestra ranking de asistencia

---

## ✅ CHECKLIST FINAL

### Asientos Contables
- [ ] Pago de cuota genera asiento correcto
- [ ] Movimiento de caja genera asiento correcto
- [ ] Factura de compra genera asiento con IVA
- [ ] Orden de pago cancela deuda correctamente
- [ ] Libro Mayor muestra movimientos y saldos
- [ ] Plan de Cuentas muestra balance con D/H

### Presupuesto
- [ ] Crear presupuesto nuevo
- [ ] Cargar líneas por mes y cuenta
- [ ] Aprobar presupuesto
- [ ] Ver ejecución (presupuestado vs real)
- [ ] Copiar presupuesto a nuevo año
- [ ] Aplicar ajuste porcentual

### Asistencia
- [ ] Acceder desde calendario de entrenamientos
- [ ] Ver lista de inscriptos
- [ ] Marcar asistencia individual (4 estados)
- [ ] Marcar todos
- [ ] Agregar observaciones
- [ ] Guardar asistencia
- [ ] Verificar persistencia de datos

---

## 🐛 BUGS ENCONTRADOS

*(Registrar aquí cualquier problema encontrado durante las pruebas)*

---

## 📝 NOTAS ADICIONALES

- **Usuario Admin:** admin@sportivo.com.ar / 123456
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3001/api

---

*Plan de pruebas generado automáticamente - 22 Enero 2026*
