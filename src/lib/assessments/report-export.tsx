import "server-only";

import { Document, pdf } from "@react-pdf/renderer";
import { AssessmentReportPdf } from "@/components/assessments/assessment-report-pdf";
import { PlacementReportPdf } from "@/components/assessments/placement-report-pdf";
import type { PlacementReport } from "./placement";
import type { EmployeeReport } from "./results";
import type { Warning } from "./scoring";

function dedupeWarnings(warnings: Warning[]) {
  const byCode = new Map<string, Warning>();
  for (const warning of warnings) {
    const existing = byCode.get(warning.code);
    if (existing) existing.items = [...new Set([...existing.items, ...warning.items])];
    else byCode.set(warning.code, { ...warning, items: [...warning.items] });
  }
  return [...byCode.values()];
}

function longDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

async function documentBytes(document: React.ReactElement<React.ComponentProps<typeof Document>>) {
  const blob = await pdf(document).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

export async function renderEmployeeReportPdf(report: EmployeeReport) {
  const primary = report.skill ?? report.behaviour;
  const warnings = dedupeWarnings([...(report.skill?.score.warnings ?? []), ...(report.behaviour?.score.warnings ?? [])]);
  return documentBytes(
    <AssessmentReportPdf
      report={report}
      warnings={warnings}
      roleFamily={report.skill?.template.role_family ?? report.employee.job_title}
      date={longDate(primary?.assignment.submitted_at ?? primary?.assignment.created_at ?? null)}
      wave={primary?.assignment.wave ?? null}
      provisional={(report.skill?.score.provisional ?? false) || (report.behaviour?.score.provisional ?? false)}
    />,
  );
}

export async function renderPlacementReportPdf(report: PlacementReport) {
  return documentBytes(<PlacementReportPdf report={report} />);
}
