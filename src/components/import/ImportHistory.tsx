import { useEffect, useState } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { supabase } from '@/lib/supabase';
import type { ImportKind } from '@/lib/importers/types';

interface ImportLogRow {
  file_name: string;
  written: number;
  skipped: number;
  created_at: string;
}

/** Card compacta con los últimos imports de un tipo, para ver qué se cargó y cuándo. */
export function ImportHistory({ orgId, kind, reloadToken }: { orgId: string; kind: ImportKind; reloadToken: number }) {
  const [logs, setLogs] = useState<ImportLogRow[]>([]);

  useEffect(() => {
    supabase
      .from('import_logs')
      .select('file_name, written, skipped, created_at')
      .eq('org_id', orgId)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setLogs(data ?? []));
  }, [orgId, kind, reloadToken]);

  if (logs.length === 0) return null;

  return (
    <Card className="mb-5">
      <CardHeader>
        <div>
          <CardTitle>Últimos imports</CardTitle>
          <CardDescription className="mt-1">Últimas 5 cargas de este tipo</CardDescription>
        </div>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Archivo</TableHead>
            <TableHead className="text-right">Escritas</TableHead>
            <TableHead className="text-right">Omitidas</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <TableRow key={index}>
              <TableCell className="font-medium">{log.file_name}</TableCell>
              <TableCell className="text-right text-muted-foreground">{log.written}</TableCell>
              <TableCell className="text-right text-muted-foreground">{log.skipped}</TableCell>
              <TableCell className="text-muted-foreground">{new Date(log.created_at).toLocaleString('es-ES')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
