# ATLOS Design System

Documentación técnica del sistema de diseño y la arquitectura frontend
resultante de la refactorización completa del proyecto (ver historial de
commits para el detalle fase por fase). Referencia para cualquiera que
agregue un módulo, componente o página nueva.

## 1. Tokens

Fuente única de verdad en dos lugares que deben mantenerse en espejo:

- **CSS** — `src/styles/globals.css`, bloque `@theme` (Tailwind CSS v4).
- **TS** — `src/constants/tokens.ts`, para todo lo que no puede leer clases
  de Tailwind (Recharts, `style={{ }}` inline).

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#080B17` | Fondo de la aplicación |
| `panel` | `#111827` | Sidebar, header, paneles |
| `card` | `#151B2A` | Cards, popovers, dropdowns |
| `border` | `#1F2937` | Bordes, separadores |
| `foreground` | `#F8FAFC` | Texto principal |
| `muted-foreground` | `#94A3B8` | Texto secundario |
| `ai` | `#3B82F6` | Azul IA — acento primario, foco, links |
| `purple` | `#7C3AED` | Acento IA secundario (radar, badges de modelos) |
| `success` | `#22C55E` | Estados positivos |
| `warning` | `#F59E0B` | Alertas medias |
| `danger` | `#EF4444` | Errores, alertas altas |

Radios: `sm` 8px, `md` 12px, `lg` 16px (default de cards), `xl` 20px.
Tipografía: Inter (400/500/600/700), cargada en `index.html`.

**Regla:** si agregas un color nuevo, se define en `tokens.ts` primero y se
refleja en `globals.css` — nunca al revés, y nunca un hex suelto en un
componente.

## 2. Catálogo de componentes (`src/components/ui/`)

Primitivos accesibles construidos sobre Radix UI + `class-variance-authority`
+ `lucide-react`. Import agregado vía `src/components/ui/index.ts`.

Layout/contenido: `Card` (+ Header/Title/Description/Content/Footer),
`StatCard`, `MetricCard`, `ChartCard`, `Badge`, `Chip`, `Avatar`.

Formularios: `Input`, `Textarea`, `Select`, `Label`, `Field` (envuelve
label + hint + error + `aria-describedby` automático), `DatePicker`,
`Switch`, `SearchInput`.

Overlays: `Dialog` (modal), `Drawer` (panel lateral), `DropdownMenu`,
`Tooltip`, `CommandPalette` (⌘K), `Toast`/`Toaster` (con `store/toastStore.ts`).

Navegación/datos: `Tabs`, `Breadcrumb`, `Pagination`, `Table` (shell con
sticky header + skeleton), `Skeleton`, `Spinner`, `EmptyState`, `ErrorState`.

**Regla:** un componente de página nunca reimplementa un botón, badge o
input a mano — si falta una variante, se agrega al componente base en
`ui/`, no se hace un one-off local.

## 3. Tablas (`src/components/tables/DataTable.tsx`)

Componente genérico `DataTable<T>` con columnas declarativas:

```tsx
const COLUMNS: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Nombre', sortable: true, accessor: (row) => row.name },
  { id: 'status', header: 'Estado', accessor: (row) => row.status, cell: (row) => <Badge>{row.status}</Badge> },
];

<DataTable columns={COLUMNS} data={rows} getRowId={(r) => r.id} exportFileName="export.csv" />
```

Incluye búsqueda global, filtros por columna (`filters` prop), orden por
click en header, paginación y exportación CSV client-side. Usar esto en vez
de un `<table>` a mano en cualquier vista con más de ~15 filas o que
necesite ordenar/filtrar/exportar.

## 4. Gráficos (`src/components/charts/`)

Wrappers delgados sobre Recharts, ya tematizados con los tokens: 
`TrendLineChart`, `TrendAreaChart`, `ComparisonBarChart`, `DistributionDonutChart`,
`ProfileScatterChart`, `RadarComparisonChart`, `GaugeChart`, `TimelineList`
(lista vertical de eventos, no es un chart de Recharts).

Se usan dentro de `<ChartCard title=… isLoading=…>` para heredar el estado
de carga (skeleton) y el layout consistente de header/descripción.

## 5. Arquitectura de carpetas

```
src/
├── components/{ui,layout,charts,tables,dashboard}/
├── constants/        tokens.ts, navigation.ts
├── hooks/            useAuth.ts (agregar hooks de datos aquí, no en páginas)
├── lib/              supabase.ts
├── pages/            una página por ruta, recibe orgId como prop
├── store/            Zustand: uiStore (sidebar/command palette), toastStore
├── styles/           globals.css (única hoja de estilos del proyecto)
└── types/domain.ts   tipos de las filas de Supabase
```

## 6. Patrón de datos en páginas

Toda página que consulta Supabase sigue el mismo esqueleto de estado:

```ts
type LoadState = 'loading' | 'error' | 'ready';
const [state, setState] = useState<LoadState>('loading');
```

- `loading` → skeletons (`TableSkeletonRows`, `isLoading` en `StatCard`/`ChartCard`).
- `error` → `<ErrorState onRetry={...} />` — **nunca** se ignora `{ error }`
  de una respuesta de Supabase en silencio (era el problema #1 de la
  auditoría original).
- `ready` con datos vacíos → `<EmptyState icon=… title=… />`.
- `ready` con datos → contenido real.

## 7. Navegación (`src/constants/navigation.ts`)

Los 16 módulos del sidebar viven en `NAV_SECTIONS`, agrupados por sección.
Un módulo marcado `comingSoon: true` se renderiza automáticamente en
`App.tsx` como `<ModulePlaceholder>` sin necesitar una ruta ni página
propia — al conectar su backend, se quita la marca, se crea la página real
y se registra la ruta explícita en `App.tsx` (ver `/modelos` o `/ai` como
ejemplo de esa transición ya hecha).

## 8. Pendientes conocidos (no bloqueantes)

- `esbuild`/Vite tienen una advertencia de seguridad moderada limitada al
  dev server (no afecta producción); arreglarla implica saltar a Vite 8,
  fuera de alcance de esta refactorización.
- Los módulos sin backend (Equipos, Temporadas, Scouting, Reportes,
  Dispositivos, Integraciones, Alertas, Clientes, Usuarios, Configuración,
  Pronósticos IA) están intencionalmente en estado vacío — no tienen tabla
  en Supabase todavía.
