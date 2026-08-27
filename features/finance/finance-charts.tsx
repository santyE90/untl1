"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type CategoryDatum = { name: string; amount: number; color?: string | null };
type ComparisonDatum = { name: string; current: number; previous: number };

function currencyLabel(value: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function CategorySpendingChart({ data, currency }: { data: CategoryDatum[]; currency: string }) {
  if (!data.length) return <p className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">No posted expenses in this period.</p>;
  return <div className="h-72 w-full" aria-label={`Spending by category in ${currency}`}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 12, right: 20 }}>
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tickFormatter={(value: number) => currencyLabel(value, currency)} tick={{ fontSize: 11 }} />
        <YAxis dataKey="name" type="category" width={92} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => currencyLabel(Number(value), currency)} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="amount" fill="var(--chart-1)" radius={[0, 6, 6, 0]} name="Spent">
          {data.map((item, index) => <Cell key={item.name} fill={item.color ?? `var(--chart-${index % 5 + 1})`} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

export function MonthComparisonChart({ data, currency, currentLabel, previousLabel }: { data: ComparisonDatum[]; currency: string; currentLabel: string; previousLabel: string }) {
  if (!data.some((item) => item.current || item.previous)) return <p className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">No activity in either month.</p>;
  return <div className="h-72 w-full" aria-label={`Income and expense comparison in ${currency}`}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 4, right: 12 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(value: number) => currencyLabel(value, currency)} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => currencyLabel(Number(value), currency)} cursor={{ fill: "var(--muted)" }} />
        <Legend />
        <Bar dataKey="current" name={currentLabel} fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="previous" name={previousLabel} fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
