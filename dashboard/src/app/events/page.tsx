"use client";

import { useEffect, useState } from "react";

type Event = { container_id: string; container_name: string; service_name: string; compose_project: string; event_type: string; event_time: string };
type Result = { rows: Event[]; total: number; page: number };

export default function EventsPage() {
  const [data, setData] = useState<Result>({ rows: [], total: 0, page: 1 });
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams({ q: query, type, page: String(page), sort });
    fetch(`/api/events?${params}`, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      setData(await response.json()); setError("");
    }).catch(() => setError("Unable to load event history."));
  }, [query, type, page, sort]);
  return <main className="min-h-screen bg-slate-100 p-6 text-slate-900 md:p-10"><h1 className="text-3xl font-bold">Event history</h1><p className="mt-2 text-slate-600">Chronological Docker lifecycle records from PostgreSQL.</p>
    <div className="my-6 flex flex-wrap gap-3"><input aria-label="Search events" className="rounded border bg-white px-3 py-2" placeholder="Search container or service" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /><input aria-label="Filter event type" className="w-44 rounded border bg-white px-3 py-2" placeholder="Event type (any)" value={type === "all" ? "" : type} onChange={e => { setType(e.target.value || "all"); setPage(1); }} /><select aria-label="Sort events" className="rounded border bg-white px-3 py-2" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><span className="self-center text-sm text-slate-600">{data.total} events</span></div>
    {error && <p role="alert" className="rounded bg-red-100 p-3 text-red-800">{error}</p>}
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Container", "Service", "Project", "Event", "Time"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{data.rows.map((event, index) => <tr className="border-t" key={`${event.container_id}-${event.event_time}-${index}`}><td className="p-3 font-medium">{event.container_name}</td><td className="p-3">{event.service_name}</td><td className="p-3">{event.compose_project}</td><td className="p-3"><span className="rounded-full bg-blue-50 px-2 py-1">{event.event_type}</span></td><td className="p-3">{new Date(event.event_time).toLocaleString()}</td></tr>)}</tbody></table>{data.rows.length === 0 && <p className="p-6 text-slate-500">No events match these filters.</p>}</div>
    <div className="mt-4 flex items-center justify-between"><button className="rounded border bg-white px-3 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="text-sm">Page {page}</span><button className="rounded border bg-white px-3 py-2 disabled:opacity-40" disabled={page * 50 >= data.total} onClick={() => setPage(page + 1)}>Next</button></div>
  </main>;
}
