import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArchiveRestore } from "lucide-react";

import { restoreSchoolEntity } from "@/features/school/actions";
import { getSchoolArchives } from "@/features/school/queries";

export const metadata: Metadata = { title: "School Archive" };
const panel = "rounded-2xl border bg-card p-5 shadow-sm";

export default async function SchoolArchivePage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const query = await searchParams;
  const data = await getSchoolArchives();
  return <div className="space-y-7"><header><Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" href="/school"><ArrowLeft className="size-4" />School</Link><h1 className="mt-3 text-3xl font-bold">School archive</h1><p className="mt-1 text-sm text-muted-foreground">Restore parents before children. Restoring a parent never clears a child’s own archive state.</p></header>{query.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{query.error}</p> : null}{query.success ? <p className="rounded-lg bg-success/10 p-3 text-sm text-success">{query.success}</p> : null}<section className="grid gap-4 lg:grid-cols-3"><ArchiveList title="Terms" empty="No archived terms." rows={data.terms.map((term) => ({ id: term.id, label: term.name, detail: `${term.start_date} – ${term.end_date}`, type: "term", disabled: false }))} /><ArchiveList title="Courses" empty="No archived courses." rows={data.courses.map((course) => { const term = data.allTerms.get(course.term_id); return { id: course.id, label: `${course.code} · ${course.name}`, detail: term?.name ?? "Unknown term", type: "course", disabled: Boolean(term?.archived_at) }; })} /><ArchiveList title="Assessments" empty="No archived assessments." rows={data.assessments.map((assessment) => { const course = data.allCourses.get(assessment.course_id); const term = course ? data.allTerms.get(course.term_id) : null; return { id: assessment.id, label: assessment.name, detail: course ? `${course.code} · ${course.name}` : "Unknown course", type: "assessment", disabled: Boolean(course?.archived_at || term?.archived_at) }; })} /></section></div>;
}

function ArchiveList({ title, empty, rows }: { title: string; empty: string; rows: { id: string; label: string; detail: string; type: string; disabled: boolean }[] }) {
  return <section className={panel}><h2 className="font-bold">{title}</h2><div className="mt-4 space-y-3">{rows.length ? rows.map((row) => <article className="rounded-xl border p-3" key={row.id}><p className="font-semibold">{row.label}</p><p className="text-xs text-muted-foreground">{row.detail}</p><form action={restoreSchoolEntity} className="mt-2"><input name="id" type="hidden" value={row.id} /><input name="type" type="hidden" value={row.type} /><button className="inline-flex items-center gap-1 text-xs font-semibold text-primary disabled:text-muted-foreground" disabled={row.disabled}><ArchiveRestore className="size-3.5" />{row.disabled ? "Restore parent first" : "Restore"}</button></form></article>) : <p className="text-sm text-muted-foreground">{empty}</p>}</div></section>;
}
