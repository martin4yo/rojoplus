# Estado del Proyecto — Clubix

> Actualizado: **2026-07-23**. Reemplaza al `docs/ROADMAP.md` (de abril, desactualizado) como fuente de verdad del estado.
> Métricas: **178** modelos Prisma · **95** archivos de rutas · **185** páginas admin · **4** archivos de tests.

Stack: React + Vite + Tailwind · Node + Express + Prisma + Socket.io · PostgreSQL · Multi-tenant.

---

## ✅ Módulos completados (en producción)

| Módulo | Notas |
|---|---|
| Socios, Grupos Familiares, Padrón | Alta, edición, pase de categoría, importación Excel |
| Cuotas, Cobranzas, Recupero | Generación, badges de estado, campañas de recupero (con inbox IMAP) |
| Financiero | Tesorería, Caja, Contabilidad, Asientos, Centros de Costo, Liquidaciones, Presupuesto |
| Conciliación Bancaria | Importación de extractos, matching, eCheqs |
| Débito Automático | Prisma (TXT) + **Payway** (API REST, tokenización, webhook) — bancos Galicia y Macro |
| Facturación Electrónica | AFIP WSAA/WSFE/QR |
| Buffet / Kiosco / TakeAway | POS, comandas, impresión ESC/POS, menú público |
| Control de Accesos | Dispositivos RFID/USB, registro de accesos |
| Deportes | Actividades, Categorías, Partidos, Convocatorias, Staff técnico, Seguimiento médico |
| Eventos | Con cobro |
| Portal del Socio (PWA) | Push notifications, cuenta corriente, pagos MP |
| Comunicaciones | Email, WhatsApp (Evolution), Push, colas, plantillas por tenant, morosidad temprana |
| Reservas | Espacios, recordatorios, cierre automático |
| Tienda / e-commerce | Pedidos, MercadoPago |
| Sitio Institucional + Landing corporativa | Identidad Axioma |
| Permisos / Roles / Usuarios / Menú / Gobernanza | |
| Branding por tenant | Paleta, logos |
| Multi-Tenant (Fases 1–6) | Super-Admin Panel, Registro Público de Club |
| ROJO IA — Asistente | actionExecutor (con stubs pendientes, ver abajo) |
| Gestión de Crons | Catálogo + switches por tenant (master pause `CRONS_PAUSADOS` + flag individual) |

---

## 🔨 Pendiente de desarrollar (verificado)

### Débito bancario por banco (ROADMAP 35.17–35.20)
- [ ] Formato de archivo **Banco Santander** (35.17)
- [ ] Formato de archivo **Banco Provincia** (35.18)
- [ ] Importación de respuestas por banco (35.19)
- [ ] UI para seleccionar banco en la generación (35.20)

### Deploy y multi-tenant
- [ ] **Deploy del split de débito a producción** — hecho en dev, prod sigue con el esquema viejo. Secuencia: export configs → `DELETE` acotado (nunca `TRUNCATE CASCADE`) → `prisma db push` → `migrarConfiguracionDebitoAProcesador.js`.
- [ ] **Deploy productivo / DNS** (Multi-Tenant "Fase 7").

### Calidad
- [ ] **Ampliar testing** — hay 4 tests (`accesos`, `auth`, `cuotas`, `tenant`); cobertura parcial.
- [ ] Verificar hashing en registro público `/register` (el login admin ya usa bcrypt).

---

## 📝 TODOs reales en el código (menores)

- **`services/actionExecutor.js`** (IA): stubs sin implementar — baja de actividad, confirmación de convocatoria, pedido takeaway, cierre de mesa con cobro, reporte de ventas.
- **`routes/socio.js`**: integración con **MODO** (pagos), 2 lugares.
- **`routes/eventos.js`**: MercadoPago SDK v2 ("FASE 2.5").
- **`routes/admin/configuracion.js`**: modelo `ConfiguracionFiscal` en Prisma.
- **`routes/chat.js`**: `userId` hardcodeado (obtener del token); OCR de imágenes.
- **`routes/debitoAutomatico.js:507`**: verificar si es el primer débito del socio.

### Crons de infraestructura fuera del catálogo (opcional exponerlos)
`procesarCola` (cola de notif.), `inboxRecupero` (IMAP), `expiracionReservas` (tienda). No respetan `CRONS_PAUSADOS` por diseño (son plumbing).

---

## 🗄️ Entornos

| Entorno | Acceso | Notas |
|---|---|---|
| **Desarrollo** | `localhost:5433` / `clubix_db` | Espejo de producción (restaurado 2026-07-22) |
| **Producción** | VPS `vps-5969131` :5432 (túnel SSH `localhost:5436`) | pgBackRest stanza `clubix` (repo1 remoto + repo2 S3 Cloudflare R2), backups automáticos horarios |

`server/.env` está gitignoreado (credenciales fuera del repo). Nunca desarrollar contra producción.

---

## 📌 Notas de la última sesión (2026-07-22/23)

- Split del modelo de débito (`ProcesadorDebito` global + `ConfiguracionDebito` por tenant) — aplicado y commiteado en dev, **pendiente prod**.
- Incidente y recuperación de la base de producción (truncate accidental → PITR con pgBackRest). Lección: `DELETE` acotado, nunca `TRUNCATE CASCADE`.
- Crons de reservas/pasajes agregados al catálogo (UI) + ahora respetan el pausado.
- Morosidad temprana por streak de períodos impagos.
