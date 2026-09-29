# Territorios Vivos · Ampliación a plataforma

Complemento del archivo `plan-arquitectura.html` (versión 1, 28/09/2026). Recoge la
mini-investigación sobre dominio, usuarios, administración y seguridad, **ajustada a la
decisión de usar Vercel** en lugar de Netlify / Cloudflare Workers para la interfaz.

> El proyecto se diseña como una **plataforma permanente** (webdoc + usuarios + administración).
> Octubre es su primera entrega.

## 1. Dominio y rutas

El nombre público es independiente del alojamiento: Vercel admite dominio propio.

| Ruta | Contenido | Estado en Demo 1 |
|---|---|---|
| `/` | Entrada a Territorios Vivos | ✅ |
| `/relatos-del-pacifico` | Webdoc (portada → 4 estaciones → cierre) | ✅ |
| `/ar` | Experiencia de realidad aumentada (módulo independiente) | Página "próximamente" |
| `/historias` | Aportes aprobados de la comunidad | Página "próximamente" |
| `/gestion` | Administración (fuera del menú público) | Página "próximamente" |

- `territoriosvivos.com` es un ejemplo; **no se ha comprobado su disponibilidad**.
- `territorios.vivos.com` exigiría controlar el dominio `vivos.com`.
- El dominio tiene un pago anual aunque el alojamiento sea gratuito.

## 2. Arquitectura propuesta (con Vercel)

| Pieza | Propuesta | Para qué sirve |
|---|---|---|
| Página y webdoc | React + TypeScript + Vite, publicado en **Vercel** | Recorrido, galerías y animaciones |
| Cuentas y datos | Supabase (Auth + Postgres con RLS) | Usuarios, historias y permisos |
| Archivos | Cloudflare R2 (o Vercel Blob, a evaluar) | Fotos, audios y videos separados de la página |
| Operaciones protegidas | Funciones en `api/` de Vercel | Permisos, control de cargas y URLs temporales de archivos |
| Video | Servicio de streaming (p. ej. Cloudflare Stream) | Cortos con calidad adaptable |
| Administración | Panel en la misma aplicación (`/gestion`) | Revisar historias y activar/desactivar aportes |

### ⚠️ Condición importante del plan gratuito de Vercel

El plan **Hobby** de Vercel es solo para uso personal y no comercial. Si el desarrollo del
proyecto es un trabajo remunerado o el sitio lo publica una organización, las condiciones de
Vercel lo consideran uso comercial y exigen el plan **Pro** (de pago, por miembro del equipo).

Recomendación: usar Hobby solo para esta demo de revisión y pasar el proyecto a un equipo Pro
(del cliente o de Doinmedia) antes de publicar el sitio definitivo o conectar el dominio.
Confirmar precios y condiciones vigentes en la página de planes de Vercel antes de decidir.

## 3. Usuarios y administración

| Perfil | Puede hacer |
|---|---|
| Visitante | Recorrer el documental y consultar historias publicadas |
| Usuario registrado | Crear y editar sus aportes y enviarlos a revisión |
| Administrador | Aprobar, rechazar o retirar historias y controlar la recepción de aportes |

Recorrido de una historia: **Borrador → enviada → revisión → publicada o rechazada**.

- Ocultar `/gestion` del menú no la protege: el servidor debe exigir cuenta, permiso de
  administrador y segundo factor. Un usuario no puede otorgarse ese permiso.
- Si el administrador desactiva "Agregar historias", se oculta el botón **y** el servidor
  bloquea nuevos envíos.

## 4. Protección de videos y peticiones

- **Datos:** cada usuario modifica únicamente sus historias; solo el administrador publica.
  Las reglas se aplican también en la base de datos (Row Level Security en Supabase).
- **Peticiones:** HTTPS, comprobación de sesión y permisos, validación de datos y límites
  contra envíos abusivos (Vercel Firewall / rate limiting en las funciones).
- **Archivos:** aportes pendientes privados, tamaños y formatos limitados y accesos temporales
  (URLs firmadas) para contenido restringido.

Hay que definir qué videos son públicos y cuáles requieren cuenta. Los accesos temporales
controlan la distribución, pero no impiden que alguien grabe un video que puede reproducir.

## 5. Costos y entrega

- **Supabase Free:** cuentas y base de datos de 500 MB; puede pausar proyectos tras una
  semana sin actividad.
- **R2:** 10 GB-mes de almacenamiento estándar y salida gratuita; almacenamiento y
  operaciones adicionales generan cargos. No transcodifica videos.
- **Correo:** el envío incluido en Supabase es para pruebas; en producción se necesita un
  servicio SMTP propio.
- **Vercel:** ver la condición del plan Hobby en la sección 2.

**Propuesta para octubre:** webdoc, cuentas, panel administrativo y aportes moderados de
texto y fotos. La subida directa de videos y audios amplía el trabajo y requiere revisar
capacidad. El mapa 3D sigue fuera de esta entrega.

Esta ampliación obliga a ajustar el cronograma del plan original: usuarios, moderación y
seguridad son entregables adicionales. La base se diseña para continuar después de octubre,
con copias de seguridad, mantenimiento y transición a planes de pago cuando el uso lo justifique.
