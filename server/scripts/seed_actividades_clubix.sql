BEGIN;

INSERT INTO actividades (codigo, nombre, descripcion, requiere_apta_fisica, cuota_mensual, color, activo, orden, created_at, updated_at, tenant_id)
VALUES
  ('FUTBOL',     'Futbol',      'Futbol 11 y futbol juvenil',              true,  15000, '#22c55e', true, 1,  NOW(), NOW(), 3),
  ('BASQUET',    'Basquet',     'Basquetbol masculino y femenino',         true,  12000, '#f97316', true, 2,  NOW(), NOW(), 3),
  ('VOLEY',      'Voley',       'Voleibol masculino y femenino',           true,  12000, '#3b82f6', true, 3,  NOW(), NOW(), 3),
  ('NATACION',   'Natacion',    'Clases de natacion para todas las edades',true,  18000, '#06b6d4', true, 4,  NOW(), NOW(), 3),
  ('TENIS',      'Tenis',       'Escuela de tenis y torneos',              false, 20000, '#eab308', true, 5,  NOW(), NOW(), 3),
  ('PADEL',      'Padel',       'Canchas de padel y clases',               false, 18000, '#a855f7', true, 6,  NOW(), NOW(), 3),
  ('HOCKEY',     'Hockey',      'Hockey sobre cesped femenino',            true,  14000, '#ec4899', true, 7,  NOW(), NOW(), 3),
  ('GIMNASIA',   'Gimnasia',    'Gimnasia artistica y ritmica',            false, 10000, '#f43f5e', true, 8,  NOW(), NOW(), 3),
  ('ATLETISMO',  'Atletismo',   'Pista y campo, cross y maraton',          true,  10000, '#64748b', true, 9,  NOW(), NOW(), 3),
  ('MUSCULACION','Musculacion', 'Sala de musculacion y fitness',           false, 12000, '#78716c', true, 10, NOW(), NOW(), 3);

-- Categorias Futbol
INSERT INTO categorias_actividad (actividad_id, codigo, nombre, descripcion, edad_minima, edad_maxima, sexo, cuota_mensual, activo, orden, created_at, updated_at, tenant_id)
SELECT id,'FUT-SUB6',   'Sub 6',   'Categoria sub 6',   4,  6,   'MASCULINO',12000,true,1,NOW(),NOW(),3 FROM actividades WHERE codigo='FUTBOL' AND tenant_id=3 UNION ALL
SELECT id,'FUT-SUB8',   'Sub 8',   'Categoria sub 8',   7,  8,   'MASCULINO',12000,true,2,NOW(),NOW(),3 FROM actividades WHERE codigo='FUTBOL' AND tenant_id=3 UNION ALL
SELECT id,'FUT-SUB10',  'Sub 10',  'Categoria sub 10',  9,  10,  'MASCULINO',12000,true,3,NOW(),NOW(),3 FROM actividades WHERE codigo='FUTBOL' AND tenant_id=3 UNION ALL
SELECT id,'FUT-SUB12',  'Sub 12',  'Categoria sub 12',  11, 12,  'MASCULINO',13000,true,4,NOW(),NOW(),3 FROM actividades WHERE codigo='FUTBOL' AND tenant_id=3 UNION ALL
SELECT id,'FUT-SUB15',  'Sub 15',  'Categoria sub 15',  13, 15,  'MASCULINO',13000,true,5,NOW(),NOW(),3 FROM actividades WHERE codigo='FUTBOL' AND tenant_id=3 UNION ALL
SELECT id,'FUT-PRIMERA','Primera', 'Primera division',  16, NULL,'MASCULINO',15000,true,6,NOW(),NOW(),3 FROM actividades WHERE codigo='FUTBOL' AND tenant_id=3;

-- Categorias Basquet
INSERT INTO categorias_actividad (actividad_id, codigo, nombre, descripcion, edad_minima, edad_maxima, sexo, cuota_mensual, activo, orden, created_at, updated_at, tenant_id)
SELECT id,'BAS-INFANTIL','Infantil','Categoria infantil',8,  12,  'AMBOS',    10000,true,1,NOW(),NOW(),3 FROM actividades WHERE codigo='BASQUET' AND tenant_id=3 UNION ALL
SELECT id,'BAS-CADETE',  'Cadete',  'Categoria cadete',  13, 17,  'AMBOS',    11000,true,2,NOW(),NOW(),3 FROM actividades WHERE codigo='BASQUET' AND tenant_id=3 UNION ALL
SELECT id,'BAS-PRIMERA', 'Primera', 'Primera division',  18, NULL,'MASCULINO',12000,true,3,NOW(),NOW(),3 FROM actividades WHERE codigo='BASQUET' AND tenant_id=3 UNION ALL
SELECT id,'BAS-FEM',     'Femenino','Division femenina',  16, NULL,'FEMENINO', 12000,true,4,NOW(),NOW(),3 FROM actividades WHERE codigo='BASQUET' AND tenant_id=3;

-- Categorias Voley
INSERT INTO categorias_actividad (actividad_id, codigo, nombre, descripcion, edad_minima, edad_maxima, sexo, cuota_mensual, activo, orden, created_at, updated_at, tenant_id)
SELECT id,'VOL-MINI',   'Mini',    'Mini voley',        8,  12,  'AMBOS',    10000,true,1,NOW(),NOW(),3 FROM actividades WHERE codigo='VOLEY' AND tenant_id=3 UNION ALL
SELECT id,'VOL-CADETE', 'Cadete',  'Cadete',            13, 17,  'AMBOS',    11000,true,2,NOW(),NOW(),3 FROM actividades WHERE codigo='VOLEY' AND tenant_id=3 UNION ALL
SELECT id,'VOL-ADULTOS','Adultos', 'Division adultos',  18, NULL,'AMBOS',    12000,true,3,NOW(),NOW(),3 FROM actividades WHERE codigo='VOLEY' AND tenant_id=3;

-- Categorias Natacion
INSERT INTO categorias_actividad (actividad_id, codigo, nombre, descripcion, edad_minima, edad_maxima, sexo, cuota_mensual, activo, orden, created_at, updated_at, tenant_id)
SELECT id,'NAT-BEBES',  'Bebes',  'Natacion bebes 0-3',0,  3,   'AMBOS',16000,true,1,NOW(),NOW(),3 FROM actividades WHERE codigo='NATACION' AND tenant_id=3 UNION ALL
SELECT id,'NAT-NINOS',  'Ninos',  'Ninos 4-12 anos',   4,  12,  'AMBOS',16000,true,2,NOW(),NOW(),3 FROM actividades WHERE codigo='NATACION' AND tenant_id=3 UNION ALL
SELECT id,'NAT-ADULTOS','Adultos','Adultos +13 anos',  13, NULL,'AMBOS',18000,true,3,NOW(),NOW(),3 FROM actividades WHERE codigo='NATACION' AND tenant_id=3;

-- Categorias Tenis
INSERT INTO categorias_actividad (actividad_id, codigo, nombre, descripcion, edad_minima, edad_maxima, sexo, cuota_mensual, activo, orden, created_at, updated_at, tenant_id)
SELECT id,'TEN-ESCUELA','Escuela','Escuela de tenis',  6,  14,  'AMBOS',18000,true,1,NOW(),NOW(),3 FROM actividades WHERE codigo='TENIS' AND tenant_id=3 UNION ALL
SELECT id,'TEN-ADULTOS','Adultos','Adultos',           15, NULL,'AMBOS',20000,true,2,NOW(),NOW(),3 FROM actividades WHERE codigo='TENIS' AND tenant_id=3;

-- Categorias Padel
INSERT INTO categorias_actividad (actividad_id, codigo, nombre, descripcion, edad_minima, edad_maxima, sexo, cuota_mensual, activo, orden, created_at, updated_at, tenant_id)
SELECT id,'PAD-INICIO', 'Iniciacion','Nivel iniciacion',10, 17, 'AMBOS',15000,true,1,NOW(),NOW(),3 FROM actividades WHERE codigo='PADEL' AND tenant_id=3 UNION ALL
SELECT id,'PAD-ADULTOS','Adultos',   'Adultos',         18,NULL,'AMBOS',18000,true,2,NOW(),NOW(),3 FROM actividades WHERE codigo='PADEL' AND tenant_id=3;

-- Categorias Hockey
INSERT INTO categorias_actividad (actividad_id, codigo, nombre, descripcion, edad_minima, edad_maxima, sexo, cuota_mensual, activo, orden, created_at, updated_at, tenant_id)
SELECT id,'HOC-INFANTIL','Infantil','Categoria infantil',8,  12,'FEMENINO',12000,true,1,NOW(),NOW(),3 FROM actividades WHERE codigo='HOCKEY' AND tenant_id=3 UNION ALL
SELECT id,'HOC-CADETE',  'Cadete',  'Categoria cadete',  13, 17,'FEMENINO',13000,true,2,NOW(),NOW(),3 FROM actividades WHERE codigo='HOCKEY' AND tenant_id=3 UNION ALL
SELECT id,'HOC-PRIMERA', 'Primera', 'Primera division',  18,NULL,'FEMENINO',14000,true,3,NOW(),NOW(),3 FROM actividades WHERE codigo='HOCKEY' AND tenant_id=3;

-- Categorias Gimnasia
INSERT INTO categorias_actividad (actividad_id, codigo, nombre, descripcion, edad_minima, edad_maxima, sexo, cuota_mensual, activo, orden, created_at, updated_at, tenant_id)
SELECT id,'GIM-NINAS', 'Ninas', 'Gimnasia para ninas',4, 12, 'FEMENINO',9000,true,1,NOW(),NOW(),3 FROM actividades WHERE codigo='GIMNASIA' AND tenant_id=3 UNION ALL
SELECT id,'GIM-ADULTAS','Adultas','Adultas',          13,NULL,'FEMENINO',10000,true,2,NOW(),NOW(),3 FROM actividades WHERE codigo='GIMNASIA' AND tenant_id=3;

-- Entrenadores (2 por actividad)
INSERT INTO entrenadores (nombre, apellido, email, telefono, especialidad, activo, created_at, updated_at, tenant_id)
VALUES
  ('Carlos',   'Romero',    'cromero@clubix.com',    '1122334401', 'Futbol',      true, NOW(), NOW(), 3),
  ('Diego',    'Alvarez',   'dalvarez@clubix.com',   '1122334402', 'Futbol',      true, NOW(), NOW(), 3),
  ('Marcelo',  'Benitez',   'mbenitez@clubix.com',   '1122334403', 'Basquet',     true, NOW(), NOW(), 3),
  ('Rodrigo',  'Sanchez',   'rsanchez@clubix.com',   '1122334404', 'Basquet',     true, NOW(), NOW(), 3),
  ('Valeria',  'Torres',    'vtorres@clubix.com',    '1122334405', 'Voley',       true, NOW(), NOW(), 3),
  ('Florencia','Gimenez',   'fgimenez@clubix.com',   '1122334406', 'Voley',       true, NOW(), NOW(), 3),
  ('Patricia', 'Molina',    'pmolina@clubix.com',    '1122334407', 'Natacion',    true, NOW(), NOW(), 3),
  ('Sebastian','Fernandez', 'sfernandez@clubix.com', '1122334408', 'Natacion',    true, NOW(), NOW(), 3),
  ('Gustavo',  'Peralta',   'gperalta@clubix.com',   '1122334409', 'Tenis',       true, NOW(), NOW(), 3),
  ('Hernan',   'Cabrera',   'hcabrera@clubix.com',   '1122334410', 'Tenis',       true, NOW(), NOW(), 3),
  ('Federico', 'Rios',      'frios@clubix.com',      '1122334411', 'Padel',       true, NOW(), NOW(), 3),
  ('Maximiliano','Vidal',   'mvidal@clubix.com',     '1122334412', 'Padel',       true, NOW(), NOW(), 3),
  ('Claudia',  'Vera',      'cvera@clubix.com',      '1122334413', 'Hockey',      true, NOW(), NOW(), 3),
  ('Silvana',  'Mendez',    'smendez@clubix.com',    '1122334414', 'Hockey',      true, NOW(), NOW(), 3),
  ('Monica',   'Castro',    'mcastro@clubix.com',    '1122334415', 'Gimnasia',    true, NOW(), NOW(), 3),
  ('Andrea',   'Ruiz',      'aruiz@clubix.com',      '1122334416', 'Gimnasia',    true, NOW(), NOW(), 3),
  ('Pablo',    'Morales',   'pmorales@clubix.com',   '1122334417', 'Atletismo',   true, NOW(), NOW(), 3),
  ('Nicolas',  'Acosta',    'nacosta@clubix.com',    '1122334418', 'Atletismo',   true, NOW(), NOW(), 3),
  ('Leonardo', 'Silva',     'lsilva@clubix.com',     '1122334419', 'Musculacion', true, NOW(), NOW(), 3),
  ('Julian',   'Gomez',     'jgomez@clubix.com',     '1122334420', 'Musculacion', true, NOW(), NOW(), 3);

COMMIT;
