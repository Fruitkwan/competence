import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PlacementReport } from "@/lib/assessments/placement";

const C = {
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  line: "#e2e8f0",
  panel: "#f8fafc",
  teal: "#0f766e",
  tealBg: "#f0fdfa",
  tealBorder: "#99f6e4",
  amber: "#d97706",
  red: "#dc2626",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: { padding: 28, paddingBottom: 42, fontFamily: "Helvetica", fontSize: 8, color: C.ink, backgroundColor: C.white },
  box: { border: `1 solid ${C.line}`, borderRadius: 6, padding: 10, backgroundColor: C.white },
  title: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  label: { fontSize: 6.5, color: C.muted, textTransform: "uppercase" },
  row: { flexDirection: "row" },
});

function displayDate(value: string | null) {
  if (!value) return "Not submitted";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function signature(report: PlacementReport, slot: "employee" | "manager" | "hr", label: string) {
  const value = report.signatures[slot];
  return (
    <View style={[styles.box, { flex: 1, minHeight: 44 }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={{ marginTop: 5, fontFamily: value ? "Helvetica-Bold" : "Helvetica", color: value ? C.ink : C.muted }}>
        {value?.name ?? "Not signed"}
      </Text>
      {value && <Text style={{ marginTop: 2, fontSize: 6.5, color: C.muted }}>{displayDate(value.at)}</Text>}
    </View>
  );
}

export function PlacementReportPdf({ report }: { report: PlacementReport }) {
  const generated = new Date().toLocaleDateString("en-GB");
  const footer = (
    <View fixed style={{ position: "absolute", bottom: 14, left: 28, right: 28, borderTop: `0.6 solid ${C.line}`, paddingTop: 4, flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 6, color: C.muted }}>Dhofar Global Performance Hub · Confidential employee record</Text>
      <Text style={{ fontSize: 6, color: C.muted }} render={({ pageNumber, totalPages }) => `Generated ${generated} · Page ${pageNumber} of ${totalPages}`} />
    </View>
  );

  return (
    <Document title={`Skill assessment report — ${report.employee.full_name}`} author="Dhofar Global Performance Hub">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={[styles.box, { backgroundColor: C.tealBg, borderColor: C.tealBorder, marginBottom: 10 }]}>
          <View style={[styles.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
            <View>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: C.teal, textTransform: "uppercase" }}>Dhofar Global</Text>
              <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 2 }}>Skill assessment report</Text>
              <Text style={{ fontSize: 8, color: C.body, marginTop: 3 }}>{report.template.name}</Text>
            </View>
            <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.teal, border: `0.8 solid ${C.tealBorder}`, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, textTransform: "uppercase" }}>Confidential</Text>
          </View>
          <View style={[styles.row, { gap: 26, borderTop: `0.6 solid ${C.tealBorder}`, marginTop: 9, paddingTop: 7 }]}>
            {[
              ["Employee", report.employee.full_name],
              ["Employee ID", report.employee.employee_id],
              ["Job title", report.employee.job_title],
              ["Wave", report.assignment.wave ?? "Not specified"],
              ["Submitted", displayDate(report.assignment.submitted_at)],
            ].map(([label, value]) => (
              <View key={label} style={{ flex: 1 }}><Text style={styles.label}>{label}</Text><Text style={{ marginTop: 2 }}>{value}</Text></View>
            ))}
          </View>
        </View>

        <View style={[styles.box, { borderColor: report.outcome.pendingRecord ? "#fcd34d" : C.line, backgroundColor: report.outcome.pendingRecord ? "#fffbeb" : C.white, marginBottom: 10 }]}>
          <Text style={styles.label}>Placement outcome</Text>
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 3 }}>{report.outcome.label}</Text>
          <Text style={{ color: C.body, marginTop: 4, lineHeight: 1.35 }}>{report.outcome.reason}</Text>
          {report.outcome.pendingRecord && <Text style={{ color: C.amber, fontFamily: "Helvetica-Bold", marginTop: 4 }}>Awaiting verified commercial record</Text>}
        </View>

        <View style={[styles.row, { gap: 8, marginBottom: 10 }]}>
          {report.parts.map((part) => (
            <View key={part.part} style={[styles.box, { flex: 1, borderColor: part.zeroItems.length ? "#fecaca" : C.line }]}>
              <Text style={styles.label}>Part {part.part}</Text>
              <Text style={[styles.title, { marginTop: 3 }]}>{part.name}</Text>
              <Text style={{ fontSize: 21, fontFamily: "Helvetica-Bold" }}>{part.points}<Text style={{ fontSize: 9, color: C.muted }}> / {part.outOf}</Text></Text>
              <Text style={{ marginTop: 4, color: C.muted }}>{part.answered} of {part.answers.length} answered</Text>
              {part.zeroItems.length > 0 && <Text style={{ marginTop: 4, color: C.red, fontSize: 6.5 }}>0-point answer: {part.zeroItems.join("; ")}</Text>}
            </View>
          ))}
        </View>

        <View style={[styles.row, { gap: 8, marginBottom: 10 }]}>
          <View style={[styles.box, { flex: 0.8 }]}>
            <Text style={styles.title}>Verified performance record</Text>
            {[
              ["Commercial", report.record.commercial],
              ["Account", report.record.account],
              ["Leadership", report.record.leadership],
            ].map(([label, value]) => (
              <View key={label as string} style={[styles.row, { justifyContent: "space-between", borderTop: `0.5 solid ${C.line}`, paddingVertical: 5 }]}>
                <Text>{label}</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{value ?? "Not verified"}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.box, { flex: 2 }]}>
            <Text style={styles.title}>Rater evidence</Text>
            <Text style={{ fontSize: 6.5, color: C.muted, marginBottom: 4 }}>Averages only; individual rater scores and names are not disclosed.</Text>
            <View style={[styles.row, { backgroundColor: C.panel, padding: 4 }]}>
              <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>Question</Text><Text style={{ width: 75, textAlign: "right", fontFamily: "Helvetica-Bold" }}>Manager</Text><Text style={{ width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" }}>Other raters</Text>
            </View>
            {report.raterEvidence.map((item) => (
              <View key={item.itemId} style={[styles.row, { borderBottom: `0.5 solid ${C.line}`, paddingVertical: 3, paddingHorizontal: 4 }]}>
                <Text style={{ flex: 1 }}>{item.name}</Text>
                <Text style={{ width: 75, textAlign: "right" }}>{item.managerAvg?.toFixed(1) ?? "—"}</Text>
                <Text style={{ width: 90, textAlign: "right", color: item.divergence ? C.amber : C.ink }}>{item.othersAvg?.toFixed(1) ?? "—"} ({item.othersCount}){item.divergence ? " · gap" : ""}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.row, { gap: 8 }]}>
          {signature(report, "employee", "Employee acknowledgement")}
          {signature(report, "manager", "Line manager acknowledgement")}
          {signature(report, "hr", "HR acknowledgement")}
        </View>
        {footer}
      </Page>
    </Document>
  );
}
