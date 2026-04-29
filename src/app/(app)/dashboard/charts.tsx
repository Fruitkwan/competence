"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ClusterRow = {
  name: string;
  count: number;
  avgScore: number;
  avgGap: number;
  high: number;
  medium: number;
  low: number;
};

type CountryRow = {
  name: string;
  count: number;
  avgGap: number;
  high: number;
  completion: number;
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "#dc2626",
  MEDIUM: "#d97706",
  LOW: "#059669",
};

export function DashboardCharts({
  clusterRows,
  countryRows,
}: {
  clusterRows: ClusterRow[];
  countryRows: CountryRow[];
}) {
  const priorityData = [
    { name: "HIGH", value: clusterRows.reduce((s, r) => s + r.high, 0) },
    { name: "MEDIUM", value: clusterRows.reduce((s, r) => s + r.medium, 0) },
    { name: "LOW", value: clusterRows.reduce((s, r) => s + r.low, 0) },
  ];
  const hasPriorityData = priorityData.some((d) => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gap distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-56">
            <div className="mb-1 text-xs text-muted-foreground">Priority mix</div>
            {hasPriorityData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {priorityData.map((entry) => (
                      <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={24} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
          <div className="h-56">
            <div className="mb-1 text-xs text-muted-foreground">Avg gap by country</div>
            {countryRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryRows}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="avgGap" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
      No data yet
    </div>
  );
}
