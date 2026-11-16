/**
 * Rivales — scouting de equipos rivales para el simulador de enfrentamientos.
 *
 * Permite registrar rivales (nombre, competición, estilo de juego y fuerzas
 * de ataque/defensa 0-100) y eliminarlos. Estos rivales aparecen luego en la
 * pestaña "Enfrentamiento" de Simulación IA para cruzarlos contra un equipo
 * propio (modelo de Poisson). Los datos viven en la tabla `rivals` (migración
 * 024) y se acceden por el backend.
 */
import { useEffect, useState } from 'react';
import { Plus, Shield, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  createRival,
  deleteRival,
  listRivals,
  type Rival,
  type RivalStyle,
} from '@/lib/backendApi';
import { toast } from '@/store/toastStore';
import { canWrite } from '@/utils/permissions';

type LoadState = 'loading' | 'error' | 'ready';

const STYLE_LABELS: Record<RivalStyle, string> = {
  equilibrado: 'Equilibrado',
  posesion: 'Posesión',
  presion: 'Presión alta',
  contragolpe: 'Contragolpe',
  ofensivo: 'Ofensivo',
  defensivo: 'Defensivo',
};

export default function Rivales({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>('loading');
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [saving, setSaving] = useState(false);
  // Motivo real del fallo: antes se mostraba siempre "¿ejecutaste la migración
  // 024?" aunque el problema fuera un 403 de rol o el backend reiniciando.
  const [loadError, setLoadError] = useState<string | null>(null);

  // Formulario de alta.
  const [name, setName] = useState('');
  const [competition, setCompetition] = useState('');
  const [style, setStyle] = useState<RivalStyle>('equilibrado');
  const [attack, setAttack] = useState('');
  const [defense, setDefense] = useState('');

  const writable = canWrite(role);

  const load = () => {
    setState('loading');
    listRivals(orgId)
      .then((data) => {
        setRivals(data);
        setLoadError(null);
        setState('ready');
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : String(err));
        setState('error');
      });
  };

  useEffect(load, [orgId]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: t('rivals.nameRequired', 'El nombre es obligatorio'), variant: 'danger' });
      return;
    }
    setSaving(true);
    try {
      await createRival(orgId, {
        name: name.trim(),
        competition: competition.trim() || null,
        play_style: style,
        attack_rating: attack ? Number(attack) : null,
        defense_rating: defense ? Number(defense) : null,
      });
      toast({ title: t('rivals.created', 'Rival agregado'), variant: 'success' });
      setName('');
      setCompetition('');
      setAttack('');
      setDefense('');
      setStyle('equilibrado');
      load();
    } catch (err) {
      toast({
        title: t('rivals.createError', 'No se pudo agregar el rival'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rival: Rival) => {
    try {
      await deleteRival(orgId, rival.id);
      toast({ title: t('rivals.deleted', 'Rival eliminado'), variant: 'success' });
      load();
    } catch (err) {
      toast({
        title: t('rivals.deleteError', 'No se pudo eliminar'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'danger',
      });
    }
  };

  if (state === 'error') {
    return (
      <ErrorState
        title={t('rivals.loadError', 'No se pudieron cargar los rivales')}
        description={loadError ?? t('rivals.loadErrorDesc', '¿Ejecutaste la migración 024_rivals.sql y el backend está corriendo?')}
        onRetry={load}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Shield className="size-6 text-ai" aria-hidden="true" />
          {t('rivals.title', 'Rivales')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('rivals.subtitle', 'Registra los equipos rivales de tu competición para simular enfrentamientos')}
        </p>
      </div>

      {writable && (
        <Card className="mb-5">
          <CardHeader>
            <div>
              <CardTitle>{t('rivals.form.title', 'Agregar rival')}</CardTitle>
              <CardDescription className="mt-1">
                {t('rivals.form.description', 'Las fuerzas (0-100) son opcionales: si las dejas vacías, se estiman como neutras. El estilo influye en la lectura táctica.')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">{t('rivals.form.name', 'Nombre *')}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Rival FC" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t('rivals.form.competition', 'Competición')}</label>
              <Input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Liga" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t('rivals.form.style', 'Estilo')}</label>
              <Select value={style} onValueChange={(v) => setStyle(v as RivalStyle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STYLE_LABELS) as RivalStyle[]).map((s) => (
                    <SelectItem key={s} value={s}>{STYLE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t('rivals.form.attack', 'Ataque (0-100)')}</label>
              <Input type="number" min={0} max={100} value={attack} onChange={(e) => setAttack(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t('rivals.form.defense', 'Defensa (0-100)')}</label>
              <Input type="number" min={0} max={100} value={defense} onChange={(e) => setDefense(e.target.value)} placeholder="—" />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-6">
              <Button variant="primary" isLoading={saving} onClick={handleCreate}>
                <Plus className="size-4" aria-hidden="true" />
                {t('rivals.form.add', 'Agregar rival')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state === 'loading' ? (
        <LoadingOverlay message={t('rivals.loading', 'Cargando rivales…')} />
      ) : rivals.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={t('rivals.empty.title', 'Sin rivales registrados')}
          description={t('rivals.empty.description', 'Agrega tu primer rival arriba para poder simular enfrentamientos contra él.')}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('rivals.list.title', 'Rivales registrados')}</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('rivals.col.name', 'Rival')}</TableHead>
                <TableHead>{t('rivals.col.competition', 'Competición')}</TableHead>
                <TableHead>{t('rivals.col.style', 'Estilo')}</TableHead>
                <TableHead className="text-right">{t('rivals.col.attack', 'Ataque')}</TableHead>
                <TableHead className="text-right">{t('rivals.col.defense', 'Defensa')}</TableHead>
                {writable && <TableHead className="text-right" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rivals.map((rival) => (
                <TableRow key={rival.id}>
                  <TableCell className="font-medium text-foreground">{rival.name}</TableCell>
                  <TableCell className="text-muted-foreground">{rival.competition ?? '--'}</TableCell>
                  <TableCell>
                    <Badge variant="purple">{STYLE_LABELS[rival.play_style] ?? rival.play_style}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{rival.attack_rating ?? '--'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{rival.defense_rating ?? '--'}</TableCell>
                  {writable && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rival)} aria-label={t('rivals.delete', 'Eliminar')}>
                        <Trash2 className="size-4 text-danger" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
