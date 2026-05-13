import prisma from '../lib/prisma.js'
import soap from 'soap'
import { AppError } from '../middleware/errorHandler.js'
import { getTicketAcceso, getConfiguracionFiscal, resolverConexionAfip } from './afipWSAAService.js'

function resolverWsfeUrl(conn) {
  if (conn.wsfeUrl) return conn.wsfeUrl
  return conn.environment === 'PRODUCTION'
    ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL'
    : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL'
}

/**
 * Obtiene el último número de comprobante autorizado en AFIP
 * @param {number} puntoVenta
 * @param {number} tipoComprobante
 * @param {Object} [opts]
 * @param {number} [opts.afipConnectionId] - Id de AfipConnection a usar (sino default)
 */
export async function getLastAuthorizedNumber(puntoVenta, tipoComprobante, { afipConnectionId } = {}) {
  try {
    const conn = await resolverConexionAfip({ connectionId: afipConnectionId })
    const ta = await getTicketAcceso({ connectionId: afipConnectionId })
    const wsfeUrl = resolverWsfeUrl(conn)

    const client = await soap.createClientAsync(wsfeUrl)

    const result = await client.FECompUltimoAutorizadoAsync({
      Auth: {
        Token: ta.token,
        Sign: ta.sign,
        Cuit: conn.cuit.replace(/\D/g, '')
      },
      PtoVta: puntoVenta,
      CbteTipo: tipoComprobante
    })

    const response = result[0].FECompUltimoAutorizadoResult

    if (response.Errors) {
      const errors = Array.isArray(response.Errors.Err) ? response.Errors.Err : [response.Errors.Err]
      const primaryError = errors[0]
      throw new AppError(`Error AFIP: ${primaryError.Msg}`, 400, { code: primaryError.Code })
    }

    const lastNumber = parseInt(response.CbteNro)
    console.log(`[WSFE] Último comprobante autorizado PV${puntoVenta} Tipo${tipoComprobante}: ${lastNumber}`)

    return lastNumber
  } catch (error) {
    if (error instanceof AppError) throw error
    console.error('[WSFE] Error consultando último número:', error.message)
    return 0 // En caso de error, retornar 0 para usar numeración local
  }
}

/**
 * Solicita CAE (Código de Autorización Electrónica) a AFIP
 *
 * @param {Object} voucherData - Datos del comprobante
 * @param {number} voucherData.puntoVenta - Punto de venta
 * @param {number} voucherData.tipoComprobante - Código tipo comprobante AFIP (1=FA, 6=FB, 11=FC)
 * @param {number} voucherData.numeroComprobante - Número de comprobante
 * @param {Date} voucherData.fecha - Fecha del comprobante
 * @param {number} voucherData.tipoDocCliente - Tipo doc cliente (80=CUIT, 96=DNI, 99=CF)
 * @param {string} voucherData.docCliente - Número de documento
 * @param {number} voucherData.condicionIvaCliente - Condición IVA AFIP (1=RI, 5=CF, etc.)
 * @param {number} voucherData.subtotal - Subtotal sin IVA
 * @param {number} voucherData.iva - Importe IVA
 * @param {number} voucherData.total - Total del comprobante
 * @param {Array} voucherData.items - Items del comprobante
 */
export async function requestCAE(voucherData) {
  try {
    const conn = await resolverConexionAfip({ connectionId: voucherData.afipConnectionId })
    const ta = await getTicketAcceso({ connectionId: voucherData.afipConnectionId })
    const wsfeUrl = resolverWsfeUrl(conn)
    const client = await soap.createClientAsync(wsfeUrl)

    // Helper para redondear a 2 decimales
    const round2 = (num) => Number((Math.round(num * 100) / 100).toFixed(2))

    // Determinar si es comprobante tipo C (no discrimina IVA)
    const isTypeC = [11, 12, 13].includes(voucherData.tipoComprobante)

    // DocNro: si es Consumidor Final (99), usar 0
    const docNro = voucherData.docCliente && voucherData.tipoDocCliente !== 99
      ? voucherData.docCliente.replace(/\D/g, '')
      : 0

    // Condición IVA del receptor
    const ivaReceptor = voucherData.condicionIvaCliente || 5 // Default: Consumidor Final

    // Formatear fecha YYYYMMDD
    const fechaStr = voucherData.fecha.toISOString().slice(0, 10).replace(/-/g, '')

    // Request base
    const feCAEDetRequest = {
      Concepto: 1, // 1=Productos
      DocTipo: voucherData.tipoDocCliente,
      DocNro: docNro,
      CbteDesde: voucherData.numeroComprobante,
      CbteHasta: voucherData.numeroComprobante,
      CbteFch: fechaStr,
      ImpTotal: round2(voucherData.total),
      ImpTotConc: 0, // No gravado
      ImpOpEx: 0, // Exento
      ImpTrib: 0, // Otros tributos
      MonId: 'PES',
      MonCotiz: 1,
      CondicionIVAReceptorId: ivaReceptor
    }

    if (isTypeC) {
      // Comprobante C: no discrimina IVA
      feCAEDetRequest.ImpNeto = round2(voucherData.total)
      feCAEDetRequest.ImpIVA = 0
      console.log('[WSFE] Comprobante tipo C - No se discrimina IVA')
    } else {
      // Comprobante A/B: discrimina IVA
      feCAEDetRequest.ImpNeto = round2(voucherData.subtotal)
      feCAEDetRequest.ImpIVA = round2(voucherData.iva)

      // Agrupar items por alícuota de IVA
      if (voucherData.items?.length > 0) {
        const alicuotasMap = new Map()

        voucherData.items.forEach(item => {
          let alicuotaId = 3 // Default: 0%
          if (item.ivaAmount > 0) {
            if (item.ivaRate === 21) alicuotaId = 5 // 21%
            else if (item.ivaRate === 10.5) alicuotaId = 4 // 10.5%
          }

          const baseImponible = item.subtotal - item.ivaAmount

          const existing = alicuotasMap.get(alicuotaId)
          if (existing) {
            existing.baseImp += baseImponible
            existing.importe += item.ivaAmount
          } else {
            alicuotasMap.set(alicuotaId, {
              baseImp: baseImponible,
              importe: item.ivaAmount
            })
          }
        })

        feCAEDetRequest.Iva = {
          AlicIva: Array.from(alicuotasMap.entries()).map(([id, values]) => ({
            Id: id,
            BaseImp: round2(values.baseImp),
            Importe: round2(values.importe)
          }))
        }
      }
    }

    const request = {
      Auth: {
        Token: ta.token,
        Sign: ta.sign,
        Cuit: conn.cuit.replace(/\D/g, '')
      },
      FeCAEReq: {
        FeCabReq: {
          CantReg: 1,
          PtoVta: voucherData.puntoVenta,
          CbteTipo: voucherData.tipoComprobante
        },
        FeDetReq: {
          FECAEDetRequest: feCAEDetRequest
        }
      }
    }

    console.log('[WSFE] Solicitando CAE...')
    console.log(JSON.stringify(request, null, 2))

    const result = await client.FECAESolicitarAsync(request)
    const response = result[0].FECAESolicitarResult

    // Verificar errores
    if (response.Errors) {
      const errors = Array.isArray(response.Errors.Err) ? response.Errors.Err : [response.Errors.Err]
      const errorDetails = errors.map(err => `[${err.Code}] ${err.Msg}`).join('\n')
      throw new AppError(`Error AFIP: ${errors[0].Msg}`, 400, { afipErrors: errors, detail: errorDetails })
    }

    const detalle = response.FeDetResp.FECAEDetResponse[0]

    // Verificar resultado
    if (detalle.Resultado !== 'A') {
      const observations = detalle.Observaciones?.Obs || []
      const obsArray = Array.isArray(observations) ? observations : [observations]
      const obsDetails = obsArray.map(obs => `[${obs.Code}] ${obs.Msg}`).join('\n')
      throw new AppError(
        `Comprobante rechazado por AFIP: ${obsArray[0]?.Msg || 'Sin detalles'}`,
        400,
        { afipObservations: obsArray, detail: obsDetails }
      )
    }

    const cae = detalle.CAE
    const caeExpiration = new Date(
      detalle.CAEFchVto.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
    )

    console.log(`[WSFE] CAE obtenido: ${cae}, vence: ${caeExpiration}`)

    return {
      cae,
      caeExpiration,
      afipResponse: response
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    console.error('[WSFE] Error solicitando CAE:', error.message)
    throw new AppError(`Error comunicándose con AFIP: ${error.message}`, 500)
  }
}

/**
 * Consulta estado del servidor AFIP (para testing)
 */
export async function getServerStatus({ afipConnectionId } = {}) {
  try {
    const conn = await resolverConexionAfip({ connectionId: afipConnectionId })
    const wsfeUrl = resolverWsfeUrl(conn)

    const client = await soap.createClientAsync(wsfeUrl)
    const result = await client.FEDummyAsync()
    const response = result[0].FEDummyResult

    return {
      appServer: response.AppServer,
      dbServer: response.DbServer,
      authServer: response.AuthServer,
      ambiente: conn.environment === 'PRODUCTION' ? 'producción' : 'homologación'
    }
  } catch (error) {
    throw new AppError(`Error consultando estado del servidor: ${error.message}`, 500)
  }
}

/**
 * Códigos de tipo de comprobante AFIP
 */
export const TIPOS_COMPROBANTE = {
  FACTURA_A: 1,
  NOTA_DEBITO_A: 2,
  NOTA_CREDITO_A: 3,
  FACTURA_B: 6,
  NOTA_DEBITO_B: 7,
  NOTA_CREDITO_B: 8,
  FACTURA_C: 11,
  NOTA_DEBITO_C: 12,
  NOTA_CREDITO_C: 13
}

/**
 * Códigos de tipo de documento AFIP
 */
export const TIPOS_DOCUMENTO = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  CONSUMIDOR_FINAL: 99
}

/**
 * Códigos de condición IVA AFIP
 */
export const CONDICIONES_IVA = {
  RESPONSABLE_INSCRIPTO: 1,
  NO_RESPONSABLE: 3,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTISTA: 6
}
