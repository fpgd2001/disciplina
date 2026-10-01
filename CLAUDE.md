# Disciplina — contexto para Claude

App personal de Francisco (estudiante de Derecho en Lima, Perú) para recuperar la disciplina,
empezando por **levantarse a la hora meta**. Es una PWA que se instala en su iPhone 14
(iOS 18) desde Safari → "Agregar a inicio". Francisco usa PC con Windows (no tiene Mac).
Idioma de la app y de las conversaciones: **español (Perú), tono informal y directo**.

## Arquitectura

- `index.html` — toda la app (HTML + CSS + JS en un solo archivo, sin framework ni build).
  El estado vive en `localStorage` bajo la llave `disciplina_v1`.
- `sw.js` — service worker. **Sube el número de `CACHE` en cada cambio de `index.html`**
  (ej. `disciplina-v3e` → `disciplina-v3f`) para que el iPhone tome la versión nueva.
  Nunca cachea `/api/`.
- `manifest.webmanifest`, `icon-*.png` — instalación como app.
- `api/` — funciones serverless de Vercel (Node, CommonJS):
  - `status.js` — qué está configurado y si la clave coincide (sin revelar llaves).
  - `tasks.js` — lee/crea/completa tareas en Notion (bases "U" y "Pertel").
  - `checkins.js` — respaldo de check-ins en Notion (base "Registro de despertar").
  - `calendar.js` — eventos del día desde el iCal secreto de Google Calendar (`node-ical`).
  - `_lib/util.js` — auth, cliente de Notion (API `2022-06-28`), IDs de las bases.
- Deploy: push a `main` en GitHub → Vercel publica solo.

## Variables de entorno (Vercel)

`APP_KEY` (clave que la app manda en el header `x-app-key`, codificada con encodeURIComponent),
`NOTION_TOKEN`, `GCAL_ICS_URL`. Opcionales: `NOTION_DB_U`, `NOTION_DB_PERTEL`, `NOTION_DB_CHECKINS`.
Nunca pongas llaves en el código ni en commits.

## Reglas del sistema (acordadas con Francisco — no cambiar sin preguntarle)

- Meta de despertar: **05:00** (lunes a sábado; domingo libre, no cuenta).
  El check-in se abre **60 min antes** de la meta.
- Rangos por minutos de retraso: S ≤5, A ≤15, B ≤30, C ≤60, D más. Solo S y A cuentan como cumplido.
- Racha con regla **"nunca dos seguidas"**: un fallo usa el comodín; dos seguidos la reinician.
- Registro manual (días olvidados): mitad de XP, cuenta para la racha, **no suma soles**,
  no acepta horas futuras y pide confirmación si reemplaza un check-in real.
- Fondo de premios: **S/ 4 por S, S/ 1 por A**, techo **S/ 104/mes**. Montos editables solo
  del 1 al 3 de cada mes (para no subirlos "en caliente").
- Premios por hito (racha 6, nivel 5, racha 21, platino) definidos por él en Ajustes.
- Logros: una vez ganados son permanentes.
- Misiones (tareas de Notion): 30 XP a tiempo, 15 vencida, 20 sin fecha, +10 si es prioridad Alta.

## Estilo visual

Inspirado en menús de RPG japonés pero **sobrio y serio**: fondos oscuros, cortes diagonales
(`skewX`), tipografía Anton para títulos e Inter para texto. Tres temas: rojo, amarillo y azul.
Francisco es muy visual y le gustan las interfaces tipo juego (XP, rangos, logros).

## Cómo trabajar aquí

- Antes de subir cambios: revisa la sintaxis del JS (`node --check` sobre el script extraído
  y sobre `api/*.js`) y prueba en el navegador si puedes.
- Commits pequeños y descriptivos, en español.
- Explícale a Francisco lo que haces en palabras simples: está aprendiendo a usar Claude Code y Git.
- Prioriza por impacto. La app es una herramienta para su hábito, no un fin en sí misma:
  si una idea nueva lo tiene programando de noche en vez de durmiendo, díselo.

## Pendientes conocidos

- Atajo de iPhone (doble toque atrás) que abra la app con `?checkin`.
- La base "Tareas" de la U en Notion tiene los cursos del ciclo pasado en la propiedad "Curso".
