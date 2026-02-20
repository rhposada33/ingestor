# Esquema de Base de Datos del Ingestor

Este documento describe todas las tablas de base de datos usadas por el servicio `ingestor`, basado en `ingestor/prisma/schema.prisma`.

## Resumen

- Base de datos: PostgreSQL
- ORM: Prisma
- Patrón multi-tenant: todas las tablas de dominio incluyen `tenantId`
- Cantidad de tablas: 6

## Resumen de Relaciones de Entidades

- `tenants` 1:N `users`
- `tenants` 1:N `cameras`
- `tenants` 1:N `events`
- `tenants` 1:N `reviews`
- `tenants` 1:N `availability_logs`
- `cameras` 1:N `events`
- `cameras` 1:N `reviews`

Todas las claves foráneas están configuradas con `ON DELETE CASCADE`.

## Tablas

### `tenants`

Propósito: registro maestro de inquilinos para aislamiento de datos multi-tenant.

| Columna | Tipo | Nulo | Por defecto | Notas |
|---|---|---|---|---|
| `id` | `TEXT` | No | generado (`cuid()`) | Clave primaria |
| `name` | `TEXT` | No | - | Nombre visible del tenant |
| `description` | `TEXT` | Sí | - | Descripción opcional |
| `createdAt` | `TIMESTAMP(3)` | No | `CURRENT_TIMESTAMP` | Fecha de creación |

Índices y restricciones:
- Clave primaria: `id`

### `users`

Propósito: cuentas de usuario asociadas a un tenant.

| Columna | Tipo | Nulo | Por defecto | Notas |
|---|---|---|---|---|
| `id` | `TEXT` | No | generado (`cuid()`) | Clave primaria |
| `email` | `TEXT` | No | - | Email único de usuario |
| `password` | `TEXT` | No | - | Hash de contraseña |
| `role` | enum `UserRole` | No | `CLIENT` | `ADMIN` o `CLIENT` |
| `tenantId` | `TEXT` | No | - | FK -> `tenants.id` |
| `createdAt` | `TIMESTAMP(3)` | No | `CURRENT_TIMESTAMP` | Fecha de creación |

Índices y restricciones:
- Clave primaria: `id`
- Único: `email`
- Clave foránea: `tenantId` -> `tenants(id)` con borrado en cascada

### `cameras`

Propósito: registro de cámaras Frigate por tenant.

| Columna | Tipo | Nulo | Por defecto | Notas |
|---|---|---|---|---|
| `id` | `TEXT` | No | generado (`cuid()`) | Clave primaria |
| `tenantId` | `TEXT` | No | - | FK -> `tenants.id` |
| `frigateCameraKey` | `TEXT` | No | - | Identificador de cámara en Frigate |
| `label` | `TEXT` | Sí | - | Nombre amigable |
| `isEnabled` | `BOOLEAN` | No | `true` | Bandera de ingesta habilitada |
| `createdAt` | `TIMESTAMP(3)` | No | `CURRENT_TIMESTAMP` | Fecha de creación |

Índices y restricciones:
- Clave primaria: `id`
- Único compuesto: (`tenantId`, `frigateCameraKey`)
- Clave foránea: `tenantId` -> `tenants(id)` con borrado en cascada

### `events`

Propósito: eventos de detección de Frigate ingeridos.

| Columna | Tipo | Nulo | Por defecto | Notas |
|---|---|---|---|---|
| `id` | `TEXT` | No | generado (`cuid()`) | Clave primaria |
| `tenantId` | `TEXT` | No | - | FK -> `tenants.id` |
| `cameraId` | `TEXT` | No | - | FK -> `cameras.id` |
| `frigateId` | `TEXT` | No | - | ID de evento de Frigate |
| `type` | `TEXT` | No | - | Tipo de evento |
| `label` | `TEXT` | Sí | - | Etiqueta de objeto/sujeto |
| `subLabel` | `TEXT` | Sí | - | Etiqueta secundaria (ej: rostro reconocido) |
| `status` | `TEXT` | No | `"unresolved"` | Estado del flujo |
| `acknowledgedAt` | `TIMESTAMP(3)` | Sí | - | Fecha de reconocimiento |
| `resolvedAt` | `TIMESTAMP(3)` | Sí | - | Fecha de resolución |
| `hasSnapshot` | `BOOLEAN` | No | `false` | Disponibilidad de snapshot |
| `hasClip` | `BOOLEAN` | No | `false` | Disponibilidad de clip |
| `startTime` | `DOUBLE PRECISION` | Sí | - | Tiempo inicial del evento en origen |
| `endTime` | `DOUBLE PRECISION` | Sí | - | Tiempo final del evento en origen |
| `rawPayload` | `JSONB` | No | - | Payload completo de origen |
| `createdAt` | `TIMESTAMP(3)` | No | `CURRENT_TIMESTAMP` | Fecha de creación |

Índices y restricciones:
- Clave primaria: `id`
- Único compuesto: (`tenantId`, `frigateId`)
- Índice: (`tenantId`)
- Índice: (`cameraId`)
- Índice: (`createdAt`)
- Clave foránea: `tenantId` -> `tenants(id)` con borrado en cascada
- Clave foránea: `cameraId` -> `cameras(id)` con borrado en cascada

### `reviews`

Propósito: mensajes de revisión asociados a cámaras.

| Columna | Tipo | Nulo | Por defecto | Notas |
|---|---|---|---|---|
| `id` | `TEXT` | No | generado (`cuid()`) | Clave primaria |
| `tenantId` | `TEXT` | No | - | FK -> `tenants.id` |
| `cameraId` | `TEXT` | No | - | FK -> `cameras.id` |
| `reviewId` | `TEXT` | No | - | Identificador de revisión en origen |
| `cameraName` | `TEXT` | No | - | Nombre de cámara en el mensaje de origen |
| `severity` | `TEXT` | No | - | Clasificación de severidad |
| `retracted` | `BOOLEAN` | No | `false` | Bandera de retracción |
| `timestamp` | `TIMESTAMP(3)` | Sí | - | Marca de tiempo de origen |
| `rawPayload` | `JSONB` | No | - | Payload completo de origen |
| `createdAt` | `TIMESTAMP(3)` | No | `CURRENT_TIMESTAMP` | Fecha de creación |

Índices y restricciones:
- Clave primaria: `id`
- Único compuesto: (`tenantId`, `reviewId`)
- Índice: (`tenantId`)
- Índice: (`cameraId`)
- Índice: (`createdAt`)
- Clave foránea: `tenantId` -> `tenants(id)` con borrado en cascada
- Clave foránea: `cameraId` -> `cameras(id)` con borrado en cascada

### `availability_logs`

Propósito: mensajes de estado de disponibilidad de cámara/sistema.

| Columna | Tipo | Nulo | Por defecto | Notas |
|---|---|---|---|---|
| `id` | `TEXT` | No | generado (`cuid()`) | Clave primaria |
| `tenantId` | `TEXT` | No | - | FK -> `tenants.id` |
| `available` | `BOOLEAN` | No | - | Estado de disponibilidad |
| `timestamp` | `TIMESTAMP(3)` | No | - | Marca de tiempo de origen |
| `rawPayload` | `JSONB` | No | - | Payload completo de origen |
| `createdAt` | `TIMESTAMP(3)` | No | `CURRENT_TIMESTAMP` | Fecha de creación |

Índices y restricciones:
- Clave primaria: `id`
- Índice: (`tenantId`)
- Índice: (`createdAt`)
- Clave foránea: `tenantId` -> `tenants(id)` con borrado en cascada

## Enum de Prisma

### `UserRole`

- `ADMIN`
- `CLIENT`

## Notas

- El archivo de esquema (`ingestor/prisma/schema.prisma`) es la fuente de verdad para las definiciones actuales del modelo.
- Algunos archivos SQL de migraciones antiguas pueden no reflejar todavía todos los campos presentes actualmente en el esquema de Prisma.
