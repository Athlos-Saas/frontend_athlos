/**
 * Motor de la pizarra táctica: modelo de datos, campos, formaciones y el SVG
 * de campo, piezas y dibujos. Portado 1:1 del prototipo "Tiza" (ideas/), sin
 * DOM ni React, para que el componente solo orqueste estado e interacción.
 *
 * Por qué el SVG se genera como string y no como JSX: durante un arrastre o la
 * animación se redibujan todas las piezas en cada frame (requestAnimationFrame).
 * Escribir el string en la capa con innerHTML es lo que hacía el prototipo y
 * evita reconciliar cientos de nodos con React a 60 fps.
 *
 * Multi-deporte: TODO lo específico de cada deporte (medidas de campo,
 * marcas, formaciones) vive en `FIELDS` y `FORMS` de este archivo.
 *
 * Los colores de este archivo son colores del DIBUJO (césped, parqué, líneas,
 * conos), no de la UI de Athlos — por eso no salen de tokens.ts, igual que el
 * césped de charts/SoccerPitchMap.
 */

export type FieldKey = 'f11' | 'half' | 'f7' | 'sala' | 'basket' | 'free';
export type FieldKind = 'soccer' | 'sala' | 'basket' | 'free';
export type FormKey = 'f11' | 'f7' | 'sala' | 'basket';
export type TeamKey = 'a' | 'b';
export type ObjectKind = 'player' | 'ball' | 'cone' | 'pole' | 'ring' | 'goal' | 'text';
export type DrawKind = 'pass' | 'run' | 'dribble' | 'line' | 'free' | 'rect' | 'ellipse';
export type PlaceTool = 'pa' | 'pb' | 'gk' | 'ball' | 'cone' | 'pole' | 'ring' | 'goal' | 'text';
export type Tool = 'select' | PlaceTool | DrawKind;
export type Point = [number, number];

export interface FieldSpec {
  L: number;
  W: number;
  m: number;
  s: number;
  kind: FieldKind;
  forms: FormKey;
  half?: boolean;
  noGK?: boolean;
  pa?: [number, number];
  ga?: [number, number];
  spot?: number;
  cc?: number;
  goal?: [number, number];
  cr?: number;
}

export interface TeamColors {
  a: string;
  b: string;
  ga: string;
  gb: string;
}

export interface BoardObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  team?: TeamKey;
  gk?: boolean;
  num?: string;
  name?: string;
  /**
   * Jugador real del plantel asignado a la ficha (solo equipo A, el propio).
   * Opcional: las sesiones guardadas antes no lo tienen y siguen siendo
   * fichas genéricas. `name` guarda el nombre corto para pintar sin red.
   */
  playerId?: string;
  text?: string;
  color?: string;
  rot?: number;
}

export interface Drawing {
  id: string;
  kind: DrawKind;
  color: string;
  pts: Point[];
}

export interface Frame {
  pos: Record<string, Point>;
}

export interface Drill {
  id: string;
  name: string;
  minutes: number;
  players: string;
  notes: string;
  field: FieldKey;
  colors: TeamColors;
  objects: BoardObject[];
  drawings: Drawing[];
  frames: Frame[];
}

export interface TrainingSession {
  id: string;
  title: string;
  date: string;
  team: string;
  /** Equipo de la org cuyo plantel alimenta las fichas del equipo A (opcional, sesiones antiguas no lo tienen). */
  rosterTeamId?: string;
  drills: Drill[];
  updatedAt: number;
  v: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ---------- Constantes ---------- */

export const FONT = "'Barlow Condensed','Arial Narrow',sans-serif";

export const FIELDS: Record<FieldKey, FieldSpec> = {
  f11: { L: 105, W: 68, m: 4, s: 1, kind: 'soccer', forms: 'f11', pa: [165, 403.2], ga: [55, 183.2], spot: 110, cc: 91.5, goal: [73.2, 20], cr: 10 },
  half: { L: 105, W: 68, m: 4, s: 1, kind: 'soccer', half: true, forms: 'f11', pa: [165, 403.2], ga: [55, 183.2], spot: 110, cc: 91.5, goal: [73.2, 20], cr: 10 },
  f7: { L: 60, W: 40, m: 3, s: 0.72, kind: 'soccer', forms: 'f7', pa: [130, 300], ga: [50, 150], spot: 90, cc: 60, goal: [60, 16], cr: 8 },
  sala: { L: 40, W: 20, m: 2, s: 0.5, kind: 'sala', forms: 'sala' },
  basket: { L: 28, W: 15, m: 1.5, s: 0.42, kind: 'basket', forms: 'basket', noGK: true },
  free: { L: 60, W: 40, m: 0, s: 0.72, kind: 'free', forms: 'f7' },
};

export const FIELD_KEYS = Object.keys(FIELDS) as FieldKey[];

type FormationRow = [number, number[]];

export const FORMS: Record<FormKey, Record<string, FormationRow[]>> = {
  f11: {
    '4-4-2': [[0.17, [0.14, 0.38, 0.62, 0.86]], [0.3, [0.14, 0.38, 0.62, 0.86]], [0.43, [0.38, 0.62]]],
    '4-3-3': [[0.17, [0.14, 0.38, 0.62, 0.86]], [0.3, [0.28, 0.5, 0.72]], [0.42, [0.18, 0.5, 0.82]]],
    '4-2-3-1': [[0.17, [0.14, 0.38, 0.62, 0.86]], [0.26, [0.38, 0.62]], [0.35, [0.18, 0.5, 0.82]], [0.44, [0.5]]],
    '3-5-2': [[0.17, [0.28, 0.5, 0.72]], [0.3, [0.1, 0.3, 0.5, 0.7, 0.9]], [0.43, [0.38, 0.62]]],
    '5-3-2': [[0.16, [0.1, 0.3, 0.5, 0.7, 0.9]], [0.29, [0.28, 0.5, 0.72]], [0.42, [0.38, 0.62]]],
    '3-4-3': [[0.17, [0.28, 0.5, 0.72]], [0.3, [0.14, 0.38, 0.62, 0.86]], [0.42, [0.18, 0.5, 0.82]]],
  },
  f7: {
    '2-3-1': [[0.18, [0.32, 0.68]], [0.31, [0.2, 0.5, 0.8]], [0.43, [0.5]]],
    '3-2-1': [[0.18, [0.22, 0.5, 0.78]], [0.31, [0.35, 0.65]], [0.43, [0.5]]],
    '3-1-2': [[0.18, [0.22, 0.5, 0.78]], [0.3, [0.5]], [0.42, [0.32, 0.68]]],
    '3-3': [[0.19, [0.22, 0.5, 0.78]], [0.37, [0.22, 0.5, 0.78]]],
  },
  sala: {
    '1-2-1': [[0.18, [0.5]], [0.31, [0.2, 0.8]], [0.44, [0.5]]],
    '2-2': [[0.22, [0.3, 0.7]], [0.4, [0.3, 0.7]]],
    '3-1': [[0.22, [0.2, 0.5, 0.8]], [0.42, [0.5]]],
  },
  basket: {
    '1-2-2': [[0.44, [0.5]], [0.32, [0.22, 0.78]], [0.16, [0.14, 0.86]]],
    '2-1-2': [[0.42, [0.35, 0.65]], [0.28, [0.5]], [0.14, [0.18, 0.82]]],
    '1-3-1': [[0.44, [0.5]], [0.3, [0.15, 0.5, 0.85]], [0.12, [0.5]]],
  },
};

export const DEF_COLORS: TeamColors = { a: '#E4572E', b: '#2E86DE', ga: '#F2C14E', gb: '#7BC67E' };
export const INK = ['#FFFFFF', '#F2C14E', '#E4572E', '#2E86DE', '#13261B'];

export const PLACE: Record<PlaceTool, Pick<BoardObject, 'kind' | 'team' | 'gk'>> = {
  pa: { kind: 'player', team: 'a' },
  pb: { kind: 'player', team: 'b' },
  gk: { kind: 'player', team: 'a', gk: true },
  ball: { kind: 'ball' },
  cone: { kind: 'cone' },
  pole: { kind: 'pole' },
  ring: { kind: 'ring' },
  goal: { kind: 'goal' },
  text: { kind: 'text' },
};

export const DRAW = new Set<string>(['pass', 'run', 'dribble', 'line', 'free', 'rect', 'ellipse']);
export const isDrawTool = (t: string): t is DrawKind => DRAW.has(t);
export const isPlaceTool = (t: string): t is PlaceTool => t in PLACE;

/** Iconos del rail (contenido interno de un <svg viewBox="0 0 24 24">). */
export const TOOL_ICONS: Record<Tool, string> = {
  select: '<path d="M6 3l12 7.5-5.4 1.6-2.3 5.4z" fill="currentColor" stroke="none"/><path d="M12.5 12.5l4.5 6"/>',
  pa: '<circle cx="12" cy="12" r="8" style="fill:var(--tb-ca)" stroke="none"/><text x="12" y="15.6" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" stroke="none" font-family="Barlow Condensed,sans-serif">A</text>',
  pb: '<circle cx="12" cy="12" r="8" style="fill:var(--tb-cb)" stroke="none"/><text x="12" y="15.6" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" stroke="none" font-family="Barlow Condensed,sans-serif">B</text>',
  gk: '<circle cx="12" cy="12" r="8" style="fill:var(--tb-cg)" stroke="none"/><path d="M7 9.5h10M7 14.5h10" stroke="rgba(0,0,0,.35)" stroke-width="1.6"/>',
  ball: '<circle cx="12" cy="12" r="8"/><path d="M12 8.6l3 2.2-1.1 3.6h-3.8L9 10.8z" fill="currentColor" stroke="none"/>',
  cone: '<path d="M12 4l7 15H5z" fill="#F28C28" stroke="none"/><path d="M8.4 12.5h7.2" stroke="#fff" stroke-width="1.6"/>',
  pole: '<path d="M12 3v15"/><ellipse cx="12" cy="19.5" rx="5" ry="1.8"/><path d="M12 6v4" stroke="#F2C14E" stroke-width="3"/>',
  ring: '<circle cx="12" cy="12" r="7.5" stroke-width="2.6" stroke="#F2C14E"/>',
  goal: '<path d="M4 17V7h16v10"/><path d="M8 7v10M12 7v10M16 7v10M4 12h16" stroke-width="1" opacity=".6"/>',
  text: '<path d="M5 6h14M12 6v13"/>',
  pass: '<path d="M4 19L17 7"/><path d="M11 6h7v7"/>',
  run: '<path d="M4 19L17 7" stroke-dasharray="3 3"/><path d="M11 6h7v7"/>',
  dribble: '<path d="M3.5 18c2-1 1-3.5 3-4.5s2.5 1.5 4.5.5 1-3.5 3-4.5 2.5 1 3.5 0"/><path d="M13 6h6v6"/>',
  line: '<path d="M4 19L20 5"/>',
  free: '<path d="M4 16c2.5-7 5.5 1 8.5-5s5.5 3 7.5-3"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1" stroke-dasharray="3 2.5" fill="currentColor" fill-opacity=".18"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5" stroke-dasharray="3 2.5" fill="currentColor" fill-opacity=".18"/>',
};

export const TOOL_GROUPS: { key: 'move' | 'pieces' | 'draw'; tools: Tool[] }[] = [
  { key: 'move', tools: ['select'] },
  { key: 'pieces', tools: ['pa', 'pb', 'gk', 'ball', 'cone', 'pole', 'ring', 'goal', 'text'] },
  { key: 'draw', tools: ['pass', 'run', 'dribble', 'line', 'free', 'rect', 'ellipse'] },
];

/* ---------- Helpers ---------- */

export const rid = (p: string) => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
export const r1 = (n: number) => Math.round(n * 10) / 10;

export function contrast(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#13261B' : '#FFFFFF';
}

export function bbox(f: FieldSpec): Box {
  const L = f.L * 10;
  const W = f.W * 10;
  const m = f.m * 10;
  if (f.half) return { x: L / 2 - 10, y: -m, w: L / 2 + 10 + m, h: W + 2 * m };
  return { x: -m, y: -m, w: L + 2 * m, h: W + 2 * m };
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function slug(s: string): string {
  return (
    (s || 'pizarra')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 50) || 'pizarra'
  );
}

export const fieldOf = (d: Drill): FieldSpec => FIELDS[d.field] || FIELDS.f11;
export const totalMinutes = (s: TrainingSession) => s.drills.reduce((a, x) => a + (+x.minutes || 0), 0);

/* ---------- Datos ---------- */

export function newDrill(name: string, field: FieldKey = 'f11'): Drill {
  return { id: rid('d'), name, minutes: 15, players: '', notes: '', field, colors: { ...DEF_COLORS }, objects: [], drawings: [], frames: [] };
}

export function newSession(title: string, firstDrillName: string): TrainingSession {
  return { id: rid('s_'), title, date: today(), team: '', drills: [newDrill(firstDrillName)], updatedAt: Date.now(), v: 1 };
}

export interface DemoTexts {
  sessionTitle: string;
  firstDrill: string;
  rondoName: string;
  rondoPlayers: string;
  rondoNotes: string;
  buildUpName: string;
  buildUpPlayers: string;
  buildUpNotes: string;
}

/** Sesión de ejemplo para quien abre la pizarra por primera vez (textos ya traducidos). */
export function demoSession(tx: DemoTexts): TrainingSession {
  const s = newSession(tx.sessionTitle, tx.firstDrill);
  const d = newDrill(tx.rondoName, 'free');
  d.minutes = 12;
  d.players = tx.rondoPlayers;
  d.notes = tx.rondoNotes;
  const o = (kind: ObjectKind, x: number, y: number, extra: Partial<BoardObject> = {}): BoardObject => ({ id: rid('o'), kind, x, y, ...extra });
  d.objects = [
    o('cone', 200, 100), o('cone', 400, 100), o('cone', 400, 300), o('cone', 200, 300),
    o('player', 300, 96, { team: 'a', num: '1' }), o('player', 404, 180, { team: 'a', num: '2' }), o('player', 372, 304, { team: 'a', num: '3' }),
    o('player', 228, 304, { team: 'a', num: '4' }), o('player', 196, 180, { team: 'a', num: '5' }),
    o('player', 280, 190, { team: 'b', num: '1' }), o('player', 330, 210, { team: 'b', num: '2' }),
    o('ball', 318, 110),
  ];
  const ids = d.objects.map((x) => x.id);
  const ball = ids[11];
  const pos = (extra: Record<string, Point>) => {
    const p: Record<string, Point> = {};
    d.objects.forEach((ob) => (p[ob.id] = [ob.x, ob.y]));
    return Object.assign(p, extra);
  };
  d.frames = [
    { pos: pos({}) },
    { pos: pos({ [ball]: [388, 186], [ids[9]]: [322, 172], [ids[10]]: [350, 232] }) },
    { pos: pos({ [ball]: [242, 292], [ids[9]]: [262, 250], [ids[10]]: [316, 252] }) },
    { pos: pos({ [ball]: [210, 190], [ids[9]]: [238, 214], [ids[10]]: [286, 200] }) },
  ];
  d.drawings = [{ id: rid('w'), kind: 'pass', color: '#FFFFFF', pts: [[312, 112], [392, 174]] }];
  const d2 = newDrill(tx.buildUpName, 'f11');
  d2.minutes = 20;
  d2.players = tx.buildUpPlayers;
  d2.notes = tx.buildUpNotes;
  s.drills = [d, d2];
  applyFormation(d2, 'a', '4-3-3');
  applyFormation(d2, 'b', '4-4-2');
  return s;
}

/** Normaliza una sesión cargada (nube, archivo, localStorage) igual que loadSession del prototipo. */
export function normalizeSession(s: TrainingSession, firstDrillName: string): TrainingSession {
  s.drills = s.drills && s.drills.length ? s.drills : [newDrill(firstDrillName)];
  s.drills.forEach((d) => {
    d.colors = { ...DEF_COLORS, ...(d.colors || {}) };
    d.objects ||= [];
    d.drawings ||= [];
    d.frames ||= [];
    if (!FIELDS[d.field]) d.field = 'f11';
  });
  return s;
}

/* ---------- Operaciones sobre un ejercicio ---------- */

export function clampPt(f: FieldSpec, p: { x: number; y: number }) {
  const b = bbox(f);
  return { x: Math.max(b.x, Math.min(b.x + b.w, p.x)), y: Math.max(b.y, Math.min(b.y + b.h, p.y)) };
}

export function clampObj(f: FieldSpec, o: BoardObject) {
  const b = bbox(f);
  const m = 6;
  o.x = r1(Math.max(b.x + m, Math.min(b.x + b.w - m, o.x)));
  o.y = r1(Math.max(b.y + m, Math.min(b.y + b.h - m, o.y)));
}

export function nextNum(d: Drill, team: TeamKey | undefined): number {
  let m = 0;
  d.objects.forEach((o) => {
    if (o.kind === 'player' && o.team === team) {
      const n = parseInt(o.num ?? '', 10);
      if (n > m) m = n;
    }
  });
  return m + 1;
}

export function addToFrames(d: Drill, o: BoardObject) {
  d.frames.forEach((fr) => {
    fr.pos[o.id] = [o.x, o.y];
  });
}

export function curPositions(d: Drill): Record<string, Point> {
  const p: Record<string, Point> = {};
  d.objects.forEach((o) => (p[o.id] = [o.x, o.y]));
  return p;
}

/** Cambia el campo reescalando piezas, dibujos y fotogramas (mismo criterio que el prototipo). */
export function changeField(d: Drill, key: FieldKey) {
  const nf = FIELDS[key];
  const of = fieldOf(d);
  const sx = nf.L / of.L;
  const sy = nf.W / of.W;
  const sc = (p: Point): Point => [r1(p[0] * sx), r1(p[1] * sy)];
  d.objects.forEach((o) => {
    [o.x, o.y] = sc([o.x, o.y]);
  });
  d.drawings.forEach((w) => {
    w.pts = w.pts.map(sc);
  });
  d.frames.forEach((fr) => {
    for (const k in fr.pos) fr.pos[k] = sc(fr.pos[k]);
  });
  d.field = key;
  d.objects.forEach((o) => clampObj(nf, o));
}

export function formationsFor(d: Drill): string[] {
  return Object.keys(FORMS[fieldOf(d).forms] || FORMS.f11);
}

/** Reemplaza los jugadores de un equipo por la formación elegida. Devuelve false si no existe. */
export function applyFormation(d: Drill, team: TeamKey, name: string): boolean {
  const f = fieldOf(d);
  const forms = FORMS[f.forms] || FORMS.f11;
  const F = forms[name];
  if (!F) return false;
  const removed = new Set(d.objects.filter((o) => o.kind === 'player' && o.team === team).map((o) => o.id));
  d.objects = d.objects.filter((o) => !removed.has(o.id));
  d.frames.forEach((fr) => removed.forEach((id) => delete fr.pos[id]));
  const L = f.L * 10;
  const W = f.W * 10;
  const ax = f.half ? L / 2 : 0;
  const aw = f.half ? L / 2 : L;
  const X = (fx: number) => (team === 'a' ? ax + fx * aw : ax + (1 - fx) * aw);
  let n = 1;
  if (!f.noGK) {
    const o: BoardObject = { id: rid('o'), kind: 'player', team, gk: true, num: '1', x: X(0.04), y: W / 2 };
    clampObj(f, o);
    d.objects.push(o);
    addToFrames(d, o);
    n = 2;
  }
  F.forEach(([fx, ys]) =>
    [...ys].reverse().forEach((fy) => {
      const o: BoardObject = { id: rid('o'), kind: 'player', team, num: String(n++), x: X(fx), y: fy * W };
      clampObj(f, o);
      d.objects.push(o);
      addToFrames(d, o);
    }),
  );
  return true;
}

/* ---------- SVG del campo ---------- */

export function fieldSVG(f: FieldSpec, clipId = 'fclip'): string {
  const b = bbox(f);
  const L = f.L * 10;
  const W = f.W * 10;
  const cy = W / 2;
  const lw = r1(2.4 * Math.max(f.s, 0.6));
  const ln = `fill="none" stroke="rgba(255,255,255,.9)" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"`;
  const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="${lw * 1.3}" fill="rgba(255,255,255,.92)"/>`;
  let out = `<defs><clipPath id="${clipId}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/></clipPath></defs><g clip-path="url(#${clipId})">`;
  if (f.kind === 'soccer' || f.kind === 'free') {
    out += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#3B8550"/>`;
    const sw = L / 14;
    for (let i = Math.floor(b.x / sw); i * sw < b.x + b.w; i++) {
      if (i % 2) continue;
      const x0 = Math.max(i * sw, b.x);
      const x1 = Math.min((i + 1) * sw, b.x + b.w);
      if (x1 > x0) out += `<rect x="${x0}" y="${b.y}" width="${x1 - x0}" height="${b.h}" fill="#43905A"/>`;
    }
  }
  if (f.kind === 'soccer') {
    const [pd, pw] = f.pa!;
    const [gd, gw] = f.ga!;
    const sp = f.spot!;
    const cc = f.cc!;
    const [gW, gD] = f.goal!;
    const cr = f.cr!;
    out += `<rect x="0" y="0" width="${L}" height="${W}" ${ln}/>`;
    out += `<path d="M${L / 2},0V${W}" ${ln}/><circle cx="${L / 2}" cy="${cy}" r="${cc}" ${ln}/>${dot(L / 2, cy)}`;
    for (const side of [0, 1]) {
      const X = (v: number) => (side ? L - v : v);
      out += `<path d="M${X(0)},${cy - pw / 2}H${X(pd)}V${cy + pw / 2}H${X(0)}" ${ln}/>`;
      out += `<path d="M${X(0)},${cy - gw / 2}H${X(gd)}V${cy + gw / 2}H${X(0)}" ${ln}/>`;
      out += dot(X(sp), cy);
      const dx = pd - sp;
      if (cc > dx) {
        const dy = Math.sqrt(cc * cc - dx * dx);
        out += `<path d="M${X(pd)},${cy - dy}A${cc},${cc} 0 0 ${side ? 0 : 1} ${X(pd)},${cy + dy}" ${ln}/>`;
      }
      out += `<rect x="${side ? L : -gD}" y="${cy - gW / 2}" width="${gD}" height="${gW}" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.9)" stroke-width="${lw}"/>`;
    }
    out += `<path d="M0,${cr}A${cr},${cr} 0 0 0 ${cr},0M${L - cr},0A${cr},${cr} 0 0 0 ${L},${cr}M${L},${W - cr}A${cr},${cr} 0 0 0 ${L - cr},${W}M${cr},${W}A${cr},${cr} 0 0 0 0,${W - cr}" ${ln}/>`;
  } else if (f.kind === 'sala') {
    out += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#2A5E77"/><rect x="0" y="0" width="${L}" height="${W}" fill="#2F7092"/>`;
    out += `<rect x="0" y="0" width="${L}" height="${W}" ${ln}/><path d="M${L / 2},0V${W}" ${ln}/><circle cx="${L / 2}" cy="${cy}" r="30" ${ln}/>${dot(L / 2, cy)}`;
    out += `<path d="M0,${cy - 75}A60,60 0 0 1 60,${cy - 15}L60,${cy + 15}A60,60 0 0 1 0,${cy + 75}" ${ln}/>`;
    out += `<path d="M${L},${cy - 75}A60,60 0 0 0 ${L - 60},${cy - 15}L${L - 60},${cy + 15}A60,60 0 0 0 ${L},${cy + 75}" ${ln}/>`;
    out += dot(60, cy) + dot(100, cy) + dot(L - 60, cy) + dot(L - 100, cy);
    out += `<rect x="-10" y="${cy - 15}" width="10" height="30" fill="rgba(255,255,255,.2)" stroke="#fff" stroke-width="${lw}"/><rect x="${L}" y="${cy - 15}" width="10" height="30" fill="rgba(255,255,255,.2)" stroke="#fff" stroke-width="${lw}"/>`;
  } else if (f.kind === 'basket') {
    out += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#A9733F"/><rect x="0" y="0" width="${L}" height="${W}" fill="#C9935C"/>`;
    for (let y = 0; y < W; y += 10) out += `<path d="M0,${y}H${L}" stroke="rgba(90,50,20,.12)" stroke-width="1"/>`;
    out += `<rect x="0" y="${cy - 24.5}" width="58" height="49" fill="#A84E33"/><rect x="${L - 58}" y="${cy - 24.5}" width="58" height="49" fill="#A84E33"/>`;
    out += `<rect x="0" y="0" width="${L}" height="${W}" ${ln}/><path d="M${L / 2},0V${W}" ${ln}/><circle cx="${L / 2}" cy="${cy}" r="18" ${ln}/>`;
    const bx = 15.75;
    const r3 = 67.5;
    const ys = 9;
    const dx3 = Math.sqrt(r3 * r3 - (cy - ys) * (cy - ys));
    for (const side of [0, 1]) {
      const X = (v: number) => (side ? L - v : v);
      const sw = side ? 0 : 1;
      out += `<path d="M${X(0)},${cy - 24.5}H${X(58)}V${cy + 24.5}H${X(0)}" ${ln}/>`;
      out += `<circle cx="${X(58)}" cy="${cy}" r="18" ${ln}/>`;
      out += `<path d="M${X(0)},${ys}H${X(bx + dx3)}A${r3},${r3} 0 0 ${sw} ${X(bx + dx3)},${W - ys}H${X(0)}" ${ln}/>`;
      out += `<path d="M${X(12)},${cy - 9}V${cy + 9}" stroke="#fff" stroke-width="${lw * 1.4}"/><circle cx="${X(bx)}" cy="${cy}" r="2.6" fill="none" stroke="#F06A2A" stroke-width="1.4"/>`;
      out += `<path d="M${X(12)},${cy - 12.5}A12.5,12.5 0 0 ${sw} ${X(12)},${cy + 12.5}" ${ln}/>`;
    }
  }
  return out + '</g>';
}

/* ---------- Cotas (medidas reales a escala) ---------- */

/**
 * Cotas del campo: largo y ancho en los márgenes y, en una sola mitad para no
 * ensuciar el área de juego, área grande, área chica, punto penal, radio del
 * círculo central y ancho de portería. Los números salen del mismo `FieldSpec`
 * con el que se dibujan las líneas (10 unidades = 1 m), así que la cota y el
 * dibujo nunca pueden divergir. Solo deportes con marcas reglamentarias en
 * `FIELDS` (fútbol 11, media cancha, fútbol 7); sala, básquet y libre no.
 *
 * `vertical`: el mundo se gira -90° en pantallas altas; cada texto se
 * contra-gira para que siempre se lea de izquierda a derecha.
 */
export function dimsSVG(f: FieldSpec, vertical: boolean, locale = 'es'): string {
  if (f.kind !== 'soccer') return '';
  const L = f.L * 10;
  const W = f.W * 10;
  const cy = W / 2;
  const m = f.m * 10;
  const fs = r1(18 * Math.max(f.s, 0.75));
  const sfs = r1(fs * 0.72);
  const col = '#F2C14E';
  const meters = (u: number) => `${(u / 10).toLocaleString(locale, { maximumFractionDigits: 2 })} m`;
  const ln = `stroke="${col}" stroke-width="${r1(1.3 * Math.max(f.s, 0.7))}" fill="none"`;
  const dash = `${ln} stroke-dasharray="6 4" opacity=".85"`;
  // Halo oscuro bajo el texto (paint-order) para que se lea sobre el césped y las líneas blancas.
  const label = (x: number, y: number, text: string, angle = 0, size = fs) => {
    const a = angle + (vertical ? 90 : 0);
    const rot = a ? ` transform="rotate(${a} ${r1(x)} ${r1(y)})"` : '';
    return `<text x="${r1(x)}" y="${r1(y)}"${rot} text-anchor="middle" dominant-baseline="central" font-family="${FONT}" font-weight="700" font-size="${size}" fill="${col}" stroke="#13261B" stroke-width="${r1(size / 4)}" stroke-linejoin="round" paint-order="stroke">${text}</text>`;
  };
  // Cota con topes: segmento entre dos puntos y marcas perpendiculares de `t` unidades.
  const cota = (x1: number, y1: number, x2: number, y2: number, t = 6) => {
    const horiz = y1 === y2;
    const tk = (x: number, y: number) => (horiz ? `M${x},${y - t}V${y + t}` : `M${x - t},${y}H${x + t}`);
    return `<path d="M${x1},${y1}L${x2},${y2}${tk(x1, y1)}${tk(x2, y2)}" ${ln}/>`;
  };

  let out = '<g pointer-events="none">';
  // Largo (margen superior) y ancho (margen derecho, más allá de la portería).
  const x0 = f.half ? L / 2 : 0;
  const yTop = -m * 0.55;
  out += cota(x0, yTop, L, yTop) + label((x0 + L) / 2, yTop, meters(L - x0));
  const xR = L + m * 0.72;
  out += cota(xR, 0, xR, W) + label(xR, cy, meters(W), -90);

  // Marcas interiores en una sola mitad: la izquierda, o la derecha si es media cancha.
  const side = f.half ? 1 : 0;
  const X = (v: number) => (side ? L - v : v);
  const [pd, pw] = f.pa!;
  const [gd, gw] = f.ga!;
  const sp = f.spot!;
  const cc = f.cc!;
  const [gW, gD] = f.goal!;
  const off = 14 * Math.max(f.s, 0.75);

  // Área grande: profundidad bajo su línea inferior y ancho por dentro.
  const yPa = cy + pw / 2 + off;
  out += cota(X(0), yPa, X(pd), yPa) + label((X(0) + X(pd)) / 2, yPa + sfs * 0.9, meters(pd), 0, sfs);
  const xPa = X(pd - off);
  out += cota(xPa, cy - pw / 2, xPa, cy + pw / 2) + label(xPa, cy - pw / 4, meters(pw), -90, sfs);
  // Área chica: profundidad sobre su línea superior y ancho por dentro.
  const yGa = cy - gw / 2 - off * 0.7;
  out += cota(X(0), yGa, X(gd), yGa, 4) + label((X(0) + X(gd)) / 2, yGa - sfs * 0.8, meters(gd), 0, sfs);
  const xGa = X(gd - off * 0.7);
  out += cota(xGa, cy - gw / 2, xGa, cy + gw / 2, 4) + label(xGa, cy + gw / 4, meters(gw), -90, sfs);
  // Punto penal: distancia desde la línea de meta.
  out += `<path d="M${X(0)},${cy}H${X(sp)}" ${dash}/>` + label((X(gd) + X(sp)) / 2, cy - sfs * 0.8, meters(sp), 0, sfs);
  // Portería: ancho junto a la red, en el margen izquierdo. En media cancha
  // ese margen lo ocupa la cota del ancho, así que ahí se omite.
  if (!f.half) out += label(-gD - off * 0.6, cy, meters(gW), -90, sfs);
  // Radio del círculo central, a 45° hacia la mitad anotada.
  const k = Math.SQRT1_2 * cc;
  const ex = side ? L / 2 + k : L / 2 - k;
  out += `<path d="M${L / 2},${cy}L${ex},${cy + k}" ${dash}/>` + label((L / 2 + ex) / 2 + (side ? 1 : -1) * sfs * 0.9, cy + k / 2, `r ${meters(cc)}`, 0, sfs);
  return out + '</g>';
}

/* ---------- SVG de piezas y dibujos ---------- */

function teamColor(d: Drill, o: BoardObject): string {
  const team = o.team ?? 'a';
  return o.gk ? d.colors[team === 'a' ? 'ga' : 'gb'] : d.colors[team];
}

export function objSVG(o: BoardObject, d: Drill, f: FieldSpec, rot: number, selected: boolean, textFallback = 'Texto'): string {
  const R = 15 * f.s;
  const T = `translate(${r1(o.x)} ${r1(o.y)})`;
  const RR = `rotate(${rot})`;
  let body = `<circle r="${R * 1.15}" fill="transparent"/>`;
  if (selected) body += `<circle r="${R * 1.6}" fill="rgba(242,193,78,.18)" stroke="#F2C14E" stroke-width="${R * 0.14}" stroke-dasharray="${R * 0.42} ${R * 0.28}"/>`;
  switch (o.kind) {
    case 'player': {
      const c = teamColor(d, o);
      const tc = contrast(c);
      body += `<circle r="${R}" cx="${R * 0.1}" cy="${R * 0.16}" fill="rgba(0,0,0,.28)"/>`;
      body += `<circle r="${R}" fill="${c}" stroke="#fff" stroke-width="${R * 0.14}"/>`;
      if (o.gk) body += `<circle r="${R * 0.72}" fill="none" stroke="${tc}" stroke-opacity=".35" stroke-width="${R * 0.1}"/>`;
      body += `<g transform="${RR}"><text y="${R * 0.37}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${R * 1.08}" fill="${tc}">${esc(o.num || '')}</text>`;
      if (o.name)
        body += `<text y="${R * 2.15}" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="${R * 0.8}" fill="#fff" stroke="rgba(10,25,15,.75)" stroke-width="${R * 0.22}" paint-order="stroke" stroke-linejoin="round">${esc(o.name)}</text>`;
      body += '</g>';
      break;
    }
    case 'ball': {
      const r = R * 0.58;
      const p: string[] = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        p.push(r1(Math.cos(a) * r * 0.42) + ',' + r1(Math.sin(a) * r * 0.42));
      }
      body += `<circle r="${r}" cx="${r * 0.12}" cy="${r * 0.18}" fill="rgba(0,0,0,.3)"/><circle r="${r}" fill="#fff" stroke="#1b1b1b" stroke-width="${r * 0.14}"/><polygon points="${p.join(' ')}" fill="#1b1b1b"/>`;
      break;
    }
    case 'cone': {
      const r = R * 0.75;
      body += `<g transform="${RR}"><path d="M0,${-r}L${r * 0.9},${r * 0.72}H${-r * 0.9}Z" fill="#F28C28" stroke="#fff" stroke-width="${R * 0.09}" stroke-linejoin="round"/><path d="M${-r * 0.42},${r * 0.06}H${r * 0.42}" stroke="#fff" stroke-width="${R * 0.12}"/></g>`;
      break;
    }
    case 'pole':
      body += `<circle r="${R * 0.45}" cx="${R * 0.08}" cy="${R * 0.12}" fill="rgba(0,0,0,.3)"/><circle r="${R * 0.32}" fill="#F2C14E" stroke="#13261B" stroke-width="${R * 0.09}"/><circle r="${R * 0.1}" fill="#13261B"/>`;
      break;
    case 'ring':
      body += `<circle r="${R * 0.95}" fill="none" stroke="${o.color || '#F2C14E'}" stroke-width="${R * 0.2}"/>`;
      break;
    case 'goal': {
      const w = R * 3.4;
      const h = R * 1.1;
      let net = '';
      for (let x = -w / 2 + R * 0.42; x < w / 2; x += R * 0.42) net += `M${r1(x)},${-h / 2}V${h / 2}`;
      body += `<g transform="rotate(${o.rot || 0})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="rgba(255,255,255,.22)"/><path d="${net}M${-w / 2},0H${w / 2}" stroke="rgba(255,255,255,.55)" stroke-width="${R * 0.05}"/><path d="M${-w / 2},${h / 2}V${-h / 2}H${w / 2}V${h / 2}" fill="none" stroke="#fff" stroke-width="${R * 0.16}" stroke-linejoin="round"/></g>`;
      break;
    }
    case 'text':
      body += `<g transform="${RR}"><text y="${R * 0.4}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${R * 1.2}" fill="${o.color || '#fff'}" stroke="rgba(10,25,15,.7)" stroke-width="${R * 0.22}" paint-order="stroke" stroke-linejoin="round">${esc(o.text || textFallback)}</text></g>`;
      break;
  }
  return `<g class="o" data-id="${o.id}" transform="${T}">${body}</g>`;
}

interface Geom {
  sw: number;
  d?: string;
  head?: string;
  zone?: string;
}

function geom(w: Drawing, f: FieldSpec): Geom {
  const sc = Math.max(f.s, 0.5);
  const sw = 3.2 * sc;
  const P = w.pts.map((p) => ({ x: p[0], y: p[1] }));
  if (w.kind === 'rect' || w.kind === 'ellipse') {
    const [a, b] = P;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const W = Math.abs(a.x - b.x);
    const H = Math.abs(a.y - b.y);
    const shape =
      w.kind === 'rect'
        ? `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(W)}" height="${r1(H)}" rx="${sw}"`
        : `<ellipse cx="${r1(x + W / 2)}" cy="${r1(y + H / 2)}" rx="${r1(W / 2)}" ry="${r1(H / 2)}"`;
    return { sw, zone: shape };
  }
  if (w.kind === 'free') return { sw, d: 'M' + P.map((p) => r1(p.x) + ',' + r1(p.y)).join('L') };
  const p0 = P[0];
  const p1 = P[P.length - 1];
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  if (w.kind === 'line') return { sw, d: `M${r1(p0.x)},${r1(p0.y)}L${r1(p1.x)},${r1(p1.y)}` };
  const hl = Math.min(sw * 4.4, len * 0.5);
  const hw = sw * 2.5;
  const bx = p1.x - ux * hl;
  const by = p1.y - uy * hl;
  const head = `M${r1(p1.x)},${r1(p1.y)}L${r1(bx + nx * hw)},${r1(by + ny * hw)}L${r1(bx - nx * hw)},${r1(by - ny * hw)}Z`;
  let d: string;
  if (w.kind === 'dribble') {
    const seg = len - hl;
    const amp = sw * 1.7;
    const wl = sw * 7.5;
    const n = Math.max(10, Math.round(seg / (wl / 10)));
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * seg;
      const fade = Math.min(1, t / (wl * 0.5), (seg - t) / (wl * 0.5));
      const off = Math.sin((t / wl) * 2 * Math.PI) * amp * fade;
      pts.push(r1(p0.x + ux * t + nx * off) + ',' + r1(p0.y + uy * t + ny * off));
    }
    d = 'M' + pts.join('L');
  } else d = `M${r1(p0.x)},${r1(p0.y)}L${r1(bx)},${r1(by)}`;
  return { sw, d, head };
}

export function drawSVG(w: Drawing, f: FieldSpec, selected: boolean): string {
  const g = geom(w, f);
  const c = w.color || '#fff';
  const sw = g.sw;
  let s = `<g class="dw" data-id="${w.id}">`;
  if (g.zone) {
    s += `${g.zone} fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="${sw}" stroke-dasharray="${sw * 3} ${sw * 2}"${selected ? ` stroke-opacity="1"` : ''}/>`;
    if (selected) s += `${g.zone} fill="none" stroke="#F2C14E" stroke-width="${sw * 2.6}" stroke-opacity=".5"/>`;
    return s + '</g>';
  }
  if (selected) s += `<path d="${g.d}" fill="none" stroke="#F2C14E" stroke-opacity=".55" stroke-width="${sw * 4}" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="${g.d}" fill="none" stroke="transparent" stroke-width="${Math.max(sw * 6, 16)}" stroke-linecap="round"/>`;
  const dash = w.kind === 'run' ? ` stroke-dasharray="${sw * 3} ${sw * 2.2}"` : '';
  s += `<path d="${g.d}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
  if (g.head) s += `<path d="${g.head}" fill="${c}" stroke="${c}" stroke-width="${sw * 0.5}" stroke-linejoin="round"/>`;
  return s + '</g>';
}

/* ---------- Exportar imagen ---------- */

/** PNG del ejercicio con el encabezado del prototipo (número, nombre, sesión, equipo, minutos, jugadores). */
/** `dimsLocale`: idioma de las cotas si están visibles en pantalla; `null` = PNG sin cotas. */
export async function renderDrillPng(s: TrainingSession, drillIndex: number, fallbackDrillName: string, dimsLocale: string | null = null): Promise<Blob> {
  const d = s.drills[drillIndex];
  const f = fieldOf(d);
  const b = bbox(f);
  const inner = fieldSVG(f) + (dimsLocale ? dimsSVG(f, false, dimsLocale) : '') + d.drawings.map((w) => drawSVG(w, f, false)).join('') + d.objects.map((o) => objSVG(o, d, f, 0, false)).join('');
  const W = 1800;
  const H = Math.round((b.h * W) / b.w);
  const head = 120;
  const src = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">${inner}</svg>`;
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  });
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H + head;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d no disponible');
  g.fillStyle = '#17402E';
  g.fillRect(0, 0, W, head);
  g.fillStyle = '#F2C14E';
  g.fillRect(0, head - 6, W, 6);
  g.fillStyle = '#FFFFFF';
  g.font = '700 52px "Barlow Condensed","Arial Narrow",sans-serif';
  g.textBaseline = 'middle';
  g.fillText(`${drillIndex + 1}. ${d.name || fallbackDrillName}`, 40, 48);
  g.font = '500 28px "Barlow","Arial",sans-serif';
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.fillText([s.title, s.team, (d.minutes || 0) + ' min', d.players].filter(Boolean).join('   /   '), 40, 92);
  g.drawImage(img, 0, head, W, H);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
  if (!blob) throw new Error('toBlob devolvió null');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
