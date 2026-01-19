const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================');
  console.log('  MIGRACIÓN: Grupos Familiares → titularFamiliaId');
  console.log('========================================\n');

  // 1. Verificar si existe la columna titular_familia_id
  const columnas = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'socios' AND column_name = 'titular_familia_id'
  `;

  if (columnas.length === 0) {
    console.log('Creando columna titular_familia_id...');
    await prisma.$executeRaw`
      ALTER TABLE socios ADD COLUMN titular_familia_id INT REFERENCES socios(id)
    `;
    await prisma.$executeRaw`
      CREATE INDEX idx_socios_titular_familia_id ON socios(titular_familia_id)
    `;
    console.log('✓ Columna creada');
  } else {
    console.log('Columna titular_familia_id ya existe');
  }

  // 2. Obtener todos los grupos familiares existentes
  const gruposExisten = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count FROM information_schema.tables
    WHERE table_name = 'grupos_familiares'
  `;

  if (gruposExisten[0].count === 0) {
    console.log('La tabla grupos_familiares no existe. Nada que migrar.');
    return;
  }

  const grupos = await prisma.$queryRaw`
    SELECT id, titular_id, codigo, nombre
    FROM grupos_familiares
  `;

  console.log(`\nGrupos familiares existentes: ${grupos.length}`);

  if (grupos.length === 0) {
    console.log('No hay grupos para migrar.');
    return;
  }

  // 3. Para cada grupo, actualizar los miembros con titularFamiliaId
  let miembrosActualizados = 0;

  for (const grupo of grupos) {
    // Obtener miembros del grupo (excluyendo al titular)
    const miembros = await prisma.$queryRaw`
      SELECT id, apellido_nombre, tipo_socio
      FROM socios
      WHERE grupo_familiar_id = ${grupo.id}
        AND id != ${grupo.titular_id}
    `;

    // Actualizar cada miembro con el titularFamiliaId
    for (const miembro of miembros) {
      await prisma.$executeRaw`
        UPDATE socios
        SET titular_familia_id = ${grupo.titular_id}
        WHERE id = ${miembro.id}
      `;
      miembrosActualizados++;
    }

    if (miembros.length > 0) {
      console.log(`✓ ${grupo.nombre}: Titular #${grupo.titular_id} → ${miembros.length} miembro(s)`);
    }
  }

  console.log('\n========================================');
  console.log('  RESUMEN');
  console.log('========================================');
  console.log(`Grupos procesados: ${grupos.length}`);
  console.log(`Miembros actualizados con titularFamiliaId: ${miembrosActualizados}`);

  // 4. Limpiar grupoFamiliarId de todos los socios
  await prisma.$executeRaw`
    UPDATE socios SET grupo_familiar_id = NULL
  `;
  console.log('\n✓ Campo grupo_familiar_id limpiado');

  // 5. Eliminar la tabla grupos_familiares
  console.log('\nEliminando tabla grupos_familiares...');
  await prisma.$executeRaw`DROP TABLE IF EXISTS grupos_familiares CASCADE`;
  console.log('✓ Tabla grupos_familiares eliminada');

  // 6. Eliminar la columna grupo_familiar_id de socios
  console.log('Eliminando columna grupo_familiar_id...');
  await prisma.$executeRaw`ALTER TABLE socios DROP COLUMN IF EXISTS grupo_familiar_id`;
  console.log('✓ Columna grupo_familiar_id eliminada');

  // 7. Eliminar la columna es_titular_grupo de socios (ya no es necesaria)
  console.log('Eliminando columna es_titular_grupo...');
  await prisma.$executeRaw`ALTER TABLE socios DROP COLUMN IF EXISTS es_titular_grupo`;
  console.log('✓ Columna es_titular_grupo eliminada');

  console.log('\n========================================');
  console.log('  ✓ MIGRACIÓN COMPLETADA');
  console.log('========================================');
  console.log('\nVerificación:');

  // Verificar resultado
  const verificacion = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*) FROM socios WHERE tipo_socio = 'Titular Familia')::int as titulares,
      (SELECT COUNT(*) FROM socios WHERE tipo_socio = 'Miembro Familia')::int as miembros,
      (SELECT COUNT(*) FROM socios WHERE titular_familia_id IS NOT NULL)::int as con_titular
  `;

  console.log(`  Titulares de familia: ${verificacion[0].titulares}`);
  console.log(`  Miembros de familia: ${verificacion[0].miembros}`);
  console.log(`  Socios con titularFamiliaId asignado: ${verificacion[0].con_titular}`);

  console.log('\nAhora ejecute: npx prisma db pull');
  console.log('Y luego: npx prisma generate');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
