import { useEffect, useState, type FormEvent } from 'react';
import { HeartPulse } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import type { Player, WellnessEntry } from '@/types/domain';

const TODAY = new Date().toISOString().slice(0, 10);

const INITIAL_FORM = {
  entry_date: TODAY,
  rpe: 5,
  sleep_hours: 7.5,
  sleep_quality: 3,
  soreness: 2,
  mood: 4,
  notes: '',
};

interface SliderFieldProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}

function SliderField({ id, label, min, max, step = 1, value, onChange }: SliderFieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 flex justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-success">{value}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[#22C55E]"
      />
    </div>
  );
}

export default function Wellness({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [entries, setEntries] = useState<WellnessEntry[]>([]);

  const setField = <K extends keyof typeof INITIAL_FORM>(key: K) => (value: (typeof INITIAL_FORM)[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const loadEntries = () => {
    supabase
      .from('wellness_entries')
      .select('entry_date, player_id, rpe, sleep_hours, soreness, mood')
      .eq('org_id', orgId)
      .order('entry_date', { ascending: false })
      .limit(60)
      .then(({ data }) => setEntries(data ?? []));
  };

  useEffect(() => {
    supabase
      .from('players')
      .select('id, full_name')
      .eq('org_id', orgId)
      .order('full_name')
      .then(({ data }) => {
        setPlayers(data ?? []);
        if (data?.length) setSelectedPlayerId(data[0].id);
      });
    loadEntries();
  }, [orgId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    const { error } = await supabase.from('wellness_entries').upsert(
      {
        org_id: orgId,
        player_id: selectedPlayerId,
        entry_date: form.entry_date,
        rpe: form.rpe,
        sleep_hours: form.sleep_hours,
        sleep_quality: form.sleep_quality,
        soreness: form.soreness,
        mood: form.mood,
        notes: form.notes || null,
      },
      { onConflict: 'player_id,entry_date' },
    );
    setIsSaving(false);
    if (error) {
      toast({ title: t('wellness.toast.saveErrorTitle', 'No se pudo guardar'), description: error.message, variant: 'danger' });
      return;
    }
    toast({ title: t('wellness.toast.saveSuccessTitle', 'Wellness guardado'), variant: 'success' });
    loadEntries();
  };

  const entriesPager = usePagedRows(entries, 10);

  // Ojo: ningún hook puede ir después de estos returns condicionales.
  if (players === null) return <Spinner />;
  if (players.length === 0) {
    return <EmptyState icon={HeartPulse} title={t('wellness.noPlayersTitle', 'Sin jugadores registrados')} />;
  }

  const idToName = Object.fromEntries(players.map((player) => [player.id, player.full_name]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('wellness.title', 'Wellness diario')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('wellness.subtitle', 'RPE, sueño y dolor — la variable que falta para modelar riesgo de lesión')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('wellness.registerTitle', 'Registrar')}</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <Field label={t('wellness.field.player', 'Jugador')} htmlFor="player">
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger id="player">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {players.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('wellness.field.date', 'Fecha')} htmlFor="entry_date">
              <Input
                id="entry_date"
                type="date"
                value={form.entry_date}
                onChange={(event) => setField('entry_date')(event.target.value)}
              />
            </Field>
            <SliderField id="rpe" label={t('wellness.slider.rpe', 'RPE (esfuerzo percibido)')} min={0} max={10} value={form.rpe} onChange={setField('rpe')} />
            <SliderField
              id="sleep_hours"
              label={t('wellness.slider.sleepHours', 'Horas de sueño')}
              min={0}
              max={14}
              step={0.5}
              value={form.sleep_hours}
              onChange={setField('sleep_hours')}
            />
            <SliderField
              id="sleep_quality"
              label={t('wellness.slider.sleepQuality', 'Calidad de sueño')}
              min={1}
              max={5}
              value={form.sleep_quality}
              onChange={setField('sleep_quality')}
            />
            <SliderField id="soreness" label={t('wellness.slider.soreness', 'Dolor muscular')} min={0} max={10} value={form.soreness} onChange={setField('soreness')} />
            <SliderField id="mood" label={t('wellness.slider.mood', 'Ánimo')} min={1} max={5} value={form.mood} onChange={setField('mood')} />
            <Field label={t('wellness.field.notes', 'Notas')} htmlFor="notes">
              <Textarea id="notes" rows={2} value={form.notes} onChange={(event) => setField('notes')(event.target.value)} />
            </Field>
            <Button type="submit" isLoading={isSaving} className="w-full">
              {t('wellness.saveButton', 'Guardar')}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('wellness.recentTitle', 'Últimos registros')}</CardTitle>
          </CardHeader>
          {entries.length === 0 ? (
            <EmptyState title={t('wellness.noEntriesTitle', 'Sin registros')} description={t('wellness.noEntriesDescription', 'Todavía no hay registros de wellness.')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('wellness.col.date', 'Fecha')}</TableHead>
                  <TableHead>{t('wellness.col.player', 'Jugador')}</TableHead>
                  <TableHead>{t('wellness.col.rpe', 'RPE')}</TableHead>
                  <TableHead>{t('wellness.col.sleep', 'Sueño')}</TableHead>
                  <TableHead>{t('wellness.col.soreness', 'Dolor')}</TableHead>
                  <TableHead>{t('wellness.col.mood', 'Ánimo')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesPager.paged.map((entry, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <TableRow key={index}>
                    <TableCell className="text-muted-foreground">{entry.entry_date}</TableCell>
                    <TableCell className="font-medium">{idToName[entry.player_id] ?? '—'}</TableCell>
                    <TableCell>{entry.rpe}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.sleep_hours}h</TableCell>
                    <TableCell>
                      <Badge variant={entry.soreness >= 6 ? 'danger' : 'success'}>{entry.soreness}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.mood}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {entries.length > 0 && (
            <Pagination page={entriesPager.page} pageCount={entriesPager.pageCount} onPageChange={entriesPager.setPage} className="mt-4" />
          )}
        </Card>
      </div>
    </div>
  );
}
