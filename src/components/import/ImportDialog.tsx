import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import { toast } from '@/store/toastStore';
import { supabase } from '@/lib/supabase';
import { detectKind } from '@/lib/importers/detect';
import type { ImportKind, ImportSummary } from '@/lib/importers/types';

const KIND_LABEL: Record<ImportKind, string> = {
  roster: 'roster físico',
  catapult: 'sesiones GPS de Catapult',
  conference: 'stats de conferencia',
  unknown: 'desconocido',
};

type Status = 'idle' | 'analyzing' | 'preview' | 'rejected' | 'importing';

export interface ImportDialogProps<TParsed> {
  /** Organización actual: se usa para loguear el import en import_logs. */
  orgId: string;
  triggerLabel: string;
  title: string;
  description?: string;
  /** Atributo `accept` del input de archivo, ej. ".xlsx" o ".csv,.xlsx". */
  accept: string;
  expectedKind: ImportKind;
  parse: (workbook: WorkBook) => TParsed;
  describePreview: (parsed: TParsed) => string;
  /** Avisos no bloqueantes sobre los datos parseados (rangos raros, etc.). */
  validate?: (parsed: TParsed) => string[];
  onConfirm: (parsed: TParsed) => Promise<ImportSummary>;
  /** Deshabilita el botón que abre el diálogo (ej. mientras no se resuelve el equipo). */
  disabled?: boolean;
  /** Genera y descarga el archivo de plantilla vacío para este import. */
  onDownloadTemplate: () => void;
}

async function logImport(
  orgId: string,
  kind: ImportKind,
  fileName: string,
  summary: ImportSummary,
): Promise<void> {
  const { data } = await supabase.auth.getUser();
  await supabase.from('import_logs').insert({
    org_id: orgId,
    user_id: data.user?.id ?? null,
    kind,
    file_name: fileName,
    written: summary.written,
    skipped: summary.skipped,
    warnings: summary.warnings,
  });
}

export function ImportDialog<TParsed>({
  orgId,
  triggerLabel,
  title,
  description,
  accept,
  expectedKind,
  parse,
  describePreview,
  validate,
  onConfirm,
  disabled,
  onDownloadTemplate,
}: ImportDialogProps<TParsed>) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [parsed, setParsed] = useState<TParsed | null>(null);

  const reset = () => {
    setStatus('idle');
    setFileName('');
    setMessage('');
    setValidationWarnings([]);
    setParsed(null);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setStatus('analyzing');
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { cellDates: true });
      const detected = detectKind(workbook);

      if (detected.kind !== expectedKind) {
        setStatus('rejected');
        setMessage(
          detected.reason ??
            `Detecté un archivo de ${KIND_LABEL[detected.kind]}, pero esta sección espera ${KIND_LABEL[expectedKind]}.`,
        );
        return;
      }

      const result = parse(workbook);
      setParsed(result);
      setMessage(describePreview(result));
      setValidationWarnings(validate ? validate(result) : []);
      setStatus('preview');
    } catch (error) {
      setStatus('rejected');
      setMessage(error instanceof Error ? error.message : 'No pude leer el archivo.');
    }
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    setStatus('importing');
    try {
      const summary = await onConfirm(parsed);
      await logImport(orgId, expectedKind, fileName, summary);
      toast({
        title: 'Importación completa',
        description: `${summary.written} filas escritas${summary.skipped ? `, ${summary.skipped} omitidas` : ''}.${
          summary.warnings.length ? ` ${summary.warnings.join(' ')}` : ''
        }`,
        variant: 'success',
      });
      setOpen(false);
      reset();
    } catch (error) {
      toast({
        title: 'Error al importar',
        description: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
        variant: 'danger',
      });
      setStatus('preview');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={disabled}>
          <Upload className="size-4" aria-hidden="true" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Button variant="secondary" size="sm" className="mb-4" onClick={onDownloadTemplate}>
          <Download className="size-4" aria-hidden="true" /> Descargar plantilla
        </Button>

        <input
          type="file"
          accept={accept}
          disabled={status === 'analyzing' || status === 'importing'}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="mb-4 text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
        />

        {fileName && (
          <p className="mb-2 text-xs text-muted-foreground">
            Archivo: <span className="font-medium text-foreground">{fileName}</span>
          </p>
        )}

        {status === 'analyzing' && <p className="text-sm text-muted-foreground">Analizando…</p>}
        {status === 'rejected' && <p className="text-sm text-danger">{message}</p>}
        {(status === 'preview' || status === 'importing') && (
          <>
            <p className="text-sm text-success">{message}</p>
            {validationWarnings.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-warning">
                {validationWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={status !== 'preview'}
            isLoading={status === 'importing'}
            onClick={handleConfirm}
          >
            Confirmar e importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
