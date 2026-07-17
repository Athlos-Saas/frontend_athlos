# ⚽ ATLOS · Frontend

Frontend web de la plataforma ATLOS: **React 18 + Vite + Supabase JS**.
Habla directo con Supabase usando la **ANON key** — Row Level Security
garantiza que cada organización solo ve sus datos. Nunca uses aquí la
SERVICE_ROLE key (esa vive solo en `atlos-backend`).

## Páginas

| Ruta | Qué muestra |
|---|---|
| `/` | Panel: jugadores, sesiones, videos y últimos modelos entrenados |
| `/cargas` | Player Load y velocidad máxima por sesión + alertas de fatiga/anomalía |
| `/perfiles` | Scatter de perfiles físicos (Velocista/Equilibrado/Resistente) |
| `/liga` | Top 30 goleadores probables (AUC 0.891) y distribución de roles |
| `/videos` | Subida al bucket `videos`, estado del pipeline CV y tracks |
| `/wellness` | Formulario diario RPE/sueño/dolor + últimos registros |

## Setup

Requisitos: Node 18+ y el proyecto de Supabase ya migrado
(migraciones de `atlos-backend/supabase/migrations/`).

```bash
cp .env.example .env    # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev             # http://localhost:5173
```

Build de producción:

```bash
npm run build           # genera dist/ (desplegable en Vercel/Netlify/Cloudflare)
```

## Estructura

```
src/
├── main.jsx · App.jsx        # router + guardas de sesión/organización
├── styles/global.css         # design system ATLOS (tokens del pitch deck)
├── lib/
│   ├── supabase.js            # cliente (ANON key)
│   └── theme.js               # colores para Recharts
├── hooks/useAuth.js           # sesión + perfil (org_id, rol)
├── components/                # Layout, StatCard, Loader, EmptyState
└── pages/                     # Login, Dashboard, CargasGps, PerfilesMl,
                               # Liga, Videos, Wellness
```

## Notas

- El login usa email + contraseña de Supabase Auth; crea usuarios en
  *Authentication → Users* y asígnalos a una organización con el seed
  del backend (`--admin-email`).
- La subida de video escribe en `videos/<org_id>/raw/...`; el
  procesamiento lo dispara el backend (`POST /v1/videos/{id}/process`).
- Los gráficos usan Recharts con los mismos colores de marca del pitch.
