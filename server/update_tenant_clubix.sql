UPDATE tenants SET
  telefono = '011 4567-8901',
  direccion = 'Av. Corrientes 1234',
  ciudad = 'Buenos Aires',
  provincia = 'CABA',
  email = 'info@clubixsport.com.ar',
  horarios = 'Lunes a Viernes: 8 a 22hs
Sabados y Domingos: 9 a 18hs',
  redes_sociales = '{"facebook": "https://www.facebook.com/clubixsport", "instagram": "https://www.instagram.com/clubixsport", "whatsapp": "5491187654321"}',
  descripcion = 'Clubix Sport es la plataforma deportiva del futuro. Gestion inteligente, comunidad activa y deporte de primer nivel.',
  slogan = 'El futuro del deporte'
WHERE subdomain = 'clubix-sport'
RETURNING id, nombre, subdomain;
