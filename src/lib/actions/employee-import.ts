"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

type ParsedEmployee = EmployeeInsert & {
  employee_id: string;
  full_name: string;
  job_title: string;
};

export type EmployeeImportPreview = {
  fileName: string;
  totalRows: number;
  parsedRows: number;
  newEmployees: ParsedEmployee[];
  updatedEmployees: { before: EmployeeRow; after: ParsedEmployee; changes: string[] }[];
  deactivatedEmployees: EmployeeRow[];
  duplicateEmployeeCodes: string[];
  invalidRows: { row: number; reason: string }[];
  ignoredRows: { row: number; reason: string }[];
  deactivateMissing: boolean;
};

export async function previewEmployeeBasisImport(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const deactivateMissing = formData.get("deactivate_missing") === "true";
  const parsed = await parseEmployeeFile(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("employees")
    .select("*");

  if (error) return { error: error.message };

  return {
    preview: buildPreview(
      parsed.fileName,
      parsed.rows,
      existing ?? [],
      parsed.invalidRows,
      parsed.duplicateEmployeeCodes,
      parsed.ignoredRows,
      deactivateMissing
    ),
  };
}

export async function applyEmployeeBasisImport(formData: FormData) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const deactivateMissing = formData.get("deactivate_missing") === "true";
  const parsed = await parseEmployeeFile(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("employees")
    .select("*");

  if (error) return { error: error.message };

  const preview = buildPreview(
    parsed.fileName,
    parsed.rows,
    existing ?? [],
    parsed.invalidRows,
    parsed.duplicateEmployeeCodes,
    parsed.ignoredRows,
    deactivateMissing
  );
  if (preview.invalidRows.length > 0 || preview.duplicateEmployeeCodes.length > 0) {
    return { error: "Fix invalid or duplicate rows before importing.", preview };
  }

  const { data: batch, error: batchError } = await supabase
    .from("employee_import_batches")
    .insert({
      file_name: parsed.fileName,
      total_rows: preview.totalRows,
      new_count: preview.newEmployees.length,
      updated_count: preview.updatedEmployees.length,
      deactivated_count: preview.deactivatedEmployees.length,
      skipped_count: preview.parsedRows - preview.newEmployees.length - preview.updatedEmployees.length,
      errors: [],
      created_by: auth.userId,
      applied_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (batchError) return { error: batchError.message };

  const now = new Date().toISOString();
  const upserts = [...preview.newEmployees, ...preview.updatedEmployees.map((item) => item.after)].map((employee) => ({
    ...employee,
    active: true,
    inactive_reason: null,
    inactive_at: null,
    last_import_batch_id: batch.id,
    updated_at: now,
  }));

  if (upserts.length) {
    const { error: upsertError } = await supabase
      .from("employees")
      .upsert(upserts, { onConflict: "employee_id" });

    if (upsertError) return { error: upsertError.message, preview };
  }

  if (deactivateMissing && preview.deactivatedEmployees.length) {
    const ids = preview.deactivatedEmployees.map((employee) => employee.employee_id);
    const { error: deactivateError } = await supabase
      .from("employees")
      .update({
        active: false,
        inactive_reason: "missing_from_basis_import",
        inactive_at: now,
        last_import_batch_id: batch.id,
        updated_at: now,
      })
      .in("employee_id", ids);

    if (deactivateError) return { error: deactivateError.message, preview };
  }

  revalidatePath("/admin/employees");
  revalidatePath("/admin/employees/import");
  revalidatePath("/employees");

  return {
    success: true,
    batchId: batch.id,
    preview,
  };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Unauthorized. HR/Admin access required." };
  }

  return { userId: user.id };
}

async function parseEmployeeFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Upload an Excel file first." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { error: "No worksheet found in the uploaded file." };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const parsedRows: ParsedEmployee[] = [];
  const invalidRows: { row: number; reason: string }[] = [];
  const ignoredRows: { row: number; reason: string }[] = [];
  const seen = new Set<string>();
  const duplicateEmployeeCodes = new Set<string>();
  const ignoreTemporaryCodes = formData.get("ignore_temporary_codes") === "true";

  rows.forEach((row, index) => {
    const employee = mapBasisRow(row);
    const excelRow = index + 2;

    if (employee.employee_id.toLowerCase() === "temporary") {
      const issue = { row: excelRow, reason: "Employee Code is Temporary" };
      if (ignoreTemporaryCodes) {
        ignoredRows.push(issue);
      } else {
        invalidRows.push(issue);
      }
      return;
    }

    if (!employee.employee_id) {
      invalidRows.push({ row: excelRow, reason: "Missing Employee Code" });
      return;
    }
    if (!employee.full_name) {
      invalidRows.push({ row: excelRow, reason: "Missing Employee Name as in Passport" });
      return;
    }
    if (!employee.job_title) {
      invalidRows.push({ row: excelRow, reason: "Missing Designation" });
      return;
    }

    if (seen.has(employee.employee_id)) {
      duplicateEmployeeCodes.add(employee.employee_id);
      return;
    }

    seen.add(employee.employee_id);
    parsedRows.push(employee);
  });

  return {
    fileName: file.name,
    rows: parsedRows,
    invalidRows,
    ignoredRows,
    duplicateEmployeeCodes: [...duplicateEmployeeCodes],
  };
}

function mapBasisRow(row: Record<string, unknown>): ParsedEmployee {
  return {
    employee_id: text(row["Employee Code"]),
    full_name: text(row["Employee Name as in Passport"]),
    job_title: text(row["Designation"]),
    country_code: mapCountry(text(row["Country"])),
    manager_name: nullableText(row["Reporting Manager"]),
    grade: nullableText(row["Grade"]),
    grade_band: nullableText(row["Band"] ?? row["Grade."]),
    grade_type: nullableText(row["Type of Grade"]),
    joining_date: toIsoDate(row["Joining Date"]),
    manager_position: nullableText(row["Manager Position"]),
    active: true,
  };
}

function buildPreview(
  fileName: string,
  imported: ParsedEmployee[],
  existing: EmployeeRow[],
  invalidRows: { row: number; reason: string }[],
  duplicateEmployeeCodes: string[],
  ignoredRows: { row: number; reason: string }[],
  deactivateMissing: boolean
): EmployeeImportPreview {
  const existingById = new Map(existing.map((employee) => [employee.employee_id, employee]));
  const importedIds = new Set(imported.map((employee) => employee.employee_id));
  const newEmployees: ParsedEmployee[] = [];
  const updatedEmployees: { before: EmployeeRow; after: ParsedEmployee; changes: string[] }[] = [];

  for (const employee of imported) {
    const current = existingById.get(employee.employee_id);
    if (!current) {
      newEmployees.push(employee);
      continue;
    }

    const changes = changedFields(current, employee);
    if (changes.length > 0 || current.active === false) {
      updatedEmployees.push({ before: current, after: employee, changes: current.active === false ? [...changes, "active"] : changes });
    }
  }

  const deactivatedEmployees = deactivateMissing
    ? existing.filter((employee) => employee.active !== false && !importedIds.has(employee.employee_id))
    : [];

  return {
    fileName,
    totalRows: imported.length + invalidRows.length + duplicateEmployeeCodes.length,
    parsedRows: imported.length,
    newEmployees,
    updatedEmployees,
    deactivatedEmployees,
    duplicateEmployeeCodes,
    invalidRows,
    ignoredRows,
    deactivateMissing,
  };
}

function changedFields(current: EmployeeRow, next: ParsedEmployee) {
  const fields: (keyof ParsedEmployee)[] = [
    "full_name",
    "job_title",
    "country_code",
    "manager_name",
    "grade",
    "grade_band",
    "grade_type",
    "joining_date",
    "manager_position",
  ];

  return fields.filter((field) => (current[field] ?? null) !== (next[field] ?? null));
}

function text(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nullableText(value: unknown) {
  const valueText = text(value);
  if (["n/a", "na", "none", "-"].includes(valueText.toLowerCase())) return null;
  return valueText ? valueText : null;
}

function mapCountry(country: string) {
  const normalized = country.toLowerCase();
  const map: Record<string, string> = {
    uae: "AE",
    "united arab emirates": "AE",
    oman: "OM",
    ksa: "SA",
    "saudi arabia": "SA",
    qatar: "QA",
    kuwait: "KW",
    bahrain: "BH",
  };
  return map[normalized] ?? (country ? country.toUpperCase() : null);
}

function toIsoDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
