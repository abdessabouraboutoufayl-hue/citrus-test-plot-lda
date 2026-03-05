import { useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { type CalibreEntry, type CalibreType, getCalibreEntries, NB_ECHANTILLON } from "@/lib/calibre-config";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  type: CalibreType;
  values: Record<string, number>;
  onChange: (dbColumn: string, value: number) => void;
  codeVariete?: string;
  codePG?: string;
}

export default function CalibreStep({ type, values, onChange, codeVariete, codePG }: Props) {
  const entries = useMemo(() => getCalibreEntries(type), [type]);

  const total = useMemo(() => {
    return entries.reduce((sum, e) => sum + (values[e.dbColumn] || 0), 0);
  }, [entries, values]);

  const isValid = total === NB_ECHANTILLON;

  if (!type) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">
            Type de calibrage non déterminé pour cette variété.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          📏 Profil Calibre
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Échantillonnage calibre — {NB_ECHANTILLON} fruits aléatoires
          {codeVariete && codePG && (
            <span className="ml-1">
              du combo <Badge variant="secondary" className="ml-1">{codeVariete}</Badge>
              <Badge variant="outline" className="ml-1">{codePG}</Badge>
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Calibre</TableHead>
                <TableHead className="w-24">mm</TableHead>
                <TableHead className="w-24">Nb fruits</TableHead>
                <TableHead className="w-20">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const val = values[entry.dbColumn] || 0;
                const pct = total > 0 ? ((val / NB_ECHANTILLON) * 100).toFixed(1) : "0.0";
                return (
                  <TableRow key={entry.key}>
                    <TableCell className="font-medium">{entry.label}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{entry.range}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={NB_ECHANTILLON}
                        value={val || ""}
                        onChange={(e) => onChange(entry.dbColumn, Math.max(0, Number(e.target.value) || 0))}
                        className="h-8 w-20"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{pct}%</TableCell>
                  </TableRow>
                );
              })}
              {/* Total row */}
              <TableRow className="font-bold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell></TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 ${isValid ? "text-green-600" : "text-destructive"}`}>
                    {total} / {NB_ECHANTILLON}
                    {isValid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </span>
                </TableCell>
                <TableCell className={isValid ? "text-green-600" : "text-destructive"}>
                  {total > 0 ? ((total / NB_ECHANTILLON) * 100).toFixed(0) : "0"}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {!isValid && total > 0 && (
          <p className="text-sm text-destructive mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Le total doit être exactement {NB_ECHANTILLON} fruits ({NB_ECHANTILLON - total > 0 ? `il manque ${NB_ECHANTILLON - total}` : `${total - NB_ECHANTILLON} en trop`})
          </p>
        )}
      </CardContent>
    </Card>
  );
}
