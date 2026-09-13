/**
 * Import Dhofar Global role profiles, competencies, and KPI templates.
 *
 * Usage:
 *   node scripts/import-role-docs.mjs
 *   node scripts/import-role-docs.mjs --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Values are loaded from .env.local when they are not already in the shell.
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = process.cwd();
const docsDir = resolve(root, "docs");
const workbookPath = resolve(docsDir, "DG Role Competencies and KPIs Final.xlsx");
const jdPath = resolve(docsDir, "Dhofar Global Job Descriptions.docx");
const dryRun = process.argv.includes("--dry-run") || process.env.npm_config_dry_run === "true";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!url || !serviceKey)) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!existsSync(workbookPath)) {
  console.error(`Workbook not found: ${workbookPath}`);
  process.exit(1);
}

const admin = dryRun ? null : createClient(url, serviceKey, { auth: { persistSession: false } });

function loadEnvLocal() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

function clean(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function norm(value) {
  return clean(value).toLowerCase();
}

function sheetKey(value) {
  return norm(value).replace(/[^a-z0-9]/g, "");
}

function rowsFromSheet(workbook, sheetName) {
  const resolvedName =
    workbook.SheetNames.find((name) => name === sheetName) ??
    workbook.SheetNames.find((name) => sheetKey(name).startsWith(sheetKey(sheetName).slice(0, 24))) ??
    workbook.SheetNames.find((name) => sheetKey(sheetName).startsWith(sheetKey(name).slice(0, 24))) ??
    workbook.SheetNames.find((name) => norm(name).startsWith(norm(sheetName).slice(0, 24))) ??
    workbook.SheetNames.find((name) => norm(sheetName).startsWith(norm(name).slice(0, 24)));
  const sheet = resolvedName ? workbook.Sheets[resolvedName] : null;
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
}

function findSection(rows, label) {
  return rows.findIndex((row) => norm(row[0]) === norm(label));
}

function readMeta(rows, label) {
  const row = rows.find((r) => norm(r[0]) === norm(label));
  if (!row) return null;
  return clean(row[2] || row[1]) || null;
}

function readRolePurpose(rows) {
  const idx = findSection(rows, "ROLE PURPOSE");
  if (idx === -1) return null;
  for (let i = idx + 1; i < rows.length; i += 1) {
    const text = clean(rows[i][0]);
    if (text) return text;
  }
  return null;
}

function readCompetencies(rows) {
  const start = findSection(rows, "CORE COMPETENCIES");
  const end = findSection(rows, "KEY PERFORMANCE INDICATORS");
  if (start === -1 || end === -1) return [];

  const items = [];
  for (let i = start + 2; i < end; i += 1) {
    const name = clean(rows[i][0]);
    const description = clean(rows[i][2]);
    const indicators = clean(rows[i][4]);
    if (!name || norm(name) === "competency") continue;
    items.push({
      name,
      category: "Role",
      description: description || null,
      behavioral_indicators: indicators || null,
      sort_order: items.length + 1,
    });
  }
  return items;
}

function readKpis(rows, roleTitle, department) {
  const start = findSection(rows, "KEY PERFORMANCE INDICATORS");
  if (start === -1) return [];

  const items = [];
  for (let i = start + 2; i < rows.length; i += 1) {
    const title = clean(rows[i][0]);
    if (!title || norm(title) === "kpi") continue;
    items.push({
      role_title: roleTitle,
      department,
      title,
      measure: clean(rows[i][1]) || null,
      target: clean(rows[i][3]) || null,
      review_frequency: clean(rows[i][4]) || null,
      default_weight: 0,
      sort_order: items.length + 1,
      active: true,
    });
  }
  return items;
}

function extractDocxText(path) {
  if (!existsSync(path)) return "";
  const temp = mkdtempSync(join(tmpdir(), "role-docs-"));
  try {
    const destination = join(temp, "docx");
    if (process.platform === "win32") {
      const zipPath = join(temp, "source.zip");
      copyFileSync(path, zipPath);
      execFileSync("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replaceAll("'", "''")}' -DestinationPath '${destination.replaceAll("'", "''")}' -Force`,
      ]);
    } else {
      execFileSync("unzip", ["-q", path, "-d", destination]);
    }
    const xmlPath = join(destination, "word", "document.xml");
    if (!existsSync(xmlPath)) return "";
    return readFileSync(xmlPath, "utf8")
      .replace(/<w:tab\/>/g, " ")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
  } catch (error) {
    console.warn(`Could not extract ${basename(path)}: ${error.message}`);
    return "";
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function jdSegment(docText, roleTitle, allTitles) {
  if (!docText) return null;
  const upperText = docText.toUpperCase();
  const roleIdx = upperText.indexOf(roleTitle.toUpperCase());
  if (roleIdx === -1) return null;

  let nextIdx = upperText.length;
  for (const title of allTitles) {
    if (title === roleTitle) continue;
    const idx = upperText.indexOf(title.toUpperCase(), roleIdx + roleTitle.length);
    if (idx !== -1 && idx < nextIdx) nextIdx = idx;
  }
  return docText.slice(roleIdx, nextIdx).trim();
}

function extractBetween(text, start, endLabels) {
  const upper = text.toUpperCase();
  const startIdx = upper.indexOf(start.toUpperCase());
  if (startIdx === -1) return null;
  let contentStart = startIdx + start.length;
  let endIdx = text.length;
  for (const label of endLabels) {
    const idx = upper.indexOf(label.toUpperCase(), contentStart);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  return text.slice(contentStart, endIdx).replace(/\s+/g, " ").trim() || null;
}

function enrichFromJd(profile, segment) {
  if (!segment) return profile;
  const responsibilities = extractBetween(segment, "Key Responsibilities", [
    "Core Competencies",
    "Experience and Qualifications",
    "Educational Background",
    "Key Performance Indicators",
  ]);
  const qualifications = extractBetween(segment, "Experience and Qualifications Required", [
    "Educational Background",
    "Key Performance Indicators",
  ]);
  const authority = extractBetween(segment, "Authority and Decision Rights", [
    "Core Competencies",
    "Experience and Qualifications",
    "Key Performance Indicators",
  ]);

  return {
    ...profile,
    responsibilities: responsibilities ? splitSentences(responsibilities) : profile.responsibilities,
    authority: authority ? splitSentences(authority) : profile.authority,
    qualifications: {
      ...(profile.qualifications ?? {}),
      experience: qualifications || null,
    },
  };
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(clean)
    .filter(Boolean)
    .slice(0, 24);
}

async function upsertSource(fileName, sourceType, metadata = {}) {
  const { data, error } = await admin
    .from("document_sources")
    .upsert(
      {
        file_name: fileName,
        source_type: sourceType,
        source_version: "2026",
        metadata,
        imported_at: new Date().toISOString(),
      },
      { onConflict: "file_name" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const indexRows = rowsFromSheet(workbook, "Index");
  const roleRefs = indexRows
    .slice(3)
    .map((row) => ({
      role: clean(row[1]),
      department: clean(row[2]),
      sheet: clean(row[3]),
    }))
    .filter((row) => row.role && row.sheet && norm(row.role) !== "role");

  const jdText = extractDocxText(jdPath);
  const allTitles = roleRefs.map((r) => r.role);
  const workbookSourceId = dryRun
    ? "dry-run"
    : await upsertSource(basename(workbookPath), "role_competencies_kpis", { sheet_count: workbook.SheetNames.length });
  const jdSourceId = dryRun && existsSync(jdPath)
    ? "dry-run"
    : existsSync(jdPath)
      ? await upsertSource(basename(jdPath), "job_descriptions")
      : null;

  const profiles = [];
  const competencies = [];
  const roleCompetencyRefs = [];
  const kpis = [];

  for (const ref of roleRefs) {
    const rows = rowsFromSheet(workbook, ref.sheet);
    const title = clean(rows[0]?.[0]) || ref.role;
    const department = readMeta(rows, "Department") || ref.department || "General";
    const reportsTo = readMeta(rows, "Reports To");
    const rolePurpose = readRolePurpose(rows);
    const segment = jdSegment(jdText, ref.role, allTitles);

    profiles.push(enrichFromJd({
      title: ref.role,
      department,
      reports_to: reportsTo,
      role_purpose: rolePurpose,
      responsibilities: [],
      authority: [],
      qualifications: {},
      geographic_scope: readMeta(rows, "Geographic Scope"),
      source_id: jdSourceId ?? workbookSourceId,
      active: true,
    }, segment));

    for (const competency of readCompetencies(rows)) {
      competencies.push({
        ...competency,
        source_id: workbookSourceId,
      });
      roleCompetencyRefs.push({
        role_title: ref.role,
        name: competency.name,
        category: competency.category,
        required_level: "Competent",
        weight: 0,
        applicable: true,
        sort_order: competency.sort_order,
      });
    }

    kpis.push(
      ...readKpis(rows, ref.role, department).map((kpi) => ({
        ...kpi,
        source_id: workbookSourceId,
      }))
    );

    if (title && norm(title) !== norm(ref.role)) {
      console.warn(`Sheet title differs from index role: "${title}" vs "${ref.role}"`);
    }
  }

  console.log(`Parsed ${profiles.length} job profiles, ${competencies.length} role competencies, ${kpis.length} KPI templates.`);

  if (dryRun) {
    console.log(JSON.stringify({ profiles: profiles.slice(0, 2), competencies: competencies.slice(0, 3), kpis: kpis.slice(0, 3) }, null, 2));
    return;
  }

  await upsertClusters(profiles);
  await upsertRoles(profiles);
  await upsertJobProfiles(profiles);
  const competencyIds = await upsertCompetencies(competencies);
  await upsertRoleCompetencies(roleCompetencyRefs, competencyIds);
  await upsertKpis(kpis);
  console.log("Role document import complete.");
}

async function upsertClusters(profiles) {
  const clusters = [...new Set(profiles.map((p) => p.department).filter(Boolean))].map((name) => ({ name }));
  if (!clusters.length) return;
  const { error } = await admin.from("clusters").upsert(clusters, { onConflict: "name" });
  if (error) throw error;
}

async function upsertRoles(profiles) {
  const roles = profiles.map((profile) => ({
    title: profile.title,
    cluster: profile.department,
    required_level: "Competent",
    kpi_linked: "Imported role KPI templates",
    notes: profile.role_purpose,
    active: true,
  }));
  const { error } = await admin.from("roles").upsert(roles, { onConflict: "title" });
  if (error) throw error;
}

async function upsertJobProfiles(profiles) {
  const { error } = await admin.from("job_profiles").upsert(profiles, { onConflict: "title" });
  if (error) throw error;
}

async function upsertCompetencies(items) {
  const deduped = new Map();
  for (const item of items) {
    deduped.set(`${item.name}::${item.category}`, {
      name: item.name,
      category: item.category,
      description: item.description,
      behavioral_indicators: item.behavioral_indicators,
      source_id: item.source_id,
    });
  }
  const payload = [...deduped.values()];
  const { data, error } = await admin
    .from("competencies")
    .upsert(payload, { onConflict: "name,category" })
    .select("id,name,category");
  if (error) throw error;

  return new Map(data.map((row) => [`${row.name}::${row.category}`, row.id]));
}

async function upsertRoleCompetencies(items, competencyIds) {
  const payload = items
    .map((item) => ({
      role_title: item.role_title,
      competency_id: competencyIds.get(`${item.name}::${item.category}`),
      category: item.category,
      required_level: item.required_level,
      weight: item.weight,
      applicable: item.applicable,
      sort_order: item.sort_order,
    }))
    .filter((item) => item.competency_id);
  const { error } = await admin.from("role_competencies").upsert(payload, { onConflict: "role_title,competency_id" });
  if (error) throw error;
}

async function upsertKpis(kpis) {
  const { error } = await admin.from("role_kpi_templates").upsert(kpis, { onConflict: "role_title,title" });
  if (error) throw error;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

