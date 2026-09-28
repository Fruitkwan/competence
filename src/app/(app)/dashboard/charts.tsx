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

type CountryRow = {
  name: string;
  assigned: number;
  completion: number;
};

const STATUS_COLORS = ["#059669", "#d97706"];

export function DashboardCharts({
  submitted,
  pending,
  countryRows,
}: {
  submitted: number;
  pending: number;
  countryRows: CountryRow[];
}) {
  const statusData = [
    { name: "Submitted", value: submitted },
    { name: "Pending", value: pending },
  ];
  const hasStatusData = statusData.some((item) => item.value > 0);
  const countryChartRows = countryRows
    .filter((row) => row.assigned > 0)
    .map((row) => ({ ...row, completionPercent: Math.round(row.completion * 100) }));

  return (
    <Card>
      <CardHeader><CardTitle>Assessment progress</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-56">
            <div className="mb-1 text-xs text-muted-foreground">Assignment status</div>
            {hasStatusData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[index]} />
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
            <div className="mb-1 text-xs text-muted-foreground">Completion by country</div>
            {countryChartRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryChartRows}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip />
                  <Bar dataKey="completionPercent" name="Completion" fill="#2563eb" radius={[4, 4, 0, 0]} />
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
