import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  FolderOpen,
  ImageDown,
  Menu,
  Play,
  Plus,
  Redo2,
  RotateCw,
  Square,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input, Textarea } from '@/components/ui/Input';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

import {
  DRAW,
  FIELD_KEYS,
  FIELDS,
  INK,
  PLACE,
  TOOL_GROUPS,
  TOOL_ICONS,
  addToFrames,
  applyFormation,
  bbox,
  changeField,
  clampObj,
  clampPt,
  clone,
  curPositions,
  demoSession,
  downloadBlob,
  drawSVG,
  fieldOf,
  fieldSVG,
  formationsFor,
  isDrawTool,
  isPlaceTool,
  newDrill,
  newSession,
  nextNum,
  normalizeSession,
  objSVG,
  r1,
  renderDrillPng,
  rid,
  slug,
  totalMinutes,
  type BoardObject,
  type Drawing,
  type FieldKey,
  type FieldSpec,
  type TeamColors,
  type TeamKey,
  type Tool,
  type TrainingSession,
} from './engine';
import {
  CloudSaveError,
  deleteCloudSession,
  deviceStore,
  fetchCloudSessions,
  saveCloudSession,
  type SaveStatus,
} from './storage';

/**
 * Pizarra táctica: port del prototipo "Tiza" (ideas/Tiza, pizarra táctica.html)
 * con la misma funcionalidad — sesiones con ejercicios, 6 campos, piezas,
 * dibujos, formaciones, colores, animación por fotogramas, deshacer/rehacer,
 * exportar PNG/JSON, importar JSON, biblioteca "Mis sesiones" y guardado en la
 * cuenta (Supabase) con copia en el dispositivo.
 *
 * Arquitectura (por qué no todo en estado de React): el documento se muta en
 * un ref, igual que en el prototipo, y el tablero SVG se pinta de forma
 * imperativa (`renderBoard`) — durante un arrastre o la animación se repinta en
 * cada requestAnimationFrame sin re-renderizar el panel. React solo pinta el
 * "chrome" (barra, rail, panel, biblioteca) y se refresca con `bump()`.
 */

type Orientation = 'auto' | 'h' | 'v';
type Tab = 'ses' | 'ej' | 'an';

interface DragState {
  id: string;
  start: { x: number; y: number };
  orig: [number, number] | [number, number][];
  isObj: boolean;
  moved: boolean;
}

interface Playing {
  raf: number;
}

interface Store {
  S: TrainingSession;
  cur: number;
  sel: { id: string } | null;
  tool: Tool;
  ink: string;
  activeFrame: number | null;
  playing: Playing | null;
  orient: Orientation;
  temp: Drawing | null;
  drag: DragState | null;
  ptr: number | null;
  hist: string[];
  redo: string[];
  vertical: boolean;
  fieldKey: string;
  // edición agrupada: un solo paso de deshacer por campo enfocado
  editing: string | null;
  // guardado
  cloud: boolean;
  writing: boolean;
  again: boolean;
  loadedClean: boolean;
  demoId: string | null;
}

const MAX_HIST = 80;
const SAVE_DEBOUNCE_MS = 650;

export function TacticalBoard({ orgId, userId }: { orgId: string; userId: string }) {
  const { t, i18n } = useTranslation();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [status, setStatusState] = useState<SaveStatus>('local');
  const [tab, setTab] = useState<Tab>('ses');
  const [panelOpen, setPanelOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [libList, setLibList] = useState<TrainingSession[] | null>(null);
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const [formA, setFormA] = useState('');
  const [formB, setFormB] = useState('');
  const [speed, setSpeed] = useState('1');
  const [loop, setLoop] = useState('0');

  const device = useMemo(() => deviceStore(userId, orgId), [userId, orgId]);

  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const fieldRef = useRef<SVGGElement>(null);
  const drawRef = useRef<SVGGElement>(null);
  const objRef = useRef<SVGGElement>(null);
  const tempRef = useRef<SVGGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameTagRef = useRef<HTMLSpanElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const rq = useRef(0);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  speedRef.current = speed;
  loopRef.current = loop;

  const tx = useCallback(
    () => ({
      newSession: t('trainingBoard.defaults.newSession', 'Nueva sesión'),
      drill: t('trainingBoard.defaults.drill', 'Ejercicio'),
      drillN: (n: number) => t('trainingBoard.defaults.drillN', 'Ejercicio {{n}}', { n }),
      text: t('trainingBoard.defaults.text', 'Texto'),
    }),
    [t],
  );

  const st = useRef<Store | null>(null);
  if (st.current === null) {
    st.current = {
      S: newSession(t('trainingBoard.defaults.newSession', 'Nueva sesión'), t('trainingBoard.defaults.drillN', 'Ejercicio {{n}}', { n: 1 })),
      cur: 0,
      sel: null,
      tool: 'select',
      ink: '#FFFFFF',
      activeFrame: null,
      playing: null,
      orient: 'auto',
      temp: null,
      drag: null,
      ptr: null,
      hist: [],
      redo: [],
      vertical: false,
      fieldKey: '',
      editing: null,
      cloud: false,
      writing: false,
      again: false,
      loadedClean: true,
      demoId: null,
    };
  }
  const s = st.current;
  const drill = () => s.S.drills[s.cur];
  const field = (): FieldSpec => fieldOf(drill());

  /* ---------- Render del tablero (imperativo) ---------- */

  const isVertical = (f: FieldSpec): boolean => {
    if (s.orient === 'h') return false;
    if (s.orient === 'v') return true;
    const b = bbox(f);
    const r = stageRef.current?.getBoundingClientRect();
    if (!r || !r.width) return false;
    const hFit = Math.min(r.width / b.w, r.height / b.h);
    const vFit = Math.min(r.width / b.h, r.height / b.w);
    return vFit > hFit * 1.12;
  };

  const renderFrameTag = () => {
    const tag = frameTagRef.current;
    if (!tag) return;
    const d = drill();
    if (s.activeFrame !== null && d.frames.length) {
      tag.hidden = false;
      tag.textContent = t('trainingBoard.anim.frameOf', 'Fotograma {{n}} de {{total}}', { n: s.activeFrame + 1, total: d.frames.length });
    } else tag.hidden = true;
  };

  const renderBoard = () => {
    const svg = svgRef.current;
    const world = worldRef.current;
    if (!svg || !world || !fieldRef.current || !drawRef.current || !objRef.current || !tempRef.current) return;
    const d = drill();
    const f = field();
    const b = bbox(f);
    s.vertical = isVertical(f);
    const key = d.field + '|' + s.vertical;
    if (key !== s.fieldKey) {
      s.fieldKey = key;
      svg.setAttribute('viewBox', s.vertical ? `${b.y} ${-(b.x + b.w)} ${b.h} ${b.w}` : `${b.x} ${b.y} ${b.w} ${b.h}`);
      world.setAttribute('transform', s.vertical ? 'rotate(-90)' : '');
      fieldRef.current.innerHTML = fieldSVG(f);
    }
    const rot = s.vertical ? 90 : 0;
    const textFallback = tx().text;
    drawRef.current.innerHTML = d.drawings.map((w) => drawSVG(w, f, !!s.sel && s.sel.id === w.id)).join('');
    objRef.current.innerHTML = d.objects.map((o) => objSVG(o, d, f, rot, !!s.sel && s.sel.id === o.id, textFallback)).join('');
    tempRef.current.innerHTML = s.temp ? drawSVG(s.temp, f, false) : '';
    renderFrameTag();
  };

  const requestRender = () => {
    if (!rq.current)
      rq.current = requestAnimationFrame(() => {
        rq.current = 0;
        renderBoard();
      });
  };

  const fullRender = () => {
    s.fieldKey = '';
    renderBoard();
    bump();
  };

  /* ---------- Guardado ---------- */

  const setStatus = (v: SaveStatus) => setStatusState(v);

  const cloudWrite = async (): Promise<void> => {
    if (s.writing) {
      s.again = true;
      return;
    }
    s.writing = true;
    const snapshot = clone(s.S);
    try {
      await saveCloudSession(orgId, snapshot);
      setStatus('cloud');
    } catch (e) {
      if (e instanceof CloudSaveError && e.kind === 'quota') {
        setStatus('local');
        toast({ title: t('trainingBoard.toast.quota', 'Tu espacio en la nube está lleno. Elimina sesiones antiguas.'), variant: 'warning' });
      } else {
        // Un reintento con jitter, como el prototipo ante 'unavailable'.
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
        try {
          await saveCloudSession(orgId, clone(s.S));
          setStatus('cloud');
        } catch {
          setStatus('local');
        }
      }
    }
    s.writing = false;
    if (s.again) {
      s.again = false;
      void cloudWrite();
    }
  };

  const flush = () => {
    window.clearTimeout(saveTimer.current);
    const ok = device.put(s.S);
    if (s.cloud) void cloudWrite();
    else setStatus(ok ? 'local' : 'error');
  };

  const scheduleSave = () => {
    s.S.updatedAt = Date.now();
    s.loadedClean = false;
    setStatus('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
  };

  const commit = () => {
    renderBoard();
    scheduleSave();
  };

  /* ---------- Historial ---------- */

  const snapshot = () => JSON.stringify({ S: s.S, cur: s.cur });
  const pushHist = () => {
    s.hist.push(snapshot());
    if (s.hist.length > MAX_HIST) s.hist.shift();
    s.redo.length = 0;
  };
  const restore = (js: string) => {
    const parsed = JSON.parse(js) as { S: TrainingSession; cur: number };
    s.S = parsed.S;
    s.cur = Math.min(parsed.cur, s.S.drills.length - 1);
    s.sel = null;
    s.activeFrame = null;
    fullRender();
    scheduleSave();
  };
  const undo = () => {
    if (!s.hist.length || s.playing) return;
    s.redo.push(snapshot());
    restore(s.hist.pop() as string);
  };
  const redo = () => {
    if (!s.redo.length || s.playing) return;
    s.hist.push(snapshot());
    restore(s.redo.pop() as string);
  };

  /** Un solo paso de deshacer por campo editado (se resetea al enfocar/soltar). */
  const beginEdit = (key: string) => {
    if (s.editing !== key) {
      pushHist();
      s.editing = key;
    }
  };
  const endEdit = () => {
    s.editing = null;
  };

  /* ---------- Sesiones ---------- */

  const loadSession = (sess: TrainingSession) => {
    if (s.playing) stopPlay();
    s.S = normalizeSession(sess, tx().drillN(1));
    s.cur = 0;
    s.sel = null;
    s.activeFrame = null;
    s.temp = null;
    s.hist.length = 0;
    s.redo.length = 0;
    device.setLast(s.S.id);
    fullRender();
  };

  const isUntouchedDemo = () => s.S.id === s.demoId && s.loadedClean;

  const listSessions = async (): Promise<TrainingSession[]> => {
    const local = Object.values(device.get());
    const byDate = (a: TrainingSession, b: TrainingSession) => b.updatedAt - a.updatedAt;
    if (!s.cloud) return local.sort(byDate);
    try {
      const cloud = await fetchCloudSessions(userId, orgId);
      const ids = new Set(cloud.map((c) => c.id));
      return [...cloud, ...local.filter((l) => !ids.has(l.id))].sort(byDate);
    } catch {
      return local.sort(byDate);
    }
  };

  const deleteSession = async (id: string) => {
    device.del(id);
    if (s.cloud) {
      try {
        await deleteCloudSession(id);
      } catch {
        // queda borrada del dispositivo; la nube se reintenta la próxima vez
      }
    }
  };

  const initCloud = async () => {
    try {
      const cloud = await fetchCloudSessions(userId, orgId);
      s.cloud = true;
      const byId: Record<string, TrainingSession> = Object.fromEntries(cloud.map((c) => [c.id, c]));
      const demoUntouched = isUntouchedDemo();
      // Sube las sesiones hechas en este dispositivo que la cuenta aún no tiene.
      for (const l of Object.values(device.get())) {
        if (byId[l.id] || (demoUntouched && l.id === s.demoId)) continue;
        try {
          await saveCloudSession(orgId, l);
          byId[l.id] = l;
        } catch {
          // se reintenta en el próximo arranque
        }
      }
      if (s.loadedClean) {
        const remote = byId[s.S.id];
        if (remote && remote.updatedAt > s.S.updatedAt) loadSession(clone(remote));
        else if (demoUntouched && cloud.length) {
          if (s.demoId) device.del(s.demoId);
          const lastId = device.last();
          const pick = (lastId && byId[lastId]) || [...cloud].sort((a, b) => b.updatedAt - a.updatedAt)[0];
          loadSession(clone(pick));
          s.loadedClean = true;
        }
      }
      setStatus('cloud');
      const mine = byId[s.S.id];
      if (!mine || mine.updatedAt < s.S.updatedAt) void cloudWrite();
    } catch {
      s.cloud = false;
      setStatus('local');
    }
  };

  /* ---------- Arranque ---------- */

  useEffect(() => {
    const local = device.get();
    const lastId = device.last();
    const last = lastId ? local[lastId] : undefined;
    const any = Object.values(local).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (last || any) loadSession(clone((last || any) as TrainingSession));
    else {
      const demo = demoSession({
        sessionTitle: t('trainingBoard.demo.sessionTitle', 'Sesión de ejemplo'),
        firstDrill: tx().drillN(1),
        rondoName: t('trainingBoard.demo.rondoName', 'Rondo 5 contra 2'),
        rondoPlayers: t('trainingBoard.demo.rondoPlayers', '7 por grupo'),
        rondoNotes: t(
          'trainingBoard.demo.rondoNotes',
          'Circulación a uno o dos toques dentro del cuadrado. Si los defensores recuperan, cambia con ellos quien perdió el balón. Variante: tras 8 pases seguidos, punto.',
        ),
        buildUpName: t('trainingBoard.demo.buildUpName', 'Salida de balón ante presión'),
        buildUpPlayers: t('trainingBoard.demo.buildUpPlayers', '11 contra 11'),
        buildUpNotes: t(
          'trainingBoard.demo.buildUpNotes',
          'El equipo A sale desde el portero con dos centrales abiertos y el mediocentro de apoyo. El equipo B presiona en 4-4-2. Punto si A supera la línea media con el balón controlado.',
        ),
      });
      s.demoId = demo.id;
      loadSession(demo);
    }
    s.loadedClean = true;
    setStatus('local');
    void initCloud();
    return () => {
      // Guardar lo pendiente al salir del módulo (navegar a otra ruta).
      if (saveTimer.current !== undefined && !s.loadedClean) flush();
      if (s.playing) cancelAnimationFrame(s.playing.raf);
      if (rq.current) cancelAnimationFrame(rq.current);
    };
    // Arranque único por usuario/org; las funciones leen el ref `s`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  // Reorientación automática al cambiar el tamaño del escenario.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const v = isVertical(field());
      if (v !== s.vertical) {
        s.fieldKey = '';
        renderBoard();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El idioma cambia los textos pintados dentro del SVG (fotograma, "Texto").
  useEffect(() => {
    renderBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  /* ---------- Herramientas y selección ---------- */

  const setTool = (tl: Tool) => {
    if (s.playing) return;
    s.tool = tl;
    if (tl !== 'select') s.sel = null;
    renderBoard();
    bump();
  };

  const findSel = (): BoardObject | Drawing | null => {
    if (!s.sel) return null;
    const d = drill();
    const id = s.sel.id;
    return d.objects.find((o) => o.id === id) || d.drawings.find((w) => w.id === id) || null;
  };

  const removeSel = () => {
    const d = drill();
    if (!s.sel) return;
    const id = s.sel.id;
    pushHist();
    d.objects = d.objects.filter((o) => o.id !== id);
    d.drawings = d.drawings.filter((w) => w.id !== id);
    d.frames.forEach((fr) => delete fr.pos[id]);
    s.sel = null;
    commit();
    bump();
  };

  /* ---------- Puntero ---------- */

  const toWorld = (e: ReactPointerEvent) => {
    const svg = svgRef.current;
    const world = worldRef.current;
    if (!svg || !world) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = world.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (s.playing || s.ptr !== null || (e.button && e.button !== 0)) return;
    s.ptr = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // algunos navegadores lo rechazan en pointerdown sintético
    }
    const f = field();
    const p = clampPt(f, toWorld(e));
    const d = drill();
    const hit = (e.target as Element).closest('[data-id]') as HTMLElement | SVGElement | null;
    if (isDrawTool(s.tool)) {
      s.sel = null;
      s.temp = {
        id: 'tmp',
        kind: s.tool,
        color: s.ink,
        pts: s.tool === 'free' ? [[r1(p.x), r1(p.y)]] : [[r1(p.x), r1(p.y)], [r1(p.x), r1(p.y)]],
      };
      renderBoard();
      bump();
      return;
    }
    if (hit) {
      const id = hit.getAttribute('data-id') as string;
      const o = d.objects.find((x) => x.id === id);
      const w = d.drawings.find((x) => x.id === id);
      s.sel = { id };
      s.drag = { id, start: p, orig: o ? [o.x, o.y] : clone((w as Drawing).pts), isObj: !!o, moved: false };
      renderBoard();
      bump();
      return;
    }
    if (isPlaceTool(s.tool)) {
      pushHist();
      const spec = PLACE[s.tool];
      const o: BoardObject = { id: rid('o'), ...spec, x: p.x, y: p.y };
      if (o.kind === 'player') o.num = String(spec.gk ? 1 : nextNum(d, o.team));
      if (o.kind === 'text') {
        o.text = tx().text;
        o.color = '#FFFFFF';
      }
      clampObj(f, o);
      d.objects.push(o);
      addToFrames(d, o);
      s.sel = { id: o.id };
      commit();
      bump();
      return;
    }
    s.sel = null;
    renderBoard();
    bump();
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== s.ptr) return;
    const f = field();
    const p = clampPt(f, toWorld(e));
    const d = drill();
    if (s.temp) {
      if (s.temp.kind === 'free') {
        const l = s.temp.pts[s.temp.pts.length - 1];
        if (Math.hypot(p.x - l[0], p.y - l[1]) > 3) s.temp.pts.push([r1(p.x), r1(p.y)]);
      } else s.temp.pts[1] = [r1(p.x), r1(p.y)];
      requestRender();
      return;
    }
    if (s.drag) {
      const dx = p.x - s.drag.start.x;
      const dy = p.y - s.drag.start.y;
      if (!s.drag.moved) {
        if (Math.hypot(dx, dy) < 2) return;
        pushHist();
        s.drag.moved = true;
      }
      if (s.drag.isObj) {
        const o = d.objects.find((x) => x.id === s.drag?.id);
        const orig = s.drag.orig as [number, number];
        if (o) {
          o.x = orig[0] + dx;
          o.y = orig[1] + dy;
          clampObj(f, o);
        }
      } else {
        const w = d.drawings.find((x) => x.id === s.drag?.id);
        if (w) w.pts = (s.drag.orig as [number, number][]).map((q) => [r1(q[0] + dx), r1(q[1] + dy)]);
      }
      requestRender();
    }
  };

  const endPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== s.ptr) return;
    s.ptr = null;
    const d = drill();
    if (s.temp) {
      const tmp = s.temp;
      s.temp = null;
      const ok =
        tmp.kind === 'free'
          ? tmp.pts.length > 2
          : Math.hypot(tmp.pts[1][0] - tmp.pts[0][0], tmp.pts[1][1] - tmp.pts[0][1]) > 10 * field().s;
      if (ok) {
        pushHist();
        tmp.id = rid('w');
        d.drawings.push(tmp);
        commit();
        bump();
      } else renderBoard();
      return;
    }
    if (s.drag) {
      if (s.drag.moved) {
        if (s.drag.isObj && s.activeFrame !== null && d.frames[s.activeFrame]) {
          const o = d.objects.find((x) => x.id === s.drag?.id);
          if (o) d.frames[s.activeFrame].pos[o.id] = [o.x, o.y];
        }
        commit();
        bump();
      }
      s.drag = null;
    }
  };

  /* ---------- Teclado ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target?.matches?.('input,textarea,select,[contenteditable="true"]');
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'y' && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (typing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.sel) {
        e.preventDefault();
        removeSel();
      }
      if (e.key === 'Escape' && !libOpen) {
        s.sel = null;
        setTool('select');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libOpen]);

  /* ---------- Animación ---------- */

  const goFrame = (i: number) => {
    const d = drill();
    const fr = d.frames[i];
    if (!fr) return;
    s.activeFrame = i;
    d.objects.forEach((o) => {
      const q = fr.pos[o.id];
      if (q) {
        o.x = q[0];
        o.y = q[1];
      }
    });
    renderBoard();
    bump();
    scheduleSave();
  };

  const addFrame = () => {
    if (s.playing) return;
    const d = drill();
    pushHist();
    const at = s.activeFrame === null ? d.frames.length : s.activeFrame + 1;
    d.frames.splice(at, 0, { pos: curPositions(d) });
    s.activeFrame = at;
    commit();
    bump();
    if (d.frames.length === 1) toast({ title: t('trainingBoard.toast.firstFrame', 'Fotograma 1 guardado. Añade otro y mueve las piezas.'), variant: 'default' });
  };

  const delFrame = () => {
    const d = drill();
    if (s.activeFrame === null || !d.frames.length) return;
    pushHist();
    d.frames.splice(s.activeFrame, 1);
    s.activeFrame = d.frames.length ? Math.min(s.activeFrame, d.frames.length - 1) : null;
    if (s.activeFrame !== null) goFrame(s.activeFrame);
    else {
      commit();
      bump();
    }
  };

  const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

  function stopPlay() {
    if (!s.playing) return;
    cancelAnimationFrame(s.playing.raf);
    const k = s.activeFrame ?? 0;
    s.playing = null;
    goFrame(k);
  }

  const play = () => {
    const d = drill();
    if (d.frames.length < 2) return;
    if (s.playing) {
      stopPlay();
      return;
    }
    s.sel = null;
    s.temp = null;
    const sp = parseFloat(speedRef.current) || 1;
    const looped = loopRef.current === '1';
    const segMs = 1150 / sp;
    const pause = 320 / sp;
    const start = performance.now();
    const playing: Playing = { raf: 0 };
    s.playing = playing;
    const n = d.frames.length - 1;
    const cycle = n * (segMs + pause);
    const tick = (now: number) => {
      // El timestamp de rAF es el inicio del frame y puede ser ANTERIOR al
      // performance.now() tomado al arrancar: sin el clamp, `el` negativo daba
      // k = -1 y frames[-1].pos reventaba (el prototipo tenía el mismo fallo;
      // lo detectó la prueba con Playwright).
      let el = Math.max(0, now - start);
      if (el >= cycle && !looped) {
        s.playing = null;
        goFrame(n);
        return;
      }
      el = el % cycle;
      const k = Math.floor(el / (segMs + pause));
      const local = el - k * (segMs + pause);
      const u = ease(Math.min(1, local / segMs));
      const A = d.frames[k].pos;
      const B = d.frames[k + 1].pos;
      d.objects.forEach((o) => {
        const a = A[o.id];
        const b = B[o.id] || a;
        if (a) {
          o.x = a[0] + (b[0] - a[0]) * u;
          o.y = a[1] + (b[1] - a[1]) * u;
        }
      });
      s.activeFrame = local >= segMs ? k + 1 : k;
      renderBoard();
      playing.raf = requestAnimationFrame(tick);
    };
    playing.raf = requestAnimationFrame(tick);
    renderBoard();
    bump();
  };

  /* ---------- Panel: sesión y ejercicios ---------- */

  const openDrill = (i: number) => {
    if (s.playing) stopPlay();
    s.cur = i;
    s.sel = null;
    s.activeFrame = null;
    s.temp = null;
    fullRender();
  };

  const moveDrill = (i: number, dir: number) => {
    pushHist();
    const j = i + dir;
    [s.S.drills[i], s.S.drills[j]] = [s.S.drills[j], s.S.drills[i]];
    if (s.cur === i) s.cur = j;
    else if (s.cur === j) s.cur = i;
    s.sel = null;
    fullRender();
    scheduleSave();
  };

  const dupDrill = (i: number) => {
    pushHist();
    const n = clone(s.S.drills[i]);
    n.id = rid('d');
    n.name = t('trainingBoard.defaults.copyOf', '{{name}} (copia)', { name: n.name || tx().drill });
    s.S.drills.splice(i + 1, 0, n);
    s.cur = i + 1;
    s.activeFrame = null;
    s.sel = null;
    fullRender();
    scheduleSave();
  };

  const rmDrill = (i: number) => {
    pushHist();
    s.S.drills.splice(i, 1);
    s.cur = Math.min(s.cur, s.S.drills.length - 1);
    s.activeFrame = null;
    s.sel = null;
    fullRender();
    scheduleSave();
  };

  const addDrill = () => {
    pushHist();
    s.S.drills.push(newDrill(tx().drillN(s.S.drills.length + 1), drill().field));
    openDrill(s.S.drills.length - 1);
    scheduleSave();
  };

  const pickField = (key: FieldKey) => {
    const d = drill();
    if (d.field === key) return;
    pushHist();
    changeField(d, key);
    fullRender();
    scheduleSave();
  };

  const placeFormation = (team: TeamKey, name: string) => {
    pushHist();
    if (!applyFormation(drill(), team, name)) {
      s.hist.pop();
      return;
    }
    s.sel = null;
    commit();
    bump();
  };

  const setColor = (k: keyof TeamColors, v: string) => {
    beginEdit('color:' + k);
    drill().colors[k] = v;
    renderBoard();
    bump();
    scheduleSave();
  };

  const clearBoard = () => {
    if (!clearArmed) {
      setClearArmed(true);
      window.setTimeout(() => setClearArmed(false), 3000);
      return;
    }
    setClearArmed(false);
    pushHist();
    const d = drill();
    d.objects = [];
    d.drawings = [];
    d.frames = [];
    s.activeFrame = null;
    s.sel = null;
    commit();
    bump();
    toast({ title: t('trainingBoard.toast.cleared', 'Pizarra vacía. Puedes deshacerlo.'), variant: 'default' });
  };

  /** Edita un campo de texto del panel con un solo paso de deshacer por enfoque. */
  const editSession = (key: 'title' | 'date' | 'team', v: string) => {
    beginEdit('s:' + key);
    s.S[key] = v;
    scheduleSave();
    bump();
  };
  const editDrill = (key: 'name' | 'players' | 'notes', v: string) => {
    beginEdit('d:' + key);
    drill()[key] = v;
    scheduleSave();
    bump();
  };
  const editMinutes = (v: string) => {
    beginEdit('d:minutes');
    drill().minutes = Math.max(0, Math.min(240, parseInt(v, 10) || 0));
    scheduleSave();
    bump();
  };

  /* ---------- Barra contextual ---------- */

  const editSel = (key: 'num' | 'name' | 'text', v: string) => {
    const it = findSel() as BoardObject | null;
    if (!it) return;
    beginEdit('sel:' + it.id + ':' + key);
    it[key] = v;
    renderBoard();
    bump();
    scheduleSave();
  };

  const pickInk = (c: string) => {
    const it = findSel();
    if (it) {
      pushHist();
      (it as BoardObject | Drawing).color = c;
      commit();
    } else s.ink = c;
    bump();
  };

  const selTeam = (team: TeamKey) => {
    const it = findSel() as BoardObject | null;
    if (!it) return;
    pushHist();
    it.team = team;
    commit();
    bump();
  };
  const selToggleGk = () => {
    const it = findSel() as BoardObject | null;
    if (!it) return;
    pushHist();
    it.gk = !it.gk;
    commit();
    bump();
  };
  const selRotate = () => {
    const it = findSel() as BoardObject | null;
    if (!it) return;
    pushHist();
    it.rot = ((it.rot || 0) + 45) % 360;
    commit();
  };
  const selDuplicate = () => {
    const it = findSel() as BoardObject | null;
    if (!it) return;
    const d = drill();
    const f = field();
    pushHist();
    const n = clone(it);
    n.id = rid('o');
    n.x += 15 * f.s * 1.6;
    n.y += 15 * f.s * 1.6;
    if (n.kind === 'player') n.num = String(nextNum(d, n.team));
    clampObj(f, n);
    d.objects.push(n);
    addToFrames(d, n);
    s.sel = { id: n.id };
    commit();
    bump();
  };

  /* ---------- Biblioteca ---------- */

  const openLib = async () => {
    setPanelOpen(false);
    setLibOpen(true);
    setLibList(null);
    setArmedDelete(null);
    const list = await listSessions();
    if (!list.find((x) => x.id === s.S.id)) list.unshift(s.S);
    setLibList(list);
  };

  const openFromLib = (sess: TrainingSession) => {
    flush();
    loadSession(clone(sess));
    setLibOpen(false);
  };

  const deleteFromLib = async (id: string) => {
    if (armedDelete !== id) {
      setArmedDelete(id);
      window.setTimeout(() => setArmedDelete((cur) => (cur === id ? null : cur)), 3000);
      return;
    }
    setArmedDelete(null);
    await deleteSession(id);
    if (id === s.S.id) {
      const rest = (await listSessions()).filter((x) => x.id !== id);
      loadSession(rest[0] ? clone(rest[0]) : newSession(tx().newSession, tx().drillN(1)));
      flush();
    }
    await openLib();
    toast({ title: t('trainingBoard.toast.deleted', 'Sesión eliminada'), variant: 'default' });
  };

  const createSession = () => {
    flush();
    loadSession(newSession(tx().newSession, tx().drillN(1)));
    flush();
    setLibOpen(false);
    toast({ title: t('trainingBoard.toast.created', 'Sesión nueva creada'), variant: 'success' });
  };

  /* ---------- Exportar / importar ---------- */

  const exportPNG = async () => {
    try {
      const blob = await renderDrillPng(s.S, s.cur, tx().drill);
      downloadBlob(blob, slug(drill().name) + '.png');
      toast({ title: t('trainingBoard.toast.pngDone', 'Imagen exportada'), variant: 'success' });
    } catch {
      toast({ title: t('trainingBoard.toast.pngError', 'No se pudo exportar la imagen.'), variant: 'danger' });
    }
  };

  const exportJSON = () => {
    try {
      downloadBlob(new Blob([JSON.stringify(s.S)], { type: 'application/json' }), slug(s.S.title) + '.json');
      toast({ title: t('trainingBoard.toast.jsonDone', 'Sesión exportada'), variant: 'success' });
    } catch {
      toast({ title: t('trainingBoard.toast.jsonError', 'No se pudo exportar la sesión.'), variant: 'danger' });
    }
  };

  const importJSON = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as TrainingSession;
      if (!parsed || !Array.isArray(parsed.drills)) throw new Error('formato');
      parsed.id = rid('s_');
      parsed.updatedAt = Date.now();
      parsed.title = parsed.title || t('trainingBoard.defaults.imported', 'Sesión importada');
      flush();
      loadSession(parsed);
      flush();
      toast({ title: t('trainingBoard.toast.imported', 'Sesión importada'), variant: 'success' });
    } catch {
      toast({ title: t('trainingBoard.toast.importError', 'Ese archivo no es una sesión de la pizarra.'), variant: 'danger' });
    }
  };

  /* ---------- Vista ---------- */

  const d = drill();
  const sel = findSel();
  const isPlaying = !!s.playing;
  const canPlay = d.frames.length >= 2;
  const forms = formationsFor(d);
  const fa = forms.includes(formA) ? formA : forms[0];
  const fb = forms.includes(formB) ? formB : forms[0];
  const kindName = (k: string) => t(`trainingBoard.kind.${k}`);
  const toolName = (k: Tool) => t(`trainingBoard.tool.${k}`);

  const statusText: Record<SaveStatus, string> = {
    cloud: t('trainingBoard.status.cloud', 'Guardado en tu cuenta'),
    local: t('trainingBoard.status.local', 'Guardado en este dispositivo'),
    saving: t('trainingBoard.status.saving', 'Guardando…'),
    error: t('trainingBoard.status.error', 'No se pudo guardar'),
  };
  const statusDot: Record<SaveStatus, string> = {
    cloud: 'bg-success',
    local: 'bg-muted-foreground',
    saving: 'bg-warning',
    error: 'bg-danger',
  };

  const swatches = (active: string) =>
    INK.map((c) => (
      <button
        key={c}
        type="button"
        onClick={() => pickInk(c)}
        aria-label={t('trainingBoard.ctx.color', 'Color {{c}}', { c })}
        aria-pressed={c === active}
        className={cn('size-6 shrink-0 rounded-full border-2 border-card ring-1 ring-border', c === active && 'ring-2 ring-foreground')}
        style={{ background: c }}
      />
    ));

  const ctxBar = (() => {
    if (isPlaying) return <span className="px-1 text-muted-foreground">{t('trainingBoard.ctx.playing', 'Reproduciendo animación')}</span>;
    if (sel) {
      const isDraw = DRAW.has(sel.kind);
      const obj = sel as BoardObject;
      return (
        <>
          <strong className="px-1 font-semibold text-foreground">{kindName(sel.kind)}</strong>
          {sel.kind === 'player' && (
            <>
              <Input
                className="h-8 w-14 text-center"
                value={obj.num ?? ''}
                maxLength={3}
                aria-label={t('trainingBoard.ctx.number', 'Número')}
                onChange={(e) => editSel('num', e.target.value)}
                onFocus={endEdit}
                onBlur={endEdit}
              />
              <Input
                className="h-8 w-32"
                value={obj.name ?? ''}
                maxLength={18}
                placeholder={t('trainingBoard.ctx.name', 'Nombre')}
                aria-label={t('trainingBoard.ctx.name', 'Nombre')}
                onChange={(e) => editSel('name', e.target.value)}
                onFocus={endEdit}
                onBlur={endEdit}
              />
              <span className="inline-flex overflow-hidden rounded-md border border-border">
                {(['a', 'b'] as TeamKey[]).map((tm) => (
                  <button
                    key={tm}
                    type="button"
                    aria-pressed={obj.team === tm}
                    onClick={() => selTeam(tm)}
                    className={cn('h-8 px-3 text-xs', obj.team === tm ? 'bg-ai text-white' : 'bg-panel text-foreground')}
                  >
                    {tm.toUpperCase()}
                  </button>
                ))}
              </span>
              <button
                type="button"
                aria-pressed={!!obj.gk}
                onClick={selToggleGk}
                className={cn('h-8 rounded-md border border-border px-3 text-xs', obj.gk ? 'bg-ai text-white' : 'bg-panel text-foreground')}
              >
                {t('trainingBoard.ctx.goalkeeper', 'Portero')}
              </button>
            </>
          )}
          {sel.kind === 'text' && (
            <>
              <Input
                className="h-8 w-32"
                value={obj.text ?? ''}
                maxLength={40}
                aria-label={t('trainingBoard.ctx.text', 'Texto')}
                onChange={(e) => editSel('text', e.target.value)}
                onFocus={endEdit}
                onBlur={endEdit}
              />
              {swatches(obj.color || '#FFFFFF')}
            </>
          )}
          {(sel.kind === 'ring' || isDraw) && swatches((sel as BoardObject).color || (sel.kind === 'ring' ? '#F2C14E' : '#FFFFFF'))}
          {sel.kind === 'goal' && (
            <Button variant="secondary" size="icon" className="size-8" onClick={selRotate} aria-label={t('trainingBoard.ctx.rotate', 'Girar')} title={t('trainingBoard.ctx.rotate', 'Girar')}>
              <RotateCw className="size-4" />
            </Button>
          )}
          {!isDraw && (
            <Button variant="secondary" size="icon" className="size-8" onClick={selDuplicate} aria-label={t('trainingBoard.ctx.duplicate', 'Duplicar')} title={t('trainingBoard.ctx.duplicate', 'Duplicar')}>
              <Copy className="size-4" />
            </Button>
          )}
          <Button variant="secondary" size="icon" className="size-8" onClick={removeSel} aria-label={t('trainingBoard.ctx.delete', 'Eliminar')} title={t('trainingBoard.ctx.delete', 'Eliminar')}>
            <Trash2 className="size-4" />
          </Button>
        </>
      );
    }
    if (isDrawTool(s.tool))
      return (
        <>
          <span className="px-1 text-muted-foreground">{t('trainingBoard.ctx.dragHint', 'Arrastra sobre el campo')}</span>
          {swatches(s.ink)}
        </>
      );
    if (isPlaceTool(s.tool))
      return <span className="px-1 text-muted-foreground">{t('trainingBoard.ctx.placeHint', 'Toca el campo para colocar. Arrastra una pieza para moverla.')}</span>;
    return null;
  })();

  const playButton = (primary: boolean) => (
    <Button variant={primary ? 'primary' : 'secondary'} onClick={play} disabled={!canPlay} aria-label={isPlaying ? t('trainingBoard.anim.stop', 'Detener') : t('trainingBoard.anim.play', 'Reproducir')}>
      {isPlaying ? <Square className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}
      {isPlaying ? t('trainingBoard.anim.stop', 'Detener') : t('trainingBoard.anim.play', 'Reproducir')}
    </Button>
  );

  const label = (text: string) => <span className="text-xs text-muted-foreground">{text}</span>;
  const nativeSelect = 'h-9 w-full rounded-md border border-border bg-panel px-2 text-sm text-foreground';

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex shrink-0 items-center border-b border-border px-2">
        {(
          [
            ['ses', t('trainingBoard.tabs.session', 'Sesión')],
            ['ej', t('trainingBoard.tabs.drill', 'Ejercicio')],
            ['an', t('trainingBoard.tabs.animation', 'Animación')],
          ] as [Tab, string][]
        ).map(([k, txt]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              'h-11 flex-1 border-b-[3px] text-sm font-semibold',
              tab === k ? 'border-ai text-foreground' : 'border-transparent text-muted-foreground',
            )}
          >
            {txt}
          </button>
        ))}
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setPanelOpen(false)} aria-label={t('trainingBoard.panel.close', 'Cerrar panel')}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
        {tab === 'ses' && (
          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1">
              {label(t('trainingBoard.session.title', 'Título de la sesión'))}
              <Input value={s.S.title} maxLength={80} onChange={(e) => editSession('title', e.target.value)} onFocus={endEdit} onBlur={endEdit} />
            </label>
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                {label(t('trainingBoard.session.date', 'Fecha'))}
                <Input type="date" value={s.S.date} onChange={(e) => editSession('date', e.target.value)} onFocus={endEdit} onBlur={endEdit} />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                {label(t('trainingBoard.session.team', 'Equipo o categoría'))}
                <Input
                  value={s.S.team}
                  maxLength={60}
                  placeholder={t('trainingBoard.session.teamPlaceholder', 'Sub-16 A')}
                  onChange={(e) => editSession('team', e.target.value)}
                  onFocus={endEdit}
                  onBlur={endEdit}
                />
              </label>
            </div>

            <h4 className="mt-1 text-base font-semibold text-foreground">{t('trainingBoard.session.drills', 'Ejercicios')}</h4>
            <ol className="flex flex-col gap-1.5">
              {s.S.drills.map((x, i) => (
                <li
                  key={x.id}
                  className={cn(
                    'grid grid-cols-[28px_1fr_auto] items-center gap-2 rounded-lg border bg-card py-2 pl-2.5 pr-2',
                    i === s.cur ? 'border-ai shadow-[inset_3px_0_0_var(--color-ai)]' : 'border-border',
                  )}
                >
                  <span className="text-center text-lg font-bold text-muted-foreground">{i + 1}</span>
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => {
                      openDrill(i);
                      setPanelOpen(false);
                    }}
                  >
                    <b className="block truncate font-semibold text-foreground">{x.name || tx().drill}</b>
                    <small className="text-muted-foreground">
                      {t(`trainingBoard.field.${x.field}`)}, {x.minutes || 0} min
                    </small>
                  </button>
                  <span className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => moveDrill(i, -1)} aria-label={t('trainingBoard.session.up', 'Subir')}>
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" disabled={i === s.S.drills.length - 1} onClick={() => moveDrill(i, 1)} aria-label={t('trainingBoard.session.down', 'Bajar')}>
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => dupDrill(i)} aria-label={t('trainingBoard.ctx.duplicate', 'Duplicar')}>
                      <Copy className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" disabled={s.S.drills.length < 2} onClick={() => rmDrill(i)} aria-label={t('trainingBoard.ctx.delete', 'Eliminar')}>
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ol>
            <Button variant="secondary" onClick={addDrill}>
              <Plus className="size-4" />
              {t('trainingBoard.session.addDrill', 'Añadir ejercicio')}
            </Button>
            <div className="flex items-baseline justify-between border-t border-border pt-2.5">
              <span className="text-sm text-muted-foreground">{t('trainingBoard.session.total', 'Duración total')}</span>
              <b className="text-2xl font-bold text-foreground">{totalMinutes(s.S)} min</b>
            </div>

            <h4 className="mt-1 text-base font-semibold text-foreground">{t('trainingBoard.session.share', 'Compartir y guardar')}</h4>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="lg:hidden" onClick={openLib}>
                {t('trainingBoard.lib.title', 'Mis sesiones')}
              </Button>
              <Button variant="secondary" onClick={exportPNG}>
                {t('trainingBoard.export.png', 'Exportar imagen')}
              </Button>
              <Button variant="secondary" onClick={exportJSON}>
                {t('trainingBoard.export.json', 'Exportar sesión')}
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                {t('trainingBoard.export.import', 'Importar sesión')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  void importJSON(file);
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {s.cloud
                ? t('trainingBoard.sync.cloud', 'Tus sesiones se guardan en tu cuenta: ábrelas desde el móvil, la tablet o el ordenador.')
                : t('trainingBoard.sync.local', 'Tus sesiones se guardan en este navegador y se subirán a tu cuenta cuando haya conexión.')}
            </p>
          </div>
        )}

        {tab === 'ej' && (
          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1">
              {label(t('trainingBoard.drill.name', 'Nombre del ejercicio'))}
              <Input value={d.name} maxLength={80} onChange={(e) => editDrill('name', e.target.value)} onFocus={endEdit} onBlur={endEdit} />
            </label>
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                {label(t('trainingBoard.drill.minutes', 'Duración (min)'))}
                <Input type="number" min={0} max={240} step={1} value={d.minutes ?? ''} onChange={(e) => editMinutes(e.target.value)} onFocus={endEdit} onBlur={endEdit} />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                {label(t('trainingBoard.drill.players', 'Jugadores'))}
                <Input
                  value={d.players}
                  maxLength={30}
                  placeholder={t('trainingBoard.drill.playersPlaceholder', '14 + 2 porteros')}
                  onChange={(e) => editDrill('players', e.target.value)}
                  onFocus={endEdit}
                  onBlur={endEdit}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              {label(t('trainingBoard.drill.notes', 'Objetivo y reglas'))}
              <Textarea
                className="min-h-[92px]"
                value={d.notes}
                maxLength={2000}
                placeholder={t('trainingBoard.drill.notesPlaceholder', 'Qué se trabaja, reglas, variantes…')}
                onChange={(e) => editDrill('notes', e.target.value)}
                onFocus={endEdit}
                onBlur={endEdit}
              />
            </label>

            <h4 className="mt-1 text-base font-semibold text-foreground">{t('trainingBoard.drill.field', 'Campo')}</h4>
            <div className="grid grid-cols-3 gap-1.5">
              {FIELD_KEYS.map((k) => {
                const fs = FIELDS[k];
                const b = bbox(fs);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={d.field === k}
                    onClick={() => pickField(k)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md border bg-card px-1 py-1.5 text-xs text-foreground',
                      d.field === k ? 'border-ai ring-1 ring-ai' : 'border-border',
                    )}
                  >
                    <svg
                      viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
                      preserveAspectRatio="xMidYMid meet"
                      className="h-[34px] w-full"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: fieldSVG(fs, 'fc' + k) }}
                    />
                    {t(`trainingBoard.field.${k}`)}
                  </button>
                );
              })}
            </div>

            <h4 className="mt-1 text-base font-semibold text-foreground">{t('trainingBoard.drill.formations', 'Formaciones')}</h4>
            {(
              [
                ['a', fa, setFormA, t('trainingBoard.drill.teamA', 'Equipo A')],
                ['b', fb, setFormB, t('trainingBoard.drill.teamB', 'Equipo B')],
              ] as [TeamKey, string, (v: string) => void, string][]
            ).map(([team, value, setValue, txt]) => (
              <div key={team} className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  {label(txt)}
                  <select className={nativeSelect} value={value} onChange={(e) => setValue(e.target.value)}>
                    {forms.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <Button variant="secondary" onClick={() => placeFormation(team, value)}>
                  {t('trainingBoard.drill.place', 'Colocar')}
                </Button>
              </div>
            ))}

            <h4 className="mt-1 text-base font-semibold text-foreground">{t('trainingBoard.drill.colors', 'Colores')}</h4>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['a', t('trainingBoard.drill.teamA', 'Equipo A')],
                  ['b', t('trainingBoard.drill.teamB', 'Equipo B')],
                  ['ga', t('trainingBoard.drill.gkA', 'Portero A')],
                  ['gb', t('trainingBoard.drill.gkB', 'Portero B')],
                ] as [keyof TeamColors, string][]
              ).map(([k, txt]) => (
                <label key={k} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm text-foreground">
                  <input
                    type="color"
                    className="h-[26px] w-[30px] cursor-pointer border-0 bg-transparent p-0"
                    value={d.colors[k]}
                    onChange={(e) => setColor(k, e.target.value)}
                    onBlur={endEdit}
                  />
                  {txt}
                </label>
              ))}
            </div>
            <Button variant="secondary" className="self-start text-danger" onClick={clearBoard}>
              {clearArmed ? t('trainingBoard.drill.clearConfirm', 'Toca otra vez para vaciar') : t('trainingBoard.drill.clear', 'Vaciar pizarra')}
            </Button>
          </div>
        )}

        {tab === 'an' && (
          <div className="flex flex-col gap-3.5">
            <p className="text-sm text-muted-foreground">
              {t(
                'trainingBoard.anim.help',
                'Cada fotograma guarda dónde está cada pieza. Añade uno, mueve jugadores y balón, añade otro y repite. Al reproducir, las piezas se desplazan de un fotograma al siguiente.',
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {d.frames.length ? (
                d.frames.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={i === s.activeFrame}
                    aria-label={t('trainingBoard.anim.frameN', 'Fotograma {{n}}', { n: i + 1 })}
                    onClick={() => !isPlaying && goFrame(i)}
                    className={cn(
                      'size-11 rounded-lg border text-lg font-bold',
                      i === s.activeFrame ? 'border-ai bg-ai text-white' : 'border-border bg-card text-foreground',
                    )}
                  >
                    {i + 1}
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t('trainingBoard.anim.empty', 'Aún no hay fotogramas.')}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={addFrame} disabled={isPlaying}>
                <Plus className="size-4" />
                {t('trainingBoard.anim.add', 'Añadir fotograma')}
              </Button>
              <Button variant="secondary" onClick={delFrame} disabled={s.activeFrame === null || isPlaying}>
                {t('trainingBoard.anim.delete', 'Eliminar fotograma')}
              </Button>
              <Button
                variant="secondary"
                disabled={s.activeFrame === null || isPlaying}
                onClick={() => {
                  s.activeFrame = null;
                  renderFrameTag();
                  bump();
                }}
              >
                {t('trainingBoard.anim.exit', 'Editar sin fotograma')}
              </Button>
            </div>
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                {label(t('trainingBoard.anim.speed', 'Velocidad'))}
                <select className={nativeSelect} value={speed} onChange={(e) => setSpeed(e.target.value)}>
                  <option value="0.5">{t('trainingBoard.anim.slow', 'Lenta')}</option>
                  <option value="1">{t('trainingBoard.anim.normal', 'Normal')}</option>
                  <option value="1.8">{t('trainingBoard.anim.fast', 'Rápida')}</option>
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1">
                {label(t('trainingBoard.anim.repeat', 'Repetición'))}
                <select className={nativeSelect} value={loop} onChange={(e) => setLoop(e.target.value)}>
                  <option value="0">{t('trainingBoard.anim.once', 'Una vez')}</option>
                  <option value="1">{t('trainingBoard.anim.loop', 'En bucle')}</option>
                </select>
              </label>
            </div>
            <div>{playButton(false)}</div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="flex h-[calc(100dvh-9rem)] min-h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-card"
      style={{ ['--tb-ca' as string]: d.colors.a, ['--tb-cb' as string]: d.colors.b, ['--tb-cg' as string]: d.colors.ga }}
    >
      {/* Barra superior */}
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-3">
        <div className="flex min-w-0 flex-col border-l-0 leading-tight">
          <span className="truncate text-xs text-muted-foreground">{s.S.title || t('trainingBoard.tabs.session', 'Sesión')}</span>
          <span className="truncate text-base font-semibold text-foreground">
            {s.cur + 1}. {d.name || tx().drill}
          </span>
        </div>
        <div className="flex-1" />
        <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground md:flex" role="status">
          <i className={cn('inline-block size-[7px] rounded-full', statusDot[status])} />
          {statusText[status]}
        </span>
        <Button variant="secondary" size="icon" onClick={undo} disabled={!s.hist.length} title={t('trainingBoard.top.undo', 'Deshacer (Ctrl+Z)')} aria-label={t('trainingBoard.top.undoShort', 'Deshacer')}>
          <Undo2 className="size-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={redo} disabled={!s.redo.length} title={t('trainingBoard.top.redo', 'Rehacer (Ctrl+Y)')} aria-label={t('trainingBoard.top.redoShort', 'Rehacer')}>
          <Redo2 className="size-4" />
        </Button>
        <Button variant="secondary" className="hidden lg:inline-flex" onClick={openLib}>
          <FolderOpen className="size-4" />
          {t('trainingBoard.lib.title', 'Mis sesiones')}
        </Button>
        <Button className="hidden lg:inline-flex" onClick={exportPNG}>
          <ImageDown className="size-4" />
          {t('trainingBoard.export.png', 'Exportar imagen')}
        </Button>
        <Button variant="secondary" className="lg:hidden" onClick={() => setPanelOpen((v) => !v)} aria-label={t('trainingBoard.panel.open', 'Abrir panel de sesión')}>
          <Menu className="size-4" />
          {t('trainingBoard.tabs.session', 'Sesión')}
        </Button>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[136px_1fr_340px]">
        {/* Rail de herramientas */}
        <nav
          aria-label={t('trainingBoard.rail.label', 'Herramientas')}
          className="order-3 flex shrink-0 gap-1.5 overflow-x-auto border-t border-border p-1.5 lg:order-none lg:flex-col lg:gap-3 lg:overflow-y-auto lg:overflow-x-hidden lg:border-r lg:border-t-0 lg:p-2.5"
        >
          {TOOL_GROUPS.map((g) => (
            <div key={g.key} className="flex gap-0.5 border-r border-border pr-1.5 last:border-r-0 lg:grid lg:grid-cols-2 lg:gap-1 lg:border-r-0 lg:pr-0">
              <h3 className="col-span-2 mb-0.5 ml-1 hidden text-xs font-semibold text-muted-foreground lg:block">{t(`trainingBoard.rail.${g.key}`)}</h3>
              {g.tools.map((tl) => (
                <button
                  key={tl}
                  type="button"
                  aria-pressed={s.tool === tl}
                  title={toolName(tl)}
                  onClick={() => setTool(tl)}
                  className={cn(
                    'flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1 text-center text-[11.5px] leading-tight lg:w-auto',
                    s.tool === tl ? 'border-ai bg-ai text-white' : 'border-transparent text-foreground hover:bg-panel',
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="size-6"
                    dangerouslySetInnerHTML={{ __html: TOOL_ICONS[tl] }}
                  />
                  <span>{toolName(tl)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Escenario */}
        <div ref={stageRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-panel" data-tool={isDrawTool(s.tool) ? 'draw' : 'other'}>
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
            aria-label={t('trainingBoard.board', 'Pizarra')}
            className={cn(
              'absolute inset-0 block size-full touch-none select-none',
              isDrawTool(s.tool) ? 'cursor-crosshair [&_.dw]:cursor-crosshair [&_.o]:cursor-crosshair' : '[&_.dw]:cursor-grab [&_.o]:cursor-grab',
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
          >
            <g ref={worldRef}>
              <g ref={fieldRef} />
              <g ref={drawRef} />
              <g ref={objRef} />
              <g ref={tempRef} />
            </g>
          </svg>
          {ctxBar && (
            <div className="absolute left-1/2 top-2.5 z-[3] flex max-w-[calc(100%-20px)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-1.5 text-sm shadow-elevated">
              {ctxBar}
            </div>
          )}
          <div className="absolute bottom-3 right-3 z-[3] flex items-center gap-2">
            <span ref={frameTagRef} hidden className="rounded-lg border border-border bg-card px-2.5 py-2.5 text-sm font-semibold text-foreground shadow-elevated" />
            {canPlay && playButton(true)}
            <Button
              variant="secondary"
              size="icon"
              className="shadow-elevated"
              title={t('trainingBoard.top.rotate', 'Girar campo')}
              aria-label={t('trainingBoard.top.rotate', 'Girar campo')}
              onClick={() => {
                s.orient = s.vertical ? 'h' : 'v';
                s.fieldKey = '';
                renderBoard();
              }}
            >
              <RotateCw className="size-4" />
            </Button>
          </div>
        </div>

        {/* Panel: lateral en escritorio, hoja inferior en móvil/tablet */}
        <aside
          aria-label={t('trainingBoard.panel.label', 'Sesión y ejercicio')}
          className={cn(
            'flex min-h-0 flex-col border-border bg-card',
            'lg:static lg:z-auto lg:h-auto lg:translate-y-0 lg:rounded-none lg:border-l lg:shadow-none',
            'absolute inset-x-0 bottom-0 z-10 h-[min(76%,640px)] rounded-t-2xl border shadow-elevated transition-transform duration-200 motion-reduce:transition-none',
            panelOpen ? 'translate-y-0' : 'translate-y-[105%]',
          )}
        >
          {panel}
        </aside>
      </div>

      {/* Biblioteca */}
      <Dialog open={libOpen} onOpenChange={setLibOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader className="flex flex-row items-center gap-2.5 space-y-0">
            <DialogTitle className="flex-1">{t('trainingBoard.lib.title', 'Mis sesiones')}</DialogTitle>
            <Button onClick={createSession}>{t('trainingBoard.lib.new', 'Nueva sesión')}</Button>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto pb-1">
            {libList === null ? (
              <p className="text-sm text-muted-foreground">{t('trainingBoard.lib.loading', 'Cargando…')}</p>
            ) : (
              libList.map((x) => {
                const mins = totalMinutes(x);
                const date = x.date ? new Date(x.date + 'T12:00').toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                const armed = armedDelete === x.id;
                return (
                  <div key={x.id} className={cn('grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border px-3 py-2.5', x.id === s.S.id ? 'border-ai' : 'border-border')}>
                    <button type="button" className="min-w-0 text-left" onClick={() => openFromLib(x)}>
                      <b className="block truncate font-semibold text-foreground">{x.title || t('trainingBoard.tabs.session', 'Sesión')}</b>
                      <small className="text-muted-foreground">
                        {[date, t('trainingBoard.lib.drillsCount', '{{count}} ejercicios', { count: (x.drills || []).length }), mins + ' min'].filter(Boolean).join(', ')}
                      </small>
                    </button>
                    <Button
                      variant={armed ? 'danger' : 'secondary'}
                      size={armed ? 'sm' : 'icon'}
                      onClick={() => void deleteFromLib(x.id)}
                      aria-label={t('trainingBoard.lib.delete', 'Eliminar sesión')}
                    >
                      {armed ? t('trainingBoard.lib.confirm', 'Confirmar') : <Trash2 className="size-4" />}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
