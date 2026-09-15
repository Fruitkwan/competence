import { Document, Page, View, Text, Svg, Circle, Path, Polygon, Line, StyleSheet } from "@react-pdf/renderer";
import type { AssignmentResult, EmployeeReport, ReportSignature } from "@/lib/assessments/results";
import type { Warning } from "@/lib/assessments/scoring";
import { ASSESSMENT_PURPOSE } from "@/lib/assessments/copy";
import { BAND_COLOR, GROUP_COLOR, STANDARD, bandOf, indexText, initials, selfAwarenessText, shortName } from "./assessment-report";

const C = {
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  panel: "#f8fafc",
  teal: "#0f766e",
  tealBg: "#f0fdfa",
  tealBorder: "#99f6e4",
  amber: "#d97706",
  green: "#059669",
  red: "#dc2626",
  indigo: "#4f46e5",
  pink: "#db2777",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: { padding: 24, paddingBottom: 40, fontFamily: "Helvetica", fontSize: 8, color: C.ink, backgroundColor: C.white },
  box: { border: `1 solid ${C.line}`, borderRadius: 6, padding: 10, backgroundColor: C.white },
  boxTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  boxSub: { fontSize: 7.5, color: C.muted, marginTop: -2, marginBottom: 4 },
  row: { flexDirection: "row" },
  muted: { color: C.muted },
  tiny: { fontSize: 6.5, color: C.muted },
  small: { fontSize: 7.5 },
  badge: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, fontSize: 6.5, fontFamily: "Helvetica-Bold" },
});

/* ---------------- svg helpers ---------------- */

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
const pt = (p: [number, number]) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;

function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  return `M ${pt(polar(cx, cy, r, fromDeg))} A ${r} ${r} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${pt(polar(cx, cy, r, toDeg))}`;
}

function segmentPath(cx: number, cy: number, ro: number, ri: number, fromDeg: number, toDeg: number) {
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${pt(polar(cx, cy, ro, fromDeg))} A ${ro} ${ro} 0 ${large} 1 ${pt(polar(cx, cy, ro, toDeg))} L ${pt(polar(cx, cy, ri, toDeg))} A ${ri} ${ri} 0 ${large} 0 ${pt(polar(cx, cy, ri, fromDeg))} Z`;
}

/* ---------------- charts ---------------- */

function Ring({ value, color, size = 40, stroke = 6, fontSize = 9 }: { value: number | null; color: string; size?: number; stroke?: number; fontSize?: number }) {
  const c = size / 2;
  const r = c - stroke / 2;
  const pct = Math.max(0, Math.min(1, (value ?? 0) / 100));
  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={c} cy={c} r={r} stroke={C.line} strokeWidth={stroke} fill="none" />
        {pct >= 0.999 ? (
          <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={stroke} fill="none" />
        ) : pct > 0 ? (
          <Path d={arcPath(c, c, r, 0, pct * 360)} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        ) : null}
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize, fontFamily: "Helvetica-Bold", color }}>{value == null ? "--" : `${Math.round(value)}%`}</Text>
      </View>
    </View>
  );
}

function Radar({ items, color, size = 150 }: { items: { name: string; value: number }[]; color: string; size?: number }) {
  const c = size / 2;
  const R = size * 0.29;
  const n = Math.max(items.length, 3);
  const at = (i: number, r: number) => polar(c, c, r, (360 / n) * i);
  const ring = (f: number) => Array.from({ length: n }, (_, i) => at(i, R * f).join(",")).join(" ");
  const candidate = items.map((it, i) => at(i, (R * Math.max(0, Math.min(100, it.value))) / 100).join(",")).join(" ");
  const standard = Array.from({ length: n }, (_, i) => at(i, (R * STANDARD) / 100).join(",")).join(" ");
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <Polygon key={f} points={ring(f)} stroke={C.line} strokeWidth={0.6} fill="none" />
      ))}
      {items.map((it, i) => {
        const [x, y] = at(i, R);
        return <Line key={i} x1={c} y1={c} x2={x} y2={y} stroke={C.line} strokeWidth={0.6} />;
      })}
      <Polygon points={standard} stroke={C.faint} strokeWidth={0.8} strokeDasharray="3 2" fill={C.faint} fillOpacity={0.08} />
      {items.length > 0 && <Polygon points={candidate} stroke={color} strokeWidth={1.2} fill={color} fillOpacity={0.25} />}
      {items.map((it, i) => {
        const [x, y] = at(i, R * 1.14);
        return (
          <Text key={i} x={x} y={y + 2} textAnchor="middle" style={{ fontSize: 5, fill: C.muted }}>
            {shortName(it.name)}
          </Text>
        );
      })}
    </Svg>
  );
}

function GroupDonut({ result, initials: init }: { result: AssignmentResult; initials: string }) {
  const counters: Record<string, number> = {};
  const data = result.score.items.map((i) => {
    const g = i.group_name ?? "Behaviour";
    const palette = GROUP_COLOR[g] ?? GROUP_COLOR.Behaviour;
    const idx = counters[g] ?? 0;
    counters[g] = idx + 1;
    return { name: i.name, value: i.score ?? 0, color: palette[idx % palette.length], group: g };
  });
  const size = 100;
  const c = size / 2;
  const ro = 44;
  const ri = 27;
  const step = 360 / Math.max(data.length, 1);
  return (
    <View style={[s.row, { alignItems: "center", gap: 10 }]}>
      <View style={{ width: size, height: size, position: "relative" }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {data.map((d, i) => (
            <Path key={d.name} d={segmentPath(c, c, ro, ri, i * step + 0.8, (i + 1) * step - 0.8)} fill={d.color} fillOpacity={0.35 + 0.65 * (d.value / 100)} />
          ))}
          <Circle cx={c} cy={c} r={ri - 4} fill={C.white} stroke={C.line} strokeWidth={0.6} />
        </Svg>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>{init}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {data.map((d) => (
          <View key={d.name} style={[s.row, { alignItems: "center", gap: 4, marginBottom: 1 }]}>
            <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: d.color }} />
            <Text style={[s.small, { flex: 1 }]}>{d.name}</Text>
            <Text style={[s.small, { fontFamily: "Helvetica-Bold" }]}>{d.value}%</Text>
          </View>
        ))}
        <View style={[s.row, { flexWrap: "wrap", gap: 4, borderTop: `0.5 solid ${C.line}`, marginTop: 4, paddingTop: 4 }]}>
          {Object.entries(result.score.groups).map(([g, v]) => (
            <Text key={g} style={{ fontSize: 6.5, backgroundColor: C.panel, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 }}>
              {g} <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink }}>{v ?? "--"}</Text>
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function Quadrant({ group }: { group: string }) {
  const cells = ["High skill, low will", "High skill, high will", "Low skill, low will", "Low skill, high will"];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", width: 110, gap: 2 }}>
      {cells.map((k) => (
        <View
          key={k}
          style={{
            width: 54,
            height: 34,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 3,
            backgroundColor: k === group ? C.teal : C.panel,
          }}
        >
          <Text style={{ fontSize: 6, textAlign: "center", color: k === group ? C.white : C.muted, fontFamily: k === group ? "Helvetica-Bold" : "Helvetica" }}>
            {k.replace(", ", "\n")}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ---------------- blocks ---------------- */

function Badge({ text, color }: { text: string; color: string }) {
  return <Text style={[s.badge, { color, backgroundColor: `${color}1a`, border: `0.5 solid ${color}` }]}>{text}</Text>;
}

function Missing({ type }: { type: "Skill" | "Behaviour" }) {
  return (
    <View style={{ border: `0.8 dashed ${C.faint}`, borderRadius: 4, backgroundColor: C.panel, padding: 8 }}>
      <Text style={[s.small, { fontFamily: "Helvetica-Bold" }]}>{type} assessment unavailable</Text>
      <Text style={[s.tiny, { marginTop: 2 }]}>No visible active {type.toLowerCase()} assessment was found for this employee.</Text>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontSize: 6, color: C.muted, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: C.body }}>{value}</Text>
    </View>
  );
}

function StatRow({ value, color, title, text }: { value: number | null; color: string; title: string; text: string }) {
  return (
    <View style={[s.row, { alignItems: "center", gap: 6, marginBottom: 4 }]}>
      <Ring value={value} color={color} size={30} stroke={4.5} fontSize={7} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>{title}</Text>
        <Text style={{ fontSize: 6.5, color: C.muted, lineHeight: 1.25 }}>{text}</Text>
      </View>
    </View>
  );
}

function Dimension({ title, description, value, color, missingText, items }: { title: string; description: string; value: number | null; color: string; missingText: string; items: { name: string; value: number }[] }) {
  return (
    <View style={{ flex: 1, border: `1 solid ${C.line}`, borderRadius: 6, padding: 6 }}>
      <View style={[s.row, { alignItems: "center", gap: 6 }]}>
        <Ring value={value} color={color} size={34} stroke={5} />
        <View style={{ flex: 1 }}>
          <View style={[s.row, { alignItems: "center", gap: 4 }]}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{title}</Text>
            {value != null && <Badge text={bandOf(value) ?? ""} color={BAND_COLOR[bandOf(value) ?? "Material gap"]} />}
          </View>
          <Text style={[s.tiny, { marginTop: 1, lineHeight: 1.25 }]}>{description}</Text>
        </View>
      </View>
      {value == null ? (
        <View style={{ marginTop: 6, borderRadius: 4, backgroundColor: C.panel, padding: 8 }}>
          <Text style={s.tiny}>{missingText}</Text>
        </View>
      ) : (
        <View style={{ marginTop: 4, alignItems: "center" }}>
          <Radar items={items} color={color} />
        </View>
      )}
    </View>
  );
}

function ScoreTable({ result, isSelf, title }: { result: AssignmentResult; isSelf: boolean; title: string }) {
  const isSkill = result.template.kind === "skill";
  const th = { fontSize: 6.5, color: C.muted, textTransform: "uppercase" as const, fontFamily: "Helvetica-Bold" as const, paddingBottom: 2 };
  return (
    <View style={[s.box, { flex: 1, padding: 8 }]}>
      <Text style={s.boxTitle}>{title}</Text>
      <View wrap={false} style={[s.row, { borderBottom: `0.8 solid ${C.line}`, paddingBottom: 2 }]}>
        <Text style={[th, { flex: 1.4 }]}>Item</Text>
        {!isSelf && <Text style={[th, { width: 26, textAlign: "right" }]}>Self</Text>}
        {!isSelf && <Text style={[th, { width: 32, textAlign: "right" }]}>Line mgr</Text>}
        {!isSelf && <Text style={[th, { width: 38, textAlign: "right" }]}>{isSkill ? "X-dept" : "Peers"}</Text>}
        <Text style={[th, { width: 44, textAlign: "center" }]}>Scenario</Text>
        <Text style={[th, { width: 30, textAlign: "right" }]}>Score</Text>
        <Text style={[th, { width: 76, paddingLeft: 8 }]}>Band</Text>
        <Text style={[th, { flex: 1, paddingLeft: 8 }]}>Flag</Text>
      </View>
      {result.score.items.map((i) => (
        <View key={i.item_id} wrap={false} style={[s.row, { borderTop: `0.5 solid ${C.line}`, paddingVertical: 2.5, alignItems: "flex-start" }]}>
          <View style={{ flex: 1.4, paddingRight: 3 }}>
            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{i.name}</Text>
            {i.group_name && <Text style={{ fontSize: 6.5, color: C.faint }}>{i.group_name}</Text>}
          </View>
          {!isSelf && <Text style={{ width: 26, fontSize: 7.5, textAlign: "right" }}>{i.self ?? "—"}</Text>}
          {!isSelf && <Text style={{ width: 32, fontSize: 7.5, textAlign: "right" }}>{i.line_manager ?? "—"}</Text>}
          {!isSelf && (
            <Text style={{ width: 38, fontSize: 7.5, textAlign: "right" }}>
              {i.others_avg ?? "—"}
              {i.others_count > 0 ? <Text style={{ color: C.faint, fontSize: 6.5 }}> ({i.others_count})</Text> : null}
            </Text>
          )}
          <Text style={{ width: 44, fontSize: 7, textAlign: "center", color: i.scenario_correct == null ? C.faint : i.scenario_correct ? C.green : C.red, fontFamily: "Helvetica-Bold" }}>
            {i.scenario_correct == null ? "—" : i.scenario_correct ? "Yes" : "No"}
          </Text>
          <Text style={{ width: 30, fontSize: 7.5, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{i.score ?? "—"}</Text>
          <View style={{ width: 76, paddingLeft: 8 }}>
            {i.band && <Badge text={i.band} color={BAND_COLOR[i.band]} />}
          </View>
          <Text style={{ flex: 1, fontSize: 6.5, color: C.muted, paddingLeft: 8 }}>{i.flag ?? "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function SignatureBox({ role, name, signature }: { role: string; name?: string; signature?: ReportSignature }) {
  return (
    <View style={{ flex: 1, border: `1 solid ${C.line}`, borderRadius: 6, backgroundColor: C.panel, padding: 8 }}>
      <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase" }}>{role}</Text>
      <Text style={{ fontSize: 8.5, borderBottom: `0.6 solid ${C.faint}`, marginTop: 10, paddingBottom: 2 }}>{signature?.name ?? name ?? ""}</Text>
      <View style={[s.row, { marginTop: 3, gap: 8 }]}>
        <Text style={[s.tiny, signature ? { color: C.green, fontFamily: "Helvetica-Bold" } : {}]}>{signature ? "Signed" : "Signature"}</Text>
        <Text style={[s.tiny, { flex: 1, borderBottom: `0.5 solid ${C.line}` }]}>{signature ? new Date(signature.at).toLocaleDateString("en-GB") : "Date"}</Text>
      </View>
    </View>
  );
}

/* ---------------- document ---------------- */

export function AssessmentReportPdf({
  report,
  warnings,
  roleFamily,
  date,
  wave,
  provisional,
}: {
  report: EmployeeReport;
  warnings: Warning[];
  roleFamily: string;
  date: string;
  wave: string | null;
  provisional: boolean;
}) {
  const { employee, skill, behaviour, grid, isSelf, signatures } = report;
  const aspiration = Object.entries((behaviour?.assignment.aspiration as Record<string, string> | null) ?? {}).filter(([, v]) => v);
  const reportDate = date || new Date().toLocaleDateString("en-GB");
  const generated = new Date().toLocaleDateString("en-GB");

  const footer = (
    <View fixed style={{ position: "absolute", bottom: 14, left: 24, right: 24, borderTop: `0.6 solid ${C.line}`, paddingTop: 4, flexDirection: "row", justifyContent: "space-between", gap: 16 }}>
      <Text style={{ fontSize: 5.8, color: C.muted, lineHeight: 1.3, maxWidth: 640 }}>
        {`Scores are weighted percentages (${skill ? "cross-departmental 40 / line manager 20 / scenario 30 / self 10" : ""}${skill && behaviour ? "; " : ""}${behaviour ? "peer 30 / line manager 35 / scenario 25 / self 10" : ""}). Bands: Strength >=75, Meets standard >=60, Development gap >=45, Material gap <45. Individual rater scores are never disclosed; a result is provisional below three rater responses. Signatures confirm the report was reviewed, not agreement with every result.`}
      </Text>
      <Text
        style={{ fontSize: 5.8, color: C.muted, textAlign: "right" }}
        render={({ pageNumber, totalPages }) => `Dhofar Global Performance Hub\nConfidential employee record - Generated ${generated}\nPage ${pageNumber} of ${totalPages}`}
      />
    </View>
  );

  return (
    <Document title={`Assessment report — ${employee.full_name}`} author="Dhofar Global Performance Hub">
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* header */}
        <View wrap={false} style={[s.box, { backgroundColor: C.tealBg, borderColor: C.tealBorder, marginBottom: 8 }]}>
          <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: C.teal, textTransform: "uppercase" }}>Dhofar Global</Text>
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 }}>Employee assessment report</Text>
              <Text style={{ fontSize: 7.5, color: C.muted, marginTop: 3, lineHeight: 1.35 }}>{ASSESSMENT_PURPOSE}</Text>
            </View>
            <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.teal, border: `0.8 solid ${C.tealBorder}`, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1.5, textTransform: "uppercase" }}>
              Confidential
            </Text>
          </View>
          <View style={[s.row, { gap: 28, borderTop: `0.6 solid ${C.tealBorder}`, marginTop: 8, paddingTop: 6 }]}>
            <Meta label="Employee" value={employee.full_name} />
            <Meta label="Assessment wave" value={wave ?? "Not specified"} />
            <Meta label="Report date" value={reportDate} />
          </View>
        </View>

        {/* profile / behaviour / warnings */}
        <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
          <View style={[s.box, { flex: 1.05 }]}>
            <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
              <View>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>{employee.full_name}</Text>
                <Text style={[s.small, { color: C.muted, marginTop: 1 }]}>
                  {employee.employee_id} · {employee.job_title}
                  {employee.department ? ` · ${employee.department}` : ""}
                </Text>
              </View>
              {provisional && <Text style={{ fontSize: 6.5, color: C.amber, border: `0.8 solid #fcd34d`, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>Provisional</Text>}
            </View>
            <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase", marginTop: 6, marginBottom: 3 }}>Capability profile</Text>
            {skill ? (
              <View>
                <StatRow value={skill.score.index} color={bandOf(skill.score.index) ? BAND_COLOR[bandOf(skill.score.index)!] : C.faint} title="Skill Index" text={indexText(skill.score.index)} />
                <StatRow value={null} color="#7c3aed" title="Judgement" text={skill.score.scenarios_answered ? `${skill.score.scenarios_correct} of ${skill.score.scenarios_answered} scenario checks answered with the best option.` : "Scenario checks not yet answered."} />
                <StatRow value={null} color="#0891b2" title="Self-awareness" text={selfAwarenessText(skill.score.items)} />
              </View>
            ) : (
              <Missing type="Skill" />
            )}
          </View>

          <View style={[s.box, { flex: 1.35 }]}>
            <Text style={s.boxTitle}>Behavioural profile</Text>
            {behaviour ? <GroupDonut result={behaviour} initials={initials(employee.full_name)} /> : <Missing type="Behaviour" />}
          </View>

          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.boxTitle}>Advisory warnings</Text>
            {warnings.length === 0 && <Text style={s.muted}>No divergence flags raised.</Text>}
            {warnings.map((w) => (
              <View key={w.code} style={[s.row, { gap: 4, marginBottom: 4 }]}>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: C.amber }}>!</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{w.title}</Text>
                  <Text style={[s.tiny, { lineHeight: 1.3, marginTop: 0.5 }]}>{w.detail}</Text>
                  {w.items.length > 0 && <Text style={[s.tiny, { color: C.body, marginTop: 0.5 }]}>{w.items.join(" · ")}</Text>}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* role match */}
        <View wrap={false} style={[s.box, { marginBottom: 8 }]}>
          <Text style={s.boxTitle}>{`Role match: ${roleFamily}`}</Text>
          <Text style={s.boxSub}>Role placement combines capability (Skill) with motivation and adaptability (Will).</Text>
          <View style={[s.row, { gap: 8 }]}>
            <Dimension
              title="Skill"
              description={`Competency score vs the ${STANDARD}% role standard.`}
              value={skill?.score.index ?? null}
              color={C.indigo}
              missingText="No active Skill assessment could be paired with this report."
              items={(skill?.score.items ?? []).map((i) => ({ name: i.name, value: i.score ?? 0 }))}
            />
            <Dimension
              title="Will"
              description={`Desire and Attitude score vs the ${STANDARD}% role standard.`}
              value={behaviour?.score.will_index ?? null}
              color={C.pink}
              missingText="No active Behaviour assessment could be paired with this report."
              items={(behaviour?.score.items ?? []).map((i) => ({ name: i.name, value: i.score ?? 0 }))}
            />
            <View style={{ width: 150, border: `1 solid ${C.line}`, borderRadius: 6, backgroundColor: C.panel, padding: 8, alignItems: "center", justifyContent: "center", gap: 5 }}>
              {grid ? (
                <>
                  <Quadrant group={grid.group} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase" }}>Placement</Text>
                    <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", marginTop: 1 }}>{grid.group}</Text>
                    <Text style={[s.tiny, { textAlign: "center", marginTop: 2, lineHeight: 1.3 }]}>{grid.action}</Text>
                  </View>
                </>
              ) : (
                <Text style={[s.tiny, { textAlign: "center", lineHeight: 1.3 }]}>Placement on the four-quadrant grid needs both a Skill and a Will score.</Text>
              )}
            </View>
          </View>
        </View>

        {footer}
      </Page>

      {/* page 2: score tables, aspiration, signatures */}
      <Page size="A4" orientation="landscape" style={s.page}>
        {(skill || behaviour) && (
          <View style={[s.row, { gap: 8, marginBottom: 8 }]}>
            {skill && <ScoreTable result={skill} isSelf={isSelf} title="Skill competencies" />}
            {behaviour && <ScoreTable result={behaviour} isSelf={isSelf} title="Behaviour, Desire and Attitude" />}
          </View>
        )}

        {aspiration.length > 0 && (
          <View wrap={false} style={[s.box, { marginBottom: 8 }]}>
            <Text style={s.boxTitle}>Aspiration and intent</Text>
            <Text style={s.boxSub}>Self-reported, unscored.</Text>
            <View style={[s.row, { flexWrap: "wrap", gap: 8 }]}>
              {aspiration.map(([q, v]) => (
                <View key={q} style={{ width: "48%" }}>
                  <Text style={{ fontSize: 6.5, color: C.muted }}>{q}</Text>
                  <Text style={{ fontSize: 7.5, lineHeight: 1.3 }}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View wrap={false} style={[s.row, { gap: 8, marginBottom: 8 }]}>
          <SignatureBox role="Employee" name={employee.full_name} signature={signatures.employee} />
          <SignatureBox role="Line manager" signature={signatures.manager} />
          <SignatureBox role="HR representative" signature={signatures.hr} />
        </View>

        {footer}
      </Page>
    </Document>
  );
}
