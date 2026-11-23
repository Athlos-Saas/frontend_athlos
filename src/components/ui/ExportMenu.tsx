import { useState } from 'react';
import { Download, FileSpreadsheet, ImageDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { toast } from '@/store/toastStore';
import { Button } from './Button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './DropdownMenu';

export interface ExportMenuProps {
  /** Descarga la imagen. Si falta, no se ofrece PNG (p. ej. una tabla). */
  onExportPng?: () => Promise<void> | void;
  /** Descarga el CSV. Si falta, no se ofrece CSV (el gráfico no recibió datos). */
  onExportCsv?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Botón de descarga (ícono) con menú PNG / CSV. Lo usa ChartCard y cualquier
 * card con tabla a mano que quiera ofrecer CSV sin pasar a DataTable.
 * Un solo botón con menú y no dos botones sueltos: en el header de una card
 * angosta (dashboard en 3 columnas) dos botones empujan el título a 2 líneas.
 */
export function ExportMenu({ onExportPng, onExportCsv, disabled, className }: ExportMenuProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);

  if (!onExportPng && !onExportCsv) return null;

  async function handlePng() {
    if (!onExportPng) return;
    setIsExporting(true);
    try {
      await onExportPng();
    } catch {
      toast({
        title: t('dataviz.export.pngError', 'No se pudo generar la imagen'),
        description: t(
          'dataviz.export.pngErrorDescription',
          'Este gráfico no tiene contenido que se pueda capturar. Prueba con el CSV.',
        ),
        variant: 'danger',
      });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          disabled={disabled || isExporting}
          isLoading={isExporting}
          aria-label={t('dataviz.export.menu', 'Descargar')}
          title={t('dataviz.export.menu', 'Descargar')}
          data-export-ignore=""
        >
          {!isExporting && <Download className="size-4" aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportPng && (
          <DropdownMenuItem onSelect={() => void handlePng()}>
            <ImageDown className="size-4" aria-hidden="true" />
            {t('dataviz.export.png', 'Descargar imagen (PNG)')}
          </DropdownMenuItem>
        )}
        {onExportCsv && (
          <DropdownMenuItem onSelect={onExportCsv}>
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            {t('dataviz.export.csv', 'Descargar datos (CSV)')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
