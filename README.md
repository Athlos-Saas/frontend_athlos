# ATLOS · Frontend

Plataforma SaaS de inteligencia deportiva: **React 18 + TypeScript + Vite +
Tailwind CSS v4 + Radix UI + Supabase JS**. Habla directo con Supabase usando
la **ANON key** — Row Level Security garantiza que cada organización solo ve
sus datos. Nunca uses aquí la SERVICE_ROLE key (esa vive solo en
`atlos-backend`).

Ver [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) para tokens, catálogo de
componentes y convenciones de arquitectura.

## Módulos

| Ruta | Qué muestra | Fuente de datos |
|---|---|---|
| `/` | Centro de inteligencia: KPIs, sesiones por día, distribución de predicciones, modelos recientes | Real (Supabase) |
| `/analisis` | Cargas GPS (Player Load, velocidad) + Video análisis, en tabs | Real |
| `/atletas` | Perfiles físicos (clustering K-Means) + Wellness diario, en tabs | Real |
| `/competiciones` | Top goleadores probables y distribución de roles ofensivos | Real |
| `/modelos` | Registro de modelos entrenados por el pipeline de ML | Real |
| `/ai` | **AI Intelligence Center**: precisión media, cobertura del sistema, predicciones recientes, historial de modelos | Real |
| Equipos, Temporadas, Pronósticos IA, Scouting, Reportes, Dispositivos, Integraciones, Alertas, Clientes, Usuarios, Configuración | Módulos sin backend aún — se muestran como estado vacío premium (`ModulePlaceholder`) hasta que exista la fuente de datos | Pendiente |

## Setup

Requisitos: Node 18+ y el proyecto de Supabase ya migrado (migraciones de
`atlos-backend/supabase/migrations/`).

```bash
cp .env.example .env    # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev             # http://localhost:5173
```

Otros comandos:

```bash
npm run typecheck       # tsc --noEmit
npm run build           # genera dist/ (desplegable en Render/Vercel/Netlify)
npm run preview         # sirve el build de producción localmente
```

## Estructura

```
src/
├── main.tsx · App.tsx          # bootstrap + router + guardas de sesión/organización
├── styles/globals.css          # Tailwind v4 + tokens del Design System (@theme)
├── constants/
│   ├── tokens.ts                # paleta, radios, colores de gráficos (fuente única)
│   └── navigation.ts            # los 16 módulos del sidebar, agrupados por sección
├── components/
│   ├── ui/                      # catálogo del Design System (Button, Card, Table, Dialog…)
│   ├── layout/                  # AppShell, Sidebar, Header
│   ├── charts/                  # wrappers de Recharts (Area, Bar, Line, Radar, Gauge, Donut, Scatter)
│   ├── tables/                  # DataTable genérico (sort, filtros, búsqueda, export, paginación)
│   └── dashboard/                # ModulePlaceholder y widgets compuestos
├── lib/supabase.ts               # cliente Supabase (ANON key)
├── hooks/useAuth.ts             # sesión + perfil (org_id, rol)
├── store/                       # Zustand: uiStore (sidebar/command palette), toastStore
├── types/domain.ts              # tipos de dominio (Player, MlModel, MlPrediction, …)
└── pages/                       # Login, Dashboard, Analisis, Atletas, Competiciones,
                                  # ModelosIa, AiIntelligenceCenter, Videos, Wellness, Liga, PerfilesMl, CargasGps
```

## Notas

- El login usa email + contraseña de Supabase Auth; crea usuarios en
  *Authentication → Users* y asígnalos a una organización con el seed
  del backend (`--admin-email`).
- La subida de video escribe en `videos/<org_id>/raw/...`; el
  procesamiento lo dispara el backend (`POST /v1/videos/{id}/process`).
- Los gráficos usan Recharts con los tokens de `constants/tokens.ts`.
- El proyecto es 100% TypeScript (`allowJs` sigue en `tsconfig.json` solo por
  si alguna librería sin tipos lo necesita, no hay JS propio pendiente).
