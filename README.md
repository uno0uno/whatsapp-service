# WhatsApp Service API

Servicio REST API para enviar mensajes de WhatsApp con autenticación JWT, PostgreSQL y soporte para Docker.

## Características

- ✅ Autenticación con JWT y base de datos PostgreSQL
- ✅ Sistema de usuarios con roles (admin/user)
- ✅ Registro de nuevos usuarios
- ✅ Envío de mensajes individuales
- ✅ Envío masivo de mensajes
- ✅ Auditoría de mensajes enviados
- ✅ Containerizado con Docker
- ✅ QR Code para autenticación de WhatsApp
- ✅ Gestión de sesión de WhatsApp

## Requisitos

- Node.js 18+ (para desarrollo local)
- PostgreSQL 12+
- Docker y Docker Compose (opcional)

## Instalación

### 1. Clonar o acceder al directorio:
```bash
cd whatsapp-service
```

### 2. Instalar dependencias:
```bash
npm install
```

### 3. Configurar variables de entorno:
```bash
cp .env.example .env
```

Editar `.env` con tus configuraciones:
```env
# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=tu_secret_super_seguro

# Database
DB_HOST=64.23.134.78
DB_PORT=5432
DB_USER=saifer
DB_PASSWORD=96&Gd'2H+zjR
DB_NAME=whatsapp-service

# Admin User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=tu_password_seguro
ADMIN_EMAIL=admin@whatsapp-service.com
```

### 4. Configurar Base de Datos

La base de datos **ya está creada** (`whatsapp-service`) con las siguientes tablas:

- **users** - Usuarios del sistema
- **refresh_tokens** - Tokens de refresh JWT
- **whatsapp_sessions** - Sesiones de WhatsApp
- **whatsapp_messages** - Auditoría de mensajes

### 5. Crear usuario administrador:
```bash
npm run create:admin
```

### 6. Iniciar el servidor:
```bash
npm run dev
```

## Estructura de la Base de Datos

### Tabla `users`
```sql
- id (SERIAL PRIMARY KEY)
- username (VARCHAR UNIQUE)
- email (VARCHAR UNIQUE)
- password_hash (VARCHAR)
- full_name (VARCHAR)
- is_active (BOOLEAN)
- role (VARCHAR) -- 'admin' o 'user'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_login (TIMESTAMP)
```

### Tabla `whatsapp_messages`
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER FK)
- phone_number (VARCHAR)
- message (TEXT)
- message_id (VARCHAR)
- status (VARCHAR) -- 'sent', 'delivered', 'failed'
- error_message (TEXT)
- sent_at (TIMESTAMP)
```

## Uso de la API

### 1. Registro de Usuario (Opcional)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuario1",
    "email": "usuario1@example.com",
    "password": "password123",
    "fullName": "Usuario Uno"
  }'
```

### 2. Login (Obtener Token JWT)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin2024!"
  }'
```

Respuesta:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@whatsapp-service.com",
    "fullName": "Administrador",
    "role": "admin"
  }
}
```

### 3. Obtener QR Code para WhatsApp

```bash
curl -X GET http://localhost:3000/api/auth/qr \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

El QR Code viene en formato base64. Puedes mostrarlo en un navegador o convertirlo a imagen.

### 4. Verificar Estado de WhatsApp

```bash
curl -X GET http://localhost:3000/api/auth/status \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

### 5. Enviar Mensaje Individual

```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "573001234567",
    "message": "Hola, este es un mensaje de prueba"
  }'
```

**NOTA:** Todos los mensajes se guardan en la base de datos para auditoría.

### 6. Enviar Mensajes Masivos

```bash
curl -X POST http://localhost:3000/api/whatsapp/send-bulk \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "number": "573001234567",
        "message": "Hola usuario 1"
      },
      {
        "number": "573009876543",
        "message": "Hola usuario 2"
      }
    ]
  }'
```

### 7. Cerrar Sesión de WhatsApp

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer TU_TOKEN_JWT"
```

## Endpoints Disponibles

| Método | Endpoint | Autenticación | Descripción |
|--------|----------|---------------|-------------|
| POST | `/api/auth/register` | No | Registrar nuevo usuario |
| POST | `/api/auth/login` | No | Obtener token JWT |
| GET | `/api/auth/qr` | Sí | Obtener QR code de WhatsApp |
| GET | `/api/auth/status` | Sí | Estado de WhatsApp |
| POST | `/api/auth/logout` | Sí | Cerrar sesión de WhatsApp |
| POST | `/api/whatsapp/send` | Sí | Enviar mensaje individual |
| POST | `/api/whatsapp/send-bulk` | Sí | Enviar mensajes masivos |
| GET | `/api/health` | No | Health check del servicio |

## Sistema de Autenticación

### Flujo Completo

1. **Registro/Login** → Obtener token JWT
2. **Token en Header** → `Authorization: Bearer TOKEN`
3. **Token incluye:**
   - ID del usuario
   - Username
   - Role (admin/user)
4. **Expiración:** Configurable en `.env` (default: 24h)

### Roles de Usuario

- **admin**: Acceso completo
- **user**: Usuario regular (puede enviar mensajes)

## Formato de Números

Los números de teléfono deben incluir el código de país sin el símbolo +. Ejemplos:

- Colombia: `573001234567`
- México: `525512345678`
- España: `34612345678`

## Flujo de Trabajo Completo

1. **Instalar dependencias:** `npm install`
2. **Crear archivo .env** con credenciales
3. **Crear usuario admin:** `npm run create:admin`
4. **Iniciar servicio:** `npm run dev`
5. **Login** para obtener token JWT
6. **Obtener QR Code** con el token
7. **Escanear QR** con WhatsApp en tu teléfono
8. **Verificar estado** hasta que `isReady` sea `true`
9. **Enviar mensajes** usando el token

## Credenciales por Defecto

Usuario administrador creado:
- **Username:** `admin`
- **Password:** `Admin2024!`
- **Email:** `admin@whatsapp-service.com`

⚠️ **IMPORTANTE:** Cambia estas credenciales en producción.

## Scripts Disponibles

```bash
npm run dev              # Iniciar en modo desarrollo
npm run start            # Iniciar en producción
npm run create:admin     # Crear usuario administrador
npm run docker:build     # Construir imagen Docker
npm run docker:run       # Ejecutar con Docker Compose
```

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `JWT_SECRET` | Secreto para JWT | (requerido) |
| `JWT_EXPIRES_IN` | Tiempo de expiración del token | `24h` |
| `DB_HOST` | Host de PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `DB_USER` | Usuario de PostgreSQL | (requerido) |
| `DB_PASSWORD` | Password de PostgreSQL | (requerido) |
| `DB_NAME` | Nombre de la base de datos | `whatsapp-service` |
| `ADMIN_USERNAME` | Username del admin | `admin` |
| `ADMIN_PASSWORD` | Password del admin | (requerido) |
| `WHATSAPP_SESSION_PATH` | Path para sesión de WhatsApp | `./whatsapp-session` |

## Auditoría de Mensajes

Todos los mensajes enviados se guardan automáticamente en la tabla `whatsapp_messages` con:
- Usuario que envió
- Número destinatario
- Mensaje
- ID del mensaje de WhatsApp
- Estado (sent/failed)
- Timestamp

## Seguridad

- ✅ Contraseñas hasheadas con bcrypt (10 rounds)
- ✅ JWT para autenticación stateless
- ✅ Roles de usuario
- ✅ Validación de usuarios activos
- ✅ Endpoints protegidos
- ✅ Auditoría de acciones

## Troubleshooting

### Error de conexión a PostgreSQL
- Verifica las credenciales en `.env`
- Verifica que PostgreSQL esté corriendo
- Verifica que la base de datos `whatsapp-service` exista

### El QR code no aparece
- Espera unos segundos y vuelve a llamar al endpoint
- Verifica los logs del servidor

### Error "WhatsApp client no está listo"
- Primero debes escanear el QR code
- Verifica el estado con `/api/auth/status`

### Error de autenticación
- Verifica que el token JWT sea válido
- Verifica el header: `Authorization: Bearer TOKEN`
- El token expira según `JWT_EXPIRES_IN`

## Docker

Para ejecutar con Docker:

```bash
docker-compose up -d
```

El contenedor incluye:
- Servicio Node.js
- Volumen persistente para sesión de WhatsApp
- Health checks

## Desarrollo

Estructura del proyecto:
```
whatsapp-service/
├── database/
│   └── schema.sql
├── scripts/
│   └── createAdmin.js
├── src/
│   ├── config/
│   │   ├── env.js
│   │   └── database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── whatsappController.js
│   ├── middlewares/
│   │   └── auth.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── auth.routes.js
│   │   └── whatsapp.routes.js
│   ├── services/
│   │   ├── whatsappService.js
│   │   ├── userService.js
│   │   └── messageService.js
│   └── index.js
├── .env
├── .env.example
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## Licencia

MIT
