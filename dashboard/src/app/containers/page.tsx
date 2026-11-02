"use client";

import { useEffect, useState } from "react";

type Row = { container_id: string; container_name: string; service_name: string; compose_project: string; container_image: string; current_state: string; restart_count: number; last_updated: string };
type Result = { rows: Row[]; total: number; page: number };

export default function ContainersPage() {
  const [data, setData] = useState<Result>({ rows: [], total: 0, page: 1 });
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams({ q: query, state, page: "1" });
    fetch(`/api/containers?${params}`, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error();
      setData(await response.json()); setError("");
    }).catch(() => setError("Unable to load containers."));
  }, [query, state]);
  return <main className="min-h-screen bg-slate-100 p-6 text-slate-900 md:p-10">
    <h1 className="text-3xl font-bold">Containers</h1>
    <div className="my-6 flex flex-wrap gap-3"><input aria-label="Search containers" className="rounded border bg-white px-3 py-2" placeholder="Search name, ID, service, project" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter state" className="rounded border bg-white px-3 py-2" value={state} onChange={e => setState(e.target.value)}>{["all", "running", "stopped", "created", "paused", "restarting", "dead", "removed", "unknown"].map(value => <option key={value}>{value}</option>)}</select><span className="self-center text-sm text-slate-600">{data.total} containers</span></div>
    {error && <p role="alert" className="rounded bg-red-100 p-3 text-red-800">{error}</p>}
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{["Name", "ID", "Image", "Service / project", "State", "Restarts", "Updated"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr key={row.container_id} className="cursor-pointer border-t hover:bg-slate-50" onClick={() => setSelected(row)}><td className="p-3 font-medium">{row.container_name}</td><td className="p-3 font-mono text-xs">{row.container_id.slice(0, 12)}</td><td className="p-3">{row.container_image}</td><td className="p-3">{row.service_name} / {row.compose_project}</td><td className="p-3">{row.current_state}</td><td className="p-3">{row.restart_count}</td><td className="p-3">{new Date(row.last_updated).toLocaleString()}</td></tr>)}</tbody></table>{data.rows.length === 0 && <p className="p-6 text-slate-500">No containers match these filters.</p>}</div>
    {selected && <div className="fixed inset-0 flex justify-end bg-black/30" onClick={() => setSelected(null)}><section className="h-full w-full max-w-lg overflow-auto bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}><button className="float-right rounded border px-3 py-1" onClick={() => setSelected(null)}>Close</button><h2 className="mt-8 text-xl font-semibold">{selected.container_name}</h2><dl className="mt-4 space-y-3 text-sm">{Object.entries(selected).map(([key, value]) => <div key={key}><dt className="text-slate-500">{key.replaceAll("_", " ")}</dt><dd className="break-all">{String(value)}</dd></div>)}</dl></section></div>}
  </main>;
}
