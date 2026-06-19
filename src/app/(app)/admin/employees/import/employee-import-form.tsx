"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  applyEmployeeBasisImport,
  previewEmployeeBasisImport,
  type EmployeeImportPreview,
} from "@/lib/actions/employee-import";

type ActionResult =
  | { error: string; preview?: EmployeeImportPreview }
  | { preview: EmployeeImportPreview }
  | { success: true; batchId: string; preview: EmployeeImportPreview };

export function EmployeeImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [ignoreTemporaryCodes, setIgnoreTemporaryCodes] = useState(false);
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildFormData() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose an Excel file first.");
      return null;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("deactivate_missing", String(deactivateMissing));
    formData.set("ignore_temporary_codes", String(ignoreTemporaryCodes));
    return formData;
  }

  function handlePreview() {
    const formData = buildFormData();
    if (!formData) return;

    startTransition(async () => {
      const result = (await previewEmployeeBasisImport(formData)) as ActionResult;
      if ("error" in result) {
        toast.error(result.error);
        if (result.preview) setPreview(result.preview);
        return;
      }

      setPreview(result.preview);
      toast.success("Preview ready.");
    });
  }

  function handleApply() {
    const formData = buildFormData();
    if (!formData) return;

    startTransition(async () => {
      const result = (await applyEmployeeBasisImport(formData)) as ActionResult;
      if ("error" in result) {
        toast.error(result.error);
        if (result.preview) setPreview(result.preview);
        return;
      }

      setPreview(result.preview);
      toast.success("Employee import applied.");
    });
  }

  const hasBlockingIssues = Boolean(preview?.invalidRows.length || preview?.duplicateEmployeeCodes.length);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Employee Basis File</CardTitle>
          <CardDescription>
            Upload the latest HR basis workbook, preview the changes, then confirm the import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="basis-file">Excel file</Label>
            <Input
              ref={fileRef}
              id="basis-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={() => setPreview(null)}
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="deactivate-missing"
              checked={deactivateMissing}
              onCheckedChange={(checked) => {
                setDeactivateMissing(checked === true);
                setPreview(null);
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="deactivate-missing" className="cursor-pointer">
                Deactivate active employees missing from this file
              </Label>
              <p className="text-xs text-muted-foreground">
                Use this only when the uploaded workbook is the full employee master list. Employees are never deleted.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-amber-300/70 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
            <Checkbox
              id="ignore-temporary-codes"
              checked={ignoreTemporaryCodes}
              onCheckedChange={(checked) => {
                setIgnoreTemporaryCodes(checked === true);
                setPreview(null);
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="ignore-temporary-codes" className="cursor-pointer">
                Ignore rows where Employee Code is Temporary
              </Label>
              <p className="text-xs text-muted-foreground">
                Use this when HR has not assigned final employee codes yet. These rows will be skipped, not imported.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handlePreview} disabled={isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {isPending ? "Working..." : "Preview Import"}
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={isPending || !preview || hasBlockingIssues}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm Import
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Parsed rows" value={preview.parsedRows} />
            <Metric label="New" value={preview.newEmployees.length} />
            <Metric label="Updates" value={preview.updatedEmployees.length} />
            <Metric label="Deactivate" value={preview.deactivatedEmployees.length} />
          </div>

          {hasBlockingIssues && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Fix Before Import
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {preview.duplicateEmployeeCodes.length > 0 && (
                  <p>Duplicate employee codes: {preview.duplicateEmployeeCodes.join(", ")}</p>
                )}
                {preview.invalidRows.map((row) => (
                  <p key={`${row.row}-${row.reason}`}>
                    Row {row.row}: {row.reason}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {preview.ignoredRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ignored Rows</CardTitle>
                <CardDescription>
                  These rows were skipped because HR chose to ignore temporary employee-code rows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {preview.ignoredRows.map((row) => (
                  <p key={`${row.row}-${row.reason}`}>
                    Row {row.row}: {row.reason}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <PreviewTable
            title="New Employees"
            rows={preview.newEmployees.slice(0, 10).map((employee) => ({
              id: employee.employee_id,
              name: employee.full_name,
              job: employee.job_title,
              detail: employee.department ?? employee.manager_name ?? "No manager",
            }))}
            empty="No new employees."
          />

          <PreviewTable
            title="Updated Employees"
            rows={preview.updatedEmployees.slice(0, 10).map((item) => ({
              id: item.after.employee_id,
              name: item.after.full_name,
              job: item.after.job_title,
              detail: item.changes.join(", "),
            }))}
            empty="No employee updates."
          />

          <PreviewTable
            title="Employees To Deactivate"
            rows={preview.deactivatedEmployees.slice(0, 10).map((employee) => ({
              id: employee.employee_id,
              name: employee.full_name,
              job: employee.job_title,
              detail: "Missing from uploaded file",
            }))}
            empty={deactivateMissing ? "No employees will be deactivated." : "Deactivation is off for this preview."}
          />
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function PreviewTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { id: string; name: string; job: string; detail: string }[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary">{rows.length} shown</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.job}</TableCell>
                  <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
