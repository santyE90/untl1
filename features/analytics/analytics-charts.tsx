"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const shortDate = (date: string) => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const money = (value: unknown, currency: string) => new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));

export function FinanceTrendChart({ data, currency }: { data: Array<{ date: string; income: string; expenses: string }>; currency: string }) {
  if (!data.some((item) => Number(item.income) || Number(item.expenses))) return <p className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">No posted income or expenses in this range.</p>;
  const points = data.map((item) => ({ ...item, incomeValue: Number(item.income), expenseValue: Number(item.expenses) }));
  return <div className="h-72 w-full" aria-label={`Income and expenses over time in ${currency}`}><ResponsiveContainer><LineChart data={points} margin={{ left: 4, right: 16, top: 12 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={28} tick={{ fontSize: 11 }}/><YAxis tickFormatter={(value) => money(value, currency)} width={72} tick={{ fontSize: 11 }}/><Tooltip labelFormatter={(value) => shortDate(String(value))} formatter={(value, name) => [money(value, currency), name === "incomeValue" ? "Income" : "Expenses"]}/><Legend formatter={(value) => value === "incomeValue" ? "Income" : "Expenses"}/><Line dataKey="incomeValue" stroke="var(--financial-positive)" strokeWidth={2.5} dot={false}/><Line dataKey="expenseValue" stroke="var(--financial-negative)" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer></div>;
}

export function TaskTrendChart({ data }: { data: Array<{ date: string; completed: number }> }) {
  if (!data.some((item) => item.completed)) return <p className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">No Tasks were completed in this range.</p>;
  return <div className="h-60 w-full" aria-label="Tasks completed over time"><ResponsiveContainer><BarChart data={data} margin={{ left: 0, right: 12, top: 12 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={28} tick={{ fontSize: 11 }}/><YAxis allowDecimals={false} width={32}/><Tooltip labelFormatter={(value) => shortDate(String(value))}/><Bar dataKey="completed" name="Completed" fill="var(--chart-2)" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>;
}

export function CourseStandingChart({ data }: { data: Array<{ code: string; completedWorkGrade: string | null }> }) {
  const points = data.filter((item) => item.completedWorkGrade !== null).map((item) => ({ code: item.code, standing: Number(item.completedWorkGrade) }));
  if (!points.length) return <p className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">No courses have graded work yet.</p>;
  return <div className="h-60 w-full" aria-label="Current completed-work grade by course"><ResponsiveContainer><BarChart data={points} margin={{ left: 0, right: 12, top: 12 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="code" tick={{ fontSize: 11 }}/><YAxis domain={[0,100]} tickFormatter={(value) => `${value}%`} width={42}/><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Completed-work grade"]}/><Bar dataKey="standing" fill="var(--chart-3)" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>;
}

export function TaskActivityChart({ data }: { data: Array<{ date: string; created: number; completed: number }> }) {
  if (!data.some((item) => item.created || item.completed)) return <p className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">No Task activity in this range.</p>;
  return <div className="h-64 w-full" aria-label="Tasks created and completed over time"><ResponsiveContainer><BarChart data={data} margin={{ left: 0, right: 12, top: 12 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="date" tickFormatter={shortDate} minTickGap={28} tick={{ fontSize: 11 }}/><YAxis allowDecimals={false} width={32}/><Tooltip labelFormatter={(value) => shortDate(String(value))}/><Legend/><Bar dataKey="created" name="Created" fill="var(--chart-1)" radius={[4,4,0,0]}/><Bar dataKey="completed" name="Completed" fill="var(--chart-2)" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>;
}

export function AssessmentPerformanceChart({ data }: { data: Array<{ date: string; courseCode: string; name: string; percentage: string }> }) {
  if (!data.length) return <p className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">Not enough graded or missed assessment data in this range.</p>;
  const points = data.map((item, index) => ({ ...item, index: index + 1, value: Number(item.percentage), label: `${item.courseCode} · ${item.name}` }));
  return <div className="h-72 w-full" aria-label="Assessment performance in chronological order"><ResponsiveContainer><LineChart data={points} margin={{ left: 0, right: 16, top: 12 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="index" allowDecimals={false} width={32}/><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={44}/><Tooltip labelFormatter={(_, payload) => payload[0]?.payload.label ?? "Assessment"} formatter={(value) => [`${Number(value).toFixed(1)}%`, "Result"]}/><Line dataKey="value" name="Assessment result" stroke="var(--chart-3)" strokeWidth={2.5}/></LineChart></ResponsiveContainer></div>;
}
