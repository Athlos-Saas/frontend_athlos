import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';
import { brandedFileName, downloadCsv, exportChartPng, objectsToRows, type CsvColumn } from '@/utils/chartExport';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';
import { ExportMenu } from './ExportMenu';
import { Skeleton } from './Skeleton';

export type ChartExportColumn = CsvColumn;

export interface ChartCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  isLoading?: boolean;
  height?: number;
  children: ReactNode;
  className?: string;
  /**
   * Muestra el botón de descarga con PNG (gráfico + título + firma ATHLOS).
   * Opcional y apagado por defecto: ninguna pantalla existente cambia hasta
   * que lo pida. Pasar `exportData` lo activa solo.
   */
  exportable?: boolean;
  /**
   * Filas que dibuja el gráfico. Si se pasan, el menú ofrece también CSV.
   * `object` y no `Record<string, unknown>` para aceptar las interfaces de
   * dominio tal cual (una interface no es asignable a un Record).
   */
  exportData?: ReadonlyArray<object>;
  /** Columnas y encabezados del CSV; sin esto se usan las claves de las filas. */
  exportColumns?: ChartExportColumn[];
  /** Base del nombre de archivo (sin extensión); por defecto, el título. */
  exportFileName?: string;
  /**
   * Crédito de la fuente que se imprime en la firma del PNG (p. ej. "Datos:
   * StatsBomb Open Data"). Obligatorio en la práctica cuando el dato no es
   * del cliente: la imagen circula sin la pantalla que lo aclaraba.
   */
  exportCredit?: string;
}

export function ChartCard({
  title,
  description,
  actions,
  footer,
  isLoading,
  height = 280,
  children,
  className,
  exportable,
  exportData,
  exportColumns,
  exportFileName,
  exportCredit,
}: ChartCardProps) {
  const { t, i18n } = useTranslation();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const canExport = Boolean(exportable || exportData);
  const hasRows = Boolean(exportData && exportData.length > 0);
  const fileBase = exportFileName ?? title;

  async function handleExportPng() {
    if (!contentRef.current) return;
    const dateLabel = new Intl.DateTimeFormat(i18n.language || 'es', { dateStyle: 'medium' }).format(new Date());
    await exportChartPng(contentRef.current, {
      title,
      subtitle: description,
      fileName: brandedFileName(fileBase, 'png'),
      dateLabel: [exportCredit, t('dataviz.export.generatedOn', 'Generado el {{date}}', { date: dateLabel })]
        .filter(Boolean)
        .join(' · '),
    });
  }

  function handleExportCsv() {
    if (!exportData) return;
    downloadCsv(brandedFileName(fileBase, 'csv'), objectsToRows(exportData, exportColumns));
  }

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {canExport ? (
          // Wrapper solo cuando hay exportación: sin ella el header queda con
          // el mismo DOM de siempre (retrocompatible con layouts que dependen
          // de que `actions` sea hijo directo del flex).
          <div className="flex shrink-0 items-start gap-1">
            {actions}
            <ExportMenu
              onExportPng={handleExportPng}
              onExportCsv={hasRows ? handleExportCsv : undefined}
              disabled={isLoading}
            />
          </div>
        ) : (
          actions
        )}
      </CardHeader>
      <CardContent ref={contentRef} style={{ height }}>
        {isLoading ? <Skeleton className="h-full w-full" /> : children}
      </CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
