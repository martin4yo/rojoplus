/**
 * Script para asignar periodos a cuotas de FINANCIACION que no lo tienen
 *
 * Uso: node scripts/fix-financiacion-periodos.js
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

async function main() {
  console.log('Buscando cuotas de FINANCIACION sin periodo...')

  // Buscar cuotas de FINANCIACION sin periodoId
  const cuotasSinPeriodo = await prisma.cargo.findMany({
    where: {
      categoria: 'FINANCIACION',
      periodoId: null,
    },
  })

  console.log(`Encontradas ${cuotasSinPeriodo.length} cuotas sin periodo`)

  if (cuotasSinPeriodo.length === 0) {
    console.log('No hay cuotas para actualizar.')
    return
  }

  let actualizadas = 0
  let periodosCreados = 0

  for (const cuota of cuotasSinPeriodo) {
    if (!cuota.fechaVencimiento) {
      console.log(`  Cuota ${cuota.id} no tiene fecha de vencimiento, saltando...`)
      continue
    }

    const fecha = new Date(cuota.fechaVencimiento)
    const mes = fecha.getMonth() + 1
    const anio = fecha.getFullYear()
    const nombrePeriodo = `${meses[mes]} ${anio}`

    // Buscar o crear periodo
    let periodo = await prisma.periodo.findFirst({
      where: { mes, anio },
    })

    if (!periodo) {
      // La fecha de vencimiento del periodo es el día 10 del mes (o configurable)
      const fechaVencPeriodo = new Date(anio, mes - 1, 10)
      periodo = await prisma.periodo.create({
        data: {
          nombre: nombrePeriodo,
          mes,
          anio,
          fechaVencimiento: fechaVencPeriodo,
          estado: 'ABIERTO',
        },
      })
      periodosCreados++
      console.log(`  Creado periodo: ${nombrePeriodo}`)
    }

    // Actualizar cuota
    await prisma.cargo.update({
      where: { id: cuota.id },
      data: { periodoId: periodo.id },
    })

    actualizadas++
    console.log(`  Cuota ${cuota.id} -> Periodo: ${nombrePeriodo}`)
  }

  console.log(`\nResumen:`)
  console.log(`  Cuotas actualizadas: ${actualizadas}`)
  console.log(`  Periodos creados: ${periodosCreados}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
