# ATHLOS · atlos-frontend

Dashboard SaaS de inteligencia deportiva. React 18 + TypeScript + Vite +
Tailwind CSS v4 + Radix UI + Supabase JS + Recharts + Zustand + TanStack Query
+ i18next. Repo: `Athlos-Saas/frontend_athlos` (rama `main`).

Este repo es uno de tres que forman el producto:

| Repo | Qué es | Key de Supabase |
|---|---|---|
| `frontend_athlos` (este) | dashboard React, desplegado en Render | **ANON** + RLS |
| `backend_athlos` | FastAPI + ETL + ML + video (YOLOv8), Web Service en Render | SERVICE_ROLE |
| `website_athlos` | sitio público estático | ANON (solo INSERT en `demo_requests`) |

Los tres son repos git independientes dentro de `C:\GitHub\Athlos`, que **no**
es un repo.

## Regla de seguridad

Aquí solo existe `VITE_SUPABASE_ANON_KEY`. El aislamiento entre organizaciones
lo da **RLS**, no el código de la UI. La SERVICE_ROLE key y la key de OpenAI
nunca aparecen en este repo, ni en un `.env`, ni en un ejemplo.

## Documento de referencia

`docs/DESIGN_SYSTEM.md` — tokens, catálogo de componentes, patrón de datos y
arquitectura de carpetas. Es correcto pero está incompleto: se escribió antes
de `src/features/`, `src/i18n/` y `src/lib/backendApi.ts`. Actualízalo cuando
agregues un patrón.

## Lo que no se negocia

- **Tokens en espejo**: `src/styles/globals.css` (bloque `@theme`) y
  `src/constants/tokens.ts`. Color nuevo → primero `tokens.ts`. Nunca un hex
  suelto en un componente.
- **Primitivos de `src/components/ui/`** (import agregado en `ui/index.ts`).
  Falta una variante → se agrega al componente base, no un one-off local.
- **`DataTable`** para cualquier vista con >~15 filas u ordenar/filtrar/exportar.
- **Charts** de `src/components/charts/` dentro de `<ChartCard>`.
- **Estado de página**: `'loading' | 'error' | 'ready'` → skeleton /
  `<ErrorState onRetry>` / `<EmptyState>`. **Jamás ignorar el `{ error }` de
  Supabase en silencio** (fue el hallazgo #1 de la auditoría original).
- **i18n simétrico**: 12 archivos cluster en `src/i18n/locales/es/` y otros 12
  en `en/`. Toda clave se agrega en ambos. Texto visible hardcodeado = bug.
- Las páginas reciben `orgId` como prop; la lógica de datos va en `src/hooks/`.

## Módulos "próximamente"

`src/constants/navigation.ts` define los 16 módulos del sidebar; `comingSoon:
true` los renderiza como `<ModulePlaceholder>`. **Pero lo que de verdad decide
es el `Set` `PLACEHOLDER_ROUTES` de `src/App.tsx`** ("Pronósticos IA" está ahí
sin el flag en `navigation.ts` — inconsistencia conocida). Al conectar un
módulo hay que tocar los dos archivos, crear la página y registrar la ruta.

Módulos con datos reales hoy: dashboard `/`, `/analisis` (GPS + video),
`/atletas`, `/competiciones`, `/modelos`, `/ai`, perfil de jugador, módulo
entrenador, usuarios/permisos.

## Backend y Render

`src/lib/backendApi.ts` habla con la API FastAPI vía `VITE_API_URL` (hoy se usa
para disparar reentrenamiento y para seguir análisis de video).
`pingBackend()` existe porque **el plan free de Render duerme el servicio por
falta de tráfico HTTP entrante y eso corta un análisis en curso**; si el
usuario cierra la pestaña deja de pinguear, así que no es una garantía.

## Comandos

```bash
npm run dev          # http://localhost:5173
npm run typecheck    # tsc --noEmit — OBLIGATORIO antes de cerrar un cambio
npm run build        # dist/ (lo que sirve Render)
npm run preview
```

**No hay tests en este repo.** `typecheck` es la única red automática. Si un
cambio es visual y no lo pudiste ver, dilo en vez de afirmar que funciona.

## Multi-deporte: la restricción que aplica a TODO cambio

ATHLOS se vende hoy a equipos de fútbol y mañana a otros deportes. El modelo ya
lo contempla: `teams.sport` existe desde `001_schema.sql` (default `soccer`) y
`components/layout/Header.tsx` ya tiene `SPORT_LABEL` con soccer/basketball/
rugby. Pero **nada lee ese campo todavía para cambiar comportamiento**: la
cancha de 105x68, `charts/SoccerPitchMap.tsx`, los eventos de fútbol y las
pantallas de "goleadores" están fijos.

Regla para cualquier cosa nueva:

- Nombres neutrales en tablas, columnas, claves de i18n y rutas. "Atleta", no
  "futbolista". `field`/`pitch` genérico, no `soccer_field`.
- Lo específico del deporte sale de configuración (`teams.sport`) o de una
  constante localizada en UN archivo, nunca esparcida.
- Si un módulo solo tiene sentido en fútbol, que sea evidente en el código
  dónde está la frontera — para poder condicionarlo por deporte después sin
  arqueología.
- No es una migración a hacer hoy. Es una deuda que no hay que agrandar.

## Datos sensibles de atletas

`wellness_entries` e `injuries` son **datos de salud de personas
identificables**, y los videos y el `.npz` de tracking son datos biométricos de
rendimiento. Estándar más alto que el resto: no salen en logs, no viajan en
respuestas que no los necesitan, no entran a la knowledge base de AthlosBot, y
el acceso por rol se revisa explícitamente (no todos los roles con lectura
deberían ver historial médico). Ante la duda, invoca el agente `security-audit`.

## Agentes disponibles

Por capa: `frontend-ui` (este repo) · `backend-api` · `video-cv` ·
`supabase-schema`.
Transversales: `module-builder` (placeholder → módulo real, end-to-end) ·
`roles-permisos` (roles, matriz de permisos, RLS por rol) · `security-audit`
(auditoría adversarial, solo diagnostica) · `design-review` (layout, diseño,
accesibilidad) · `athlete-data` (ETL de dispositivos y modelos de ML).

## Estilo

Comentarios y UI en español. Los comentarios explican **por qué** (con la
medición o la alternativa descartada), no qué hace la línea. Commits en
español, imperativo, prefijo `feat/fix/docs(ámbito)`.
