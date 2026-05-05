import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, 'cache.db')
const db = new Database(dbPath)

// Habilitar WAL mode para mejor concurrencia
db.pragma('journal_mode = WAL')

/**
 * Inicializar esquema de base de datos
 */
export function inicializarDB() {
  // Tabla de socios
  db.exec(`
    CREATE TABLE IF NOT EXISTS socios (
      id INTEGER PRIMARY KEY,
      nroSocio TEXT,
      apellidoNombre TEXT,
      documento TEXT,
      estado TEXT,
      tokenPortal TEXT,
      rfidUid TEXT,
      permiteIngresoMolinete INTEGER DEFAULT 0,
      estadoNombre TEXT,
      UNIQUE(tokenPortal),
      UNIQUE(rfidUid)
    )
  `)

  // Migración suave: agregar columnas si la tabla ya existía sin ellas
  try { db.exec(`ALTER TABLE socios ADD COLUMN permiteIngresoMolinete INTEGER DEFAULT 0`) } catch (_) {}
  try { db.exec(`ALTER TABLE socios ADD COLUMN estadoNombre TEXT`) } catch (_) {}

  // Índices para búsqueda rápida
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_socios_documento ON socios(documento);
    CREATE INDEX IF NOT EXISTS idx_socios_tokenPortal ON socios(tokenPortal);
    CREATE INDEX IF NOT EXISTS idx_socios_rfidUid ON socios(rfidUid);
  `)

  // Tabla de habilitaciones temporales
  db.exec(`
    CREATE TABLE IF NOT EXISTS habilitaciones (
      id INTEGER PRIMARY KEY,
      documento TEXT,
      nombreCompleto TEXT,
      fechaDesde TEXT,
      fechaHasta TEXT,
      accesosPermitidos INTEGER,
      accesosUsados INTEGER,
      horarioDesde TEXT,
      horarioHasta TEXT,
      motivo TEXT
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_habilitaciones_documento ON habilitaciones(documento);
  `)

  // Tabla de registros pendientes (cuando está offline)
  db.exec(`
    CREATE TABLE IF NOT EXISTS registros_pendientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispositivoId INTEGER,
      socioId INTEGER,
      habilitacionTemporalId INTEGER,
      tipoLectura TEXT,
      valorLeido TEXT,
      resultado TEXT,
      motivoRechazo TEXT,
      modoValidacion TEXT,
      fecha TEXT,
      enviado INTEGER DEFAULT 0
    )
  `)

  // Tabla de metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      clave TEXT PRIMARY KEY,
      valor TEXT
    )
  `)

  console.log('✓ Base de datos SQLite inicializada')
}

/**
 * Actualizar cache con datos del servidor
 */
export function actualizarCache(socios, habilitaciones) {
  const transaction = db.transaction(() => {
    // Limpiar tablas
    db.exec('DELETE FROM socios')
    db.exec('DELETE FROM habilitaciones')

    // Insertar socios
    const insertSocio = db.prepare(`
      INSERT INTO socios (id, nroSocio, apellidoNombre, documento, estado, tokenPortal, rfidUid, permiteIngresoMolinete, estadoNombre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const socio of socios) {
      insertSocio.run(
        socio.id,
        socio.nroSocio,
        socio.apellidoNombre,
        socio.documento,
        socio.estado,
        socio.tokenPortal,
        socio.rfidUid,
        socio.permiteIngresoMolinete ? 1 : 0,
        socio.estadoNombre || null
      )
    }

    // Insertar habilitaciones
    const insertHabilitacion = db.prepare(`
      INSERT INTO habilitaciones (id, documento, nombreCompleto, fechaDesde, fechaHasta,
                                   accesosPermitidos, accesosUsados, horarioDesde, horarioHasta, motivo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const hab of habilitaciones) {
      insertHabilitacion.run(
        hab.id,
        hab.documento,
        hab.nombreCompleto,
        hab.fechaDesde,
        hab.fechaHasta,
        hab.accesosPermitidos,
        hab.accesosUsados,
        hab.horarioDesde,
        hab.horarioHasta,
        hab.motivo
      )
    }

    // Actualizar timestamp
    db.prepare('INSERT OR REPLACE INTO metadata (clave, valor) VALUES (?, ?)').run(
      'ultimo_sync',
      new Date().toISOString()
    )
  })

  transaction()
  console.log(`✓ Cache actualizado: ${socios.length} socios, ${habilitaciones.length} habilitaciones`)
}

/**
 * Buscar socio por QR (tokenPortal)
 */
export function buscarPorQR(tokenPortal) {
  const stmt = db.prepare('SELECT * FROM socios WHERE tokenPortal = ?')
  return stmt.get(tokenPortal)
}

/**
 * Buscar socio por DNI
 */
export function buscarPorDNI(documento) {
  const stmt = db.prepare('SELECT * FROM socios WHERE documento = ?')
  return stmt.get(documento)
}

/**
 * Buscar socio por RFID
 */
export function buscarPorRFID(rfidUid) {
  const stmt = db.prepare('SELECT * FROM socios WHERE rfidUid = ?')
  return stmt.get(rfidUid)
}

/**
 * Buscar habilitación por DNI
 */
export function buscarHabilitacionPorDNI(documento) {
  const stmt = db.prepare('SELECT * FROM habilitaciones WHERE documento = ? ORDER BY id DESC LIMIT 1')
  return stmt.get(documento)
}

/**
 * Guardar registro pendiente para enviar cuando vuelva online
 */
export function guardarRegistroPendiente(registro) {
  const stmt = db.prepare(`
    INSERT INTO registros_pendientes
    (dispositivoId, socioId, habilitacionTemporalId, tipoLectura, valorLeido,
     resultado, motivoRechazo, modoValidacion, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    registro.dispositivoId,
    registro.socioId || null,
    registro.habilitacionTemporalId || null,
    registro.tipoLectura,
    registro.valorLeido,
    registro.resultado,
    registro.motivoRechazo || null,
    registro.modoValidacion,
    registro.fecha || new Date().toISOString()
  )
}

/**
 * Obtener registros pendientes de enviar
 */
export function obtenerRegistrosPendientes() {
  const stmt = db.prepare('SELECT * FROM registros_pendientes WHERE enviado = 0')
  return stmt.all()
}

/**
 * Marcar registro como enviado
 */
export function marcarRegistroEnviado(id) {
  const stmt = db.prepare('UPDATE registros_pendientes SET enviado = 1 WHERE id = ?')
  stmt.run(id)
}

/**
 * Obtener metadata
 */
export function obtenerMetadata(clave) {
  const stmt = db.prepare('SELECT valor FROM metadata WHERE clave = ?')
  const row = stmt.get(clave)
  return row ? row.valor : null
}

/**
 * Obtener estadísticas del cache
 */
export function obtenerEstadisticas() {
  const socios = db.prepare('SELECT COUNT(*) as count FROM socios').get()
  const habilitaciones = db.prepare('SELECT COUNT(*) as count FROM habilitaciones').get()
  const pendientes = db.prepare('SELECT COUNT(*) as count FROM registros_pendientes WHERE enviado = 0').get()
  const ultimoSync = obtenerMetadata('ultimo_sync')

  return {
    sociosEnCache: socios.count,
    habilitacionesEnCache: habilitaciones.count,
    registrosPendientes: pendientes.count,
    ultimoSync: ultimoSync ? new Date(ultimoSync) : null
  }
}

export default db
