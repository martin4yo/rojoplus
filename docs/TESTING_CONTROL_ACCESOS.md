# 🧪 GUÍA DE TESTING - CONTROL DE ACCESOS

## 📋 Checklist de Testing Completo

### ✅ FASE 1: Validación de Base de Datos

#### Verificar modelos creados
```bash
cd server
npx prisma studio
```

**Verificar tablas:**
- [ ] `dispositivos_acceso` - Existe y tiene índices correctos
- [ ] `registros_acceso` - Existe con relaciones a socios y habilitaciones
- [ ] `habilitaciones_temporales` - Existe con índices en documento y fechaHasta
- [ ] `intentos_acceso_denegado` - Existe con índice compuesto (resuelto, fecha)
- [ ] `socios` - Tiene campo `rfid_uid` (unique) y `estado` (default: VIGENTE)

#### Verificar permisos
```sql
SELECT * FROM permisos WHERE codigo IN ('ACCESOS_VER', 'ACCESOS_GESTIONAR');
```

**Resultado esperado:** 2 permisos creados y asignados a rol SUPER_ADMIN

---

### ✅ FASE 2: Testing Backend API

#### Test 1: Validación de acceso (socio VIGENTE)

**Request:**
```bash
curl -X POST http://localhost:3001/api/accesos/validar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dispositivoId": 1,
    "tipoLectura": "QR",
    "valorLeido": "TOKEN_QR_DE_UN_SOCIO"
  }'
```

**Response esperada:**
```json
{
  "success": true,
  "data": {
    "permitido": true,
    "motivo": "SOCIO_VIGENTE",
    "mensaje": "Bienvenido/a Juan Pérez",
    "persona": {
      "id": 1,
      "nombre": "Juan Pérez",
      "nroSocio": "0001",
      "documento": "12345678",
      "estado": "VIGENTE"
    },
    "tipo": "SOCIO"
  }
}
```

**Casos a probar:**
- [ ] QR válido de socio VIGENTE → permitido = true
- [ ] QR de socio NO_VIGENTE → permitido = false, motivo = NO_VIGENTE
- [ ] DNI válido de socio → permitido = true
- [ ] DNI no registrado → permitido = false, motivo = NO_ENCONTRADO
- [ ] RFID válido → permitido = true
- [ ] RFID no registrado → permitido = false

#### Test 2: Registro de acceso

**Request:**
```bash
curl -X POST http://localhost:3001/api/accesos/registrar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dispositivoId": 1,
    "tipoLectura": "DNI",
    "valorLeido": "12345678",
    "resultado": "DENEGADO",
    "motivoRechazo": "NO_ENCONTRADO",
    "modoValidacion": "ONLINE"
  }'
```

**Verificar:**
- [ ] Se crea registro en `registros_acceso`
- [ ] Si resultado=DENEGADO + motivo=NO_ENCONTRADO + tipoLectura=DNI → Se crea registro en `intentos_acceso_denegado`

#### Test 3: Cache para modo offline

**Request:**
```bash
curl http://localhost:3001/api/accesos/cache-socios?dispositivoId=1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Verificar:**
- [ ] Retorna array de socios VIGENTES
- [ ] Retorna array de habilitaciones activas y no vencidas
- [ ] Incluye timestamp de sincronización

#### Test 4: Habilitaciones CRUD

**Crear habilitación:**
```bash
curl -X POST http://localhost:3001/api/accesos/habilitaciones \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documento": "99999999",
    "nombreCompleto": "Juan Visitante",
    "motivo": "Invitado",
    "diasHabilitados": 7,
    "accesosPermitidos": 5
  }'
```

**Verificar:**
- [ ] Se calcula fechaDesde = hoy
- [ ] Se calcula fechaHasta = hoy + 7 días
- [ ] Se puede validar con ese DNI

#### Test 5: Intentos denegados

**Request:**
```bash
curl http://localhost:3001/api/accesos/intentos-denegados \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Verificar:**
- [ ] Agrupa intentos por DNI
- [ ] Muestra cantidad de intentos
- [ ] Muestra primer y último intento

**Habilitar DNI denegado:**
```bash
curl -X POST http://localhost:3001/api/accesos/intentos-denegados/99999999/habilitar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombreCompleto": "Juan Test",
    "motivo": "Prueba",
    "diasHabilitados": 1
  }'
```

**Verificar:**
- [ ] Se crea HabilitacionTemporal
- [ ] Se marcan intentos como resueltos
- [ ] Se asigna habilitacionId y resueltoPor

---

### ✅ FASE 3: Testing Servicio Local Molinete

#### Preparación
```bash
cd molinete-service
npm install
```

#### Test 1: Inicialización y configuración

**Editar config.json con datos de prueba:**
```json
{
  "apiUrl": "http://localhost:3001/api",
  "dispositivoId": 1,
  "lectorUSB": {
    "habilitado": false
  },
  "lectorRFID": {
    "habilitado": false
  },
  "molinete": {
    "tipo": "USB_RELAY"
  }
}
```

**Iniciar servicio:**
```bash
npm start
```

**Verificar en consola:**
- [ ] ✓ Base de datos SQLite inicializada
- [ ] ✓ Sincronización completada (X socios, Y habilitaciones)
- [ ] ✓ Servidor HTTP escuchando en puerto 3002
- [ ] ✓ WebSocket disponible

#### Test 2: Monitor web local

**Abrir:** http://localhost:3002

**Verificar:**
- [ ] Muestra estadísticas de cache
- [ ] Muestra último sync
- [ ] Muestra uptime
- [ ] Badges de conexión (API, USB, RFID, Molinete)
- [ ] Botón "Abrir Molinete" funcional
- [ ] Botón "Sincronizar" funcional

#### Test 3: API local

**Status:**
```bash
curl http://localhost:3002/api/status
```

**Verificar respuesta:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "dispositivo": 1,
    "conexion": {
      "api": true,
      "usb": false,
      "rfid": false,
      "molinete": false
    },
    "cache": {
      "sociosEnCache": 100,
      "habilitacionesEnCache": 5,
      "registrosPendientes": 0,
      "ultimoSync": "2024-01-15T..."
    }
  }
}
```

#### Test 4: Detección de hardware

**Lector USB:**
```bash
npm run detectar-usb
```

**Verificar:**
- [ ] Lista todos los dispositivos HID conectados
- [ ] Muestra VID/PID en hexadecimal
- [ ] Identifica fabricante y producto

**Lector RFID:**
```bash
npm run detectar-rfid
```

**Verificar:**
- [ ] Lista puertos seriales disponibles
- [ ] Permite probar puerto interactivo
- [ ] Lee datos del lector cuando se acerca tarjeta

#### Test 5: Modo offline

**Simular desconexión:**
1. Detener servidor backend (puerto 3001)
2. Intentar validación desde monitor web

**Verificar:**
- [ ] Badge API se pone rojo (offline)
- [ ] Validación usa cache SQLite
- [ ] Registros se guardan en `registros_pendientes`
- [ ] Al reconectar, envía registros pendientes

#### Test 6: WebSocket tiempo real

**Conectar desde navegador:**
```javascript
const ws = new WebSocket('ws://localhost:3002/ws')
ws.onmessage = (e) => console.log(JSON.parse(e.data))
```

**Realizar acceso de prueba y verificar:**
- [ ] Recibe evento tipo 'ACCESO'
- [ ] Recibe evento tipo 'PANTALLA'
- [ ] Datos incluyen persona, resultado, fecha

---

### ✅ FASE 4: Testing Frontend Admin

#### Test 1: Monitor de Accesos (/admin/accesos/monitor)

**Verificar visualización:**
- [ ] KPIs muestran totales correctos (Total hoy, Permitidos, Denegados)
- [ ] Estado de dispositivos con último ping
- [ ] Stream de accesos se actualiza en tiempo real
- [ ] Accesos permitidos tienen fondo verde
- [ ] Accesos denegados tienen fondo rojo
- [ ] Muestra datos del socio (nombre, nro socio)
- [ ] Muestra tipo de lectura (QR/DNI/RFID)
- [ ] Indica modo validación (ONLINE/OFFLINE)

**Test de WebSocket:**
- [ ] Conexión WebSocket se establece
- [ ] Nuevos accesos aparecen automáticamente
- [ ] No requiere refresh manual

#### Test 2: Intentos Denegados (/admin/accesos/intentos-denegados) ⭐

**Verificar tabla:**
- [ ] Muestra DNIs agrupados
- [ ] Columna "Cantidad" muestra número de intentos
- [ ] Columna "Último Intento" ordena correctamente
- [ ] Badge rojo con cantidad de intentos
- [ ] Auto-refresh cada 10 segundos

**Test crear habilitación:**
1. Click en botón "Habilitar"
2. Completar formulario modal:
   - Nombre completo
   - Motivo
   - Días: 7 (seleccionar opción predefinida)
3. Submit

**Verificar:**
- [ ] Modal se muestra correctamente
- [ ] Validación de campos requeridos
- [ ] Opciones predefinidas de días (1, 3, 7, 30, Custom)
- [ ] Al guardar: alerta de éxito
- [ ] Fila desaparece de pendientes
- [ ] Estado cambia a "Resuelto"

**Test descartar:**
1. Click en botón "Descartar" (ícono basura)
2. Confirmar

**Verificar:**
- [ ] Muestra confirmación
- [ ] Elimina intentos
- [ ] Fila desaparece de tabla

#### Test 3: Habilitaciones (/admin/accesos/habilitaciones)

**Verificar listado:**
- [ ] Muestra todas las habilitaciones
- [ ] Filtros: Activas / Vencidas / Todas
- [ ] Búsqueda por DNI, nombre o motivo funciona
- [ ] Estado correcto (Vigente/Vencida/Inactiva/Límite)
- [ ] Indicador de días restantes
- [ ] Contador de accesos usados

**Test crear nueva:**
1. Click "Nueva Habilitación"
2. Completar:
   - DNI: 88888888
   - Nombre: Test User
   - Motivo: Testing
   - Días: 3
   - Límite accesos: 10

**Verificar:**
- [ ] Se crea correctamente
- [ ] Aparece en listado
- [ ] Se puede validar acceso con ese DNI

**Test editar:**
1. Click en ícono editar
2. Modificar días a 5
3. Guardar

**Verificar:**
- [ ] Se actualiza fechaHasta
- [ ] Cambios se reflejan

**Test desactivar:**
1. Click en ícono X rojo
2. Confirmar

**Verificar:**
- [ ] Estado cambia a "Inactiva"
- [ ] Ya no permite acceso

#### Test 4: Control PWA (/admin/accesos/control-pwa)

**Verificar interfaz:**
- [ ] Fondo oscuro para móvil
- [ ] Indicador online/offline
- [ ] Selector de dispositivo
- [ ] Botón "Escanear QR" grande
- [ ] Input manual alternativo

**Test validación manual:**
1. Ingresar token QR de socio VIGENTE
2. Click "Validar Manualmente"

**Verificar:**
- [ ] Muestra resultado con color coding
- [ ] Verde para PERMITIDO
- [ ] Rojo para DENEGADO
- [ ] Mensaje personalizado
- [ ] Vibración (en móvil)
- [ ] Auto-cierra después de 3-5s

**Test modo offline:**
1. Desconectar internet
2. Intentar validar

**Verificar:**
- [ ] Badge "Offline" se muestra
- [ ] Botón deshabilitado
- [ ] Mensaje de error si intenta

---

### ✅ FASE 5: Testing PWA

#### Test 1: Instalación PWA

**En Chrome móvil:**
1. Acceder a https://tu-dominio.com/admin/accesos/control-pwa
2. Menú → "Agregar a pantalla de inicio"

**Verificar:**
- [ ] Aparece prompt de instalación
- [ ] Se crea ícono en pantalla de inicio
- [ ] Al abrir, se muestra como app standalone
- [ ] Barra de direcciones oculta
- [ ] Theme color correcto (#DC2626)

#### Test 2: Service Worker

**Consola del navegador:**
```javascript
navigator.serviceWorker.getRegistrations()
```

**Verificar:**
- [ ] Service Worker registrado
- [ ] Estado: "activated"
- [ ] Scope correcto

**Test cache:**
1. Cargar app online
2. Activar modo avión
3. Recargar página

**Verificar:**
- [ ] App carga desde cache
- [ ] Recursos estáticos disponibles
- [ ] Muestra interfaz (aunque no funcional sin API)

#### Test 3: Shortcuts

**En Android:**
1. Mantener presionado ícono de app
2. Ver shortcuts disponibles

**Verificar:**
- [ ] Muestra "Escanear QR"
- [ ] Muestra "Monitor"
- [ ] Al seleccionar, abre pantalla correcta

---

### ✅ FASE 6: Testing de Integración Completa

#### Escenario 1: Socio ingresa con QR ✅

**Pasos:**
1. Socio escanea QR del carnet en lector USB
2. Sistema valida
3. Molinete se abre

**Verificar:**
- [ ] LED verde se enciende
- [ ] Beep corto suena
- [ ] Molinete abre por 3 segundos
- [ ] Se registra en base de datos
- [ ] Aparece en monitor web tiempo real
- [ ] Muestra nombre del socio

#### Escenario 2: Socio NO_VIGENTE intenta ingresar ❌

**Pasos:**
1. Socio con estado != VIGENTE escanea QR
2. Sistema valida

**Verificar:**
- [ ] LED rojo se enciende
- [ ] Beep largo 2x suena
- [ ] Molinete NO abre
- [ ] Se registra con motivo NO_VIGENTE
- [ ] Muestra mensaje "Socio NO_VIGENTE - Diríjase a Secretaría"

#### Escenario 3: DNI no registrado → Habilitación remota ⭐ FLUJO CRÍTICO

**Pasos:**
1. Persona escanea DNI 77777777 (no existe en sistema)
2. Sistema valida → NO_ENCONTRADO
3. LED rojo + beep largo 2x
4. Molinete NO abre
5. Operador en /admin/accesos/intentos-denegados ve DNI
6. Click "Habilitar" → Crear habilitación por 7 días
7. Persona REGRESA y escanea DNI nuevamente
8. Sistema valida → PERMITIDO (habilitación encontrada)
9. LED verde + beep corto
10. Molinete abre

**Verificar cada paso:**
- [ ] Paso 1-4: Rechazo correcto
- [ ] Paso 5: DNI aparece en lista
- [ ] Paso 6: Habilitación creada
- [ ] Paso 7-10: Segundo intento exitoso
- [ ] Registro muestra tipo HABILITACION

#### Escenario 4: Habilitación vencida ⏰

**Pasos:**
1. Crear habilitación con diasHabilitados = 0 (vence hoy)
2. Modificar manualmente fechaHasta a ayer
3. Intentar acceder con ese DNI

**Verificar:**
- [ ] Validación retorna permitido = false
- [ ] Motivo = VENCIDO
- [ ] Mensaje "Habilitación vencida"
- [ ] No abre molinete

#### Escenario 5: Límite de accesos alcanzado 🚫

**Pasos:**
1. Crear habilitación con accesosPermitidos = 2
2. Ingresar 2 veces con ese DNI
3. Intentar tercera vez

**Verificar:**
- [ ] Primeros 2 accesos: permitidos
- [ ] accesosUsados se incrementa
- [ ] Tercer intento: denegado
- [ ] Motivo = LIMITE_ALCANZADO

#### Escenario 6: Modo offline 📡

**Pasos:**
1. Servicio local sincronizado
2. Desconectar internet en PC del molinete
3. Escanear QR de socio VIGENTE

**Verificar:**
- [ ] Valida desde cache SQLite
- [ ] Acceso permitido correctamente
- [ ] Registro guardado en registros_pendientes
- [ ] Al reconectar, registros se envían
- [ ] Badge API en monitor muestra "offline"

#### Escenario 7: Control desde PWA móvil 📱

**Pasos:**
1. Operador abre app PWA en móvil
2. Escanea QR de socio (input manual)
3. Sistema valida y envía comando apertura

**Verificar:**
- [ ] Validación correcta
- [ ] Vibración en móvil
- [ ] Resultado visual claro
- [ ] Se registra con modoValidacion = MANUAL_PWA
- [ ] Molinete abre remotamente

---

## 🔧 Troubleshooting

### Problema: Lector USB no detectado

**Solución:**
```bash
cd molinete-service
npm run detectar-usb
```
- Verificar VID/PID correcto en config.json
- Probar desconectar y reconectar
- En Linux: verificar permisos udev

### Problema: WebSocket no conecta

**Solución:**
- Verificar firewall permite puerto 3002/3003
- En producción: usar wss:// (HTTPS)
- Verificar proxy/nginx config

### Problema: Cache no sincroniza

**Solución:**
```bash
# Ver logs
tail -f molinete-service/logs/molinete.log

# Forzar sync manual
curl -X POST http://localhost:3002/api/sync
```

### Problema: Service Worker no se registra

**Solución:**
- Verificar HTTPS (requerido en producción)
- Console → Application → Service Workers
- Click "Unregister" y recargar
- Verificar manifest.json válido

---

## 📊 Métricas de Éxito

Al completar todos los tests:

✅ **Backend:** 15/15 endpoints funcionando
✅ **Base de datos:** 4/4 modelos creados
✅ **Servicio local:** Hardware detectado y comunicando
✅ **Frontend:** 4/4 páginas operativas
✅ **PWA:** Instalable y funcional
✅ **Integración:** 7/7 escenarios end-to-end exitosos

**Sistema listo para producción** ✨
