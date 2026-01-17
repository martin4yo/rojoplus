# RojoPlus - Documentacion

Sistema de fidelizacion para el Club Sportivo Pilar.

---

## Indice de Documentos

| # | Documento | Descripcion |
|---|-----------|-------------|
| 01 | [Especificacion Funcional](./01-ESPECIFICACION-FUNCIONAL.md) | Requisitos, funcionalidades, reglas de negocio |
| 02 | [Arquitectura Tecnica](./02-ARQUITECTURA-TECNICA.md) | Stack, estructura de carpetas, deployment |
| 03 | [Modelo de Datos](./03-MODELO-DE-DATOS.md) | Tablas, relaciones, schema Prisma |
| 04 | [Flujos de Usuario](./04-FLUJOS-DE-USUARIO.md) | Diagramas de flujo, wireframes |
| 05 | [API Endpoints](./05-API-ENDPOINTS.md) | Rutas, requests, responses |
| 06 | [Estilos y Branding](./06-ESTILOS-BRANDING.md) | Colores, tipografia, componentes |

---

## Resumen del Sistema

### Usuarios

- **Comerciantes**: Registran ventas a socios via app web mobile
- **Administradores**: Gestionan socios, aprueban comercios, ven reportes
- **Socios**: Usuarios pasivos que reciben descuentos

### Flujo Principal

```
Socio presenta      Comerciante        Sistema valida      Se registra
su numero    -->    lo ingresa    -->  estado activo  -->  la venta
```

### Caracteristicas Clave

- Una sola pantalla para el comerciante
- Acceso via link con token (sin login)
- Socios se cargan desde Excel
- Descuentos configurables por comercio
- Descuentos por acumulacion (opcional)
- Panel de administracion con reportes

---

## Estado del Proyecto

- [x] Documentacion funcional
- [x] Arquitectura tecnica
- [x] Modelo de datos
- [x] Diseño de API
- [x] Guia de estilos
- [ ] Implementacion backend
- [ ] Implementacion frontend
- [ ] Testing
- [ ] Deployment

---

*Club Sportivo Pilar - "El Rojo de la Avenida"*
