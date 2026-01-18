import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🔑 Generando tokens para socios existentes...');

  // Buscar socios sin token
  const sociosSinToken = await prisma.socio.findMany({
    where: { tokenPortal: null },
    select: { id: true, nroSocio: true },
  });

  console.log(`   Encontrados ${sociosSinToken.length} socios sin token`);

  if (sociosSinToken.length === 0) {
    console.log('✅ Todos los socios ya tienen token');
    return;
  }

  // Generar tokens
  let actualizados = 0;
  for (const socio of sociosSinToken) {
    await prisma.socio.update({
      where: { id: socio.id },
      data: { tokenPortal: uuidv4() },
    });
    actualizados++;
    if (actualizados % 100 === 0) {
      console.log(`   Procesados ${actualizados}/${sociosSinToken.length}...`);
    }
  }

  console.log(`✅ ${actualizados} tokens generados`);
}

main()
  .catch((e) => {
    console.error('❌ Error generando tokens:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
