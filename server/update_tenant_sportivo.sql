UPDATE tenants SET
  telefono = '0230 442-0297',
  direccion = 'Av. Tomás Márquez 1125',
  ciudad = 'Pilar',
  provincia = 'Buenos Aires',
  email = 'info@sportivopilar.com.ar',
  horarios = 'Lunes a Viernes: 9 a 20hs
Sábados: 9 a 13hs',
  redes_sociales = '{"facebook": "https://www.facebook.com/sportivopilaroficial", "instagram": "https://www.instagram.com/sportivopilaroficial", "whatsapp": "5491122606687"}',
  descripcion = 'Desde 1932, "La Caldera" es el hogar de la pasion deportiva de Pilar. Mas de 90 anos formando deportistas y comunidad.',
  slogan = 'El Rojo de la Avenida'
WHERE subdomain = 'sportivopilar'
RETURNING id, nombre, subdomain;
