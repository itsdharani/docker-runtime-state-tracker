"use client";

import { useEffect, useState } from "react";

type Row = { container_id:string; container_name:string; service_name:string; compose_project:string; container_image:string; current_state:string; restart_count:number; last_updated:string };
type Overview = { total:string; running:string; stopped:string; errors:string; services:string; projects:string; recent_events:{container_name:string;service_name:string;event_type:string;event_time:string}[] };
type Containers = { rows:Row[]; total:number };

export default function Home() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [data, setData] = useState<Containers>({rows:[],total:0});
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/overview", {cache:"no-store"}).then(async r => { if (!r.ok) throw new Error(); setOverview(await r.json()); }).catch(() => setError("Could not load overview statistics."));
  }, []);
  useEffect(() => {
    const params = new URLSearchParams({q:query,page:"1"});
    fetch(`/api/containers?${params}`, {cache:"no-store"}).then(async r => { if (!r.ok) throw new Error(); setData(await r.json()); }).catch(() => setError("Could not load container rows."));
  }, [query]);
  const cards = [["Containers",overview?.total],["Running",overview?.running],["Stopped / removed",overview?.stopped],["Services",overview?.services],["Compose projects",overview?.projects],["Dead / unknown",overview?.errors]];
  return <main className="min-h-screen bg-slate-100 p-6 text-slate-900 md:p-10"><h1 className="text-3xl font-bold">Overview</h1><p className="mt-2 text-slate-600">Current Docker runtime state and recent lifecycle activity.</p>
    {error && <p role="alert" className="mt-4 rounded bg-red-100 p-3 text-red-800">{error}</p>}
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value]) => <article key={label} className="rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value ?? "—"}</p></article>)}</section>
    <section className="mt-8 grid gap-6 xl:grid-cols-3"><div className="overflow-hidden rounded-xl bg-white shadow-sm xl:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="text-xl font-semibold">Containers</h2><p className="text-sm text-slate-500">{data.total} discovered records</p></div><input aria-label="Search containers" className="rounded border px-3 py-2" placeholder="Search name, ID, service..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Container","Service / project","Image","State","Updated"].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{data.rows.map(row=><tr className="border-t" key={row.container_id}><td className="p-3 font-medium">{row.container_name}<span className="block font-mono text-xs text-slate-500">{row.container_id.slice(0,12)}</span></td><td className="p-3">{row.service_name}<span className="block text-xs text-slate-500">{row.compose_project}</span></td><td className="max-w-48 truncate p-3">{row.container_image}</td><td className="p-3">{row.current_state}</td><td className="p-3">{new Date(row.last_updated).toLocaleString()}</td></tr>)}</tbody></table>{data.rows.length===0&&<p className="p-6 text-slate-500">No containers found.</p>}</div></div>
      <div className="rounded-xl bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-semibold">Recent events</h2></div><ul className="divide-y">{(overview?.recent_events||[]).map((event,index)=><li className="p-4" key={`${event.container_name}-${event.event_time}-${index}`}><div className="flex justify-between gap-2"><span className="font-medium">{event.container_name}</span><span className="text-sm text-blue-700">{event.event_type}</span></div><p className="mt-1 text-xs text-slate-500">{event.service_name} · {new Date(event.event_time).toLocaleString()}</p></li>)}</ul>{overview?.recent_events.length===0&&<p className="p-5 text-sm text-slate-500">No events recorded.</p>}</div></section>
  </main>;
}
