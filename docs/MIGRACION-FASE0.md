# Registro de Migración - Fase 0

## Estado Inicial (antes de migración)

### Modelos existentes
- Socio (con tokenPortal para QR)
- Comercio
- Venta
- Rubro
- Admin
- Configuracion

### Datos actuales a preservar
- Todos los socios con sus tokens
- Comercios y sus configuraciones
- Historial de ventas
- Usuarios admin
- Configuraciones del sistema

---

## Etapa 0.1: Backup y Preparación
- [x] Crear rama `feature/gestion-club`
- [x] Documentar estado actual

## Etapa 0.2: Schema Parte 1 - Socios Extendido
Agregar campos nuevos a Socio y crear modelos relacionados.

**Nuevos campos en Socio:**
- tipoDocumento, cuil
- apellido, nombre (separados)
- lugarNacimiento, sexo, nacionalidad, estadoCivil, profesion
- fotoUrl
- emailSecundario, telefonoFijo, celularSecundario
- calle, numero, piso, depto, barrio, codigoPostal, provincia
- fechaAlta, fechaBaja, motivoBaja
- esMenor, responsableId, parentescoResponsable
- Datos médicos: grupoSanguineo, obraSocial, etc.
- Contactos de emergencia
- grupoFamiliarId, esTitularGrupo
- observaciones, observacionesInternas
- creadoPor, actualizadoPor

**Nuevos modelos:**
- GrupoFamiliar
- AutorizacionMenor

## Etapa 0.3: Schema Parte 2 - Deportes y Cuotas
- Deporte
- Categoria
- Inscripcion
- EntrenadorCategoria
- TipoCuota
- ConfiguracionCuota
- ConfiguracionRecargo
- PeriodoCuota
- Cuota

## Etapa 0.4: Schema Parte 3 - Pagos y Caja
- MedioPago
- Pago
- SaldoFavor
- AplicacionSaldo
- Caja
- CuentaBancaria
- CuentaContable
- MovimientoCaja

## Etapa 0.5: Schema Parte 4 - Roles y Permisos
- Rol
- Permiso
- PermisoRol
- Modificar Admin para agregar rolId
- AuditLog

## Etapa 0.6: Seeds Iniciales
- Tipos de cuota
- Medios de pago
- Cuentas contables básicas
- Roles y permisos
- Configuraciones base

---

## Notas de Implementación

### Estrategia de migración
1. Usar `prisma db push` para desarrollo
2. Generar migraciones formales con `prisma migrate dev` antes de producción
3. Todos los campos nuevos son opcionales (nullable) para no romper datos existentes
4. El campo `apellidoNombre` se mantiene para compatibilidad

### Verificación
Después de cada etapa:
- [ ] Verificar que la BD esté correcta con `prisma studio`
- [ ] Verificar que el servidor arranque sin errores
- [ ] Verificar que funcionalidades existentes sigan operando
