import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { AdminAnswer, AdminResponseSection } from "@/lib/assessments/admin-responses";

const RATER_LABEL = {
  self: "Employee",
  line_manager: "Line manager",
  cross_dept: "Cross-departmental",
  peer: "Peer",
} as const;

const RATING_LABEL: Record<number, string> = {
  1: "Not yet demonstrated",
  2: "Developing",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Role model",
};

const C = {
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  line: "#dbe3ea",
  panel: "#f8fafc",
  teal: "#0f766e",
  tealBg: "#f0fdfa",
  amber: "#b45309",
  amberBg: "#fffbeb",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: { padding: 28, paddingBottom: 42, fontFamily: "Helvetica", fontSize: 8, color: C.ink, backgroundColor: C.white },
  header: { border: `1 solid ${C.teal}`, borderRadius: 6, backgroundColor: C.tealBg, padding: 12, marginBottom: 12 },
  brand: { color: C.teal, fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { marginTop: 5, fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { marginTop: 3, fontSize: 8, color: C.body },
  warning: { border: `1 solid #f59e0b`, borderRadius: 5, backgroundColor: C.amberBg, color: C.amber, padding: 7, marginBottom: 12, fontSize: 7 },
  section: { marginBottom: 14 },
  sectionHeader: { borderBottom: `1 solid ${C.line}`, paddingBottom: 6, marginBottom: 7 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  meta: { marginTop: 2, fontSize: 7, color: C.muted },
  raterRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 },
  rater: { border: `0.5 solid ${C.line}`, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 2, fontSize: 6.5 },
  question: { border: `1 solid ${C.line}`, borderRadius: 5, marginBottom: 7, padding: 8, backgroundColor: C.white },
  questionTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  indicator: { marginTop: 2, fontSize: 7, color: C.muted, lineHeight: 1.3 },
  scenario: { marginTop: 5, padding: 5, borderRadius: 3, backgroundColor: C.panel, fontSize: 7, lineHeight: 1.3 },
  answers: { marginTop: 6, flexDirection: "row", gap: 6 },
  answerColumn: { flex: 1 },
  columnTitle: { marginBottom: 3, fontSize: 6.5, color: C.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  answer: { border: `0.5 solid ${C.line}`, borderRadius: 3, padding: 5, marginBottom: 3, backgroundColor: C.panel },
  answerName: { fontSize: 7, fontFamily: "Helvetica-Bold" },
  answerMeta: { marginTop: 1, fontSize: 6, color: C.muted },
  answerValue: { marginTop: 3, fontSize: 7, lineHeight: 1.3 },
  evidence: { marginTop: 3, borderLeft: `1.5 solid ${C.muted}`, paddingLeft: 4, fontSize: 6.5, color: C.body, fontStyle: "italic" },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", borderTop: `0.5 solid ${C.line}`, paddingTop: 5, fontSize: 6, color: C.muted },
});

export function AdminAssessmentResponsesPdf({ sections }: { sections: AdminResponseSection[] }) {
  const employeeName = sections[0]?.employeeName ?? "Employee";
  return (
    <Document title={`Assessment responses - ${employeeName}`} author="Dhofar Global Performance Hub">
      <Page size="A4" style={s.page} wrap>
        <View style={s.header}>
          <Text style={s.brand}>Dhofar Global</Text>
          <Text style={s.title}>Named assessment responses</Text>
          <Text style={s.subtitle}>{employeeName} · Administrative review record</Text>
        </View>
        <Text style={s.warning}>CONFIDENTIAL — HR ADMINISTRATORS ONLY. Named individual responses must not be shared with the assessed employee.</Text>

        {sections.map((section) => {
          const raters = section.questions[0]?.answers ?? [];
          return (
            <View key={section.assignmentId} style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>{section.templateName}</Text>
                <Text style={s.meta}>{section.employeeName}{section.wave ? ` · ${section.wave}` : ""} · {section.questions.length} questions</Text>
                <View style={s.raterRow}>
                  {raters.map((rater) => (
                    <Text key={rater.raterId} style={s.rater}>
                      {rater.raterName} · {RATER_LABEL[rater.raterType]} · {rater.status === "submitted" ? "Submitted" : "Pending"}
                    </Text>
                  ))}
                </View>
              </View>

              {section.questions.map((question) => {
                const employeeAnswer = question.answers.find((answer) => answer.raterType === "self") ?? null;
                const otherAnswers = question.answers.filter((answer) => answer.raterType !== "self");
                return (
                  <View key={question.id} style={s.question} wrap={false}>
                    <Text style={s.questionTitle}>{question.sortOrder}. {question.name}{question.groupName ? ` · ${question.groupName}` : ""}</Text>
                    <Text style={s.indicator}>{question.indicator}</Text>
                    {question.scenario ? <Text style={s.scenario}>Scenario: {question.scenario}</Text> : null}
                    <View style={s.answers}>
                      <View style={s.answerColumn}>
                        <Text style={s.columnTitle}>Employee answer</Text>
                        {employeeAnswer ? <PdfAnswer answer={employeeAnswer} /> : <Text style={s.answerValue}>No employee response assigned.</Text>}
                      </View>
                      <View style={s.answerColumn}>
                        <Text style={s.columnTitle}>Peer and manager answers</Text>
                        {otherAnswers.length
                          ? otherAnswers.map((answer) => <PdfAnswer key={answer.raterId} answer={answer} />)
                          : <Text style={s.answerValue}>No peer or manager raters assigned.</Text>}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={s.footer} fixed>
          <Text>Dhofar Global Performance Hub · Confidential employee record</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function PdfAnswer({ answer }: { answer: AdminAnswer }) {
  return (
    <View style={s.answer}>
      <Text style={s.answerName}>{answer.raterName}</Text>
      <Text style={s.answerMeta}>{RATER_LABEL[answer.raterType]}</Text>
      <Text style={s.answerValue}>{formatAnswer(answer)}</Text>
      {answer.evidence ? <Text style={s.evidence}>Evidence: {answer.evidence}</Text> : null}
    </View>
  );
}

function formatAnswer(answer: AdminAnswer) {
  if (answer.status !== "submitted") return "Pending response";
  if (answer.notObserved) return "Not observed";
  const values: string[] = [];
  if (answer.rating != null) values.push(`${answer.rating}/5 — ${RATING_LABEL[answer.rating] ?? "Rating"}`);
  if (answer.scenarioAnswer) values.push(`Scenario ${answer.scenarioAnswer}${answer.scenarioAnswerText ? ` — ${answer.scenarioAnswerText}` : ""}`);
  return values.length ? values.join("\n") : "No answer recorded";
}
