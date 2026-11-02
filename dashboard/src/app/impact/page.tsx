"use client";

import { useEffect, useState } from "react";

type Item = { service: string; service_id: string; distance: number | null };
type Service = { id: string; name: string; project: string; containers: {name:string;status:string;id:string}[] };
type Analysis = Record<string, Item[]>;

export default function ImpactPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState("");
  const [analysis, setAnalysis] = useState<Analysis>({});
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/dependencies").then(r => r.json()).then(d => setServices(d.services || [])).catch(() => setError("Could not load discovered services.")); }, []);
  useEffect(() => {
    if (!selected) return;
    Promise.all(["direct", "dependents", "transitive", "impact"].map(async kind => {
      const params = new URLSearchParams({ id: selected, kind });
      const response = await fetch(`/api/dependencies/query?${params}`);
      if (!response.ok) throw new Error();
      return [kind, (await response.json()).results] as const;
    })).then(rows => setAnalysis(Object.fromEntries(rows))).catch(() => setError("Could not calculate dependency impact."));
  }, [selected]);
  const current = services.find(service => service.id === selected);
  const names = { direct: "Direct dependencies", dependents: "Direct dependents", transitive: "Transitive dependencies", impact: "Potentially affected services" };
  return <main className="min-h-screen bg-slate-100 p-6 text-slate-900 md:p-10">
    <h1 className="text-3xl font-bold">Impact analysis</h1>
    <p className="mt-2 text-slate-600">Dependency reachability indicates potential impact, not guaranteed failure.</p>
    {error && <p role="alert" className="mt-4 rounded bg-red-100 p-3 text-red-800">{error}</p>}
    <label className="mt-6 block max-w-xl text-sm font-medium">Service to inspect
      <select className="mt-2 w-full rounded border bg-white p-3" value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">Choose a discovered service</option>{services.map(s => <option key={s.id} value={s.id}>{s.project} / {s.name}</option>)}
      </select>
    </label>
    {current && <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{current.project} / {current.name}</h2>
      <p className="mt-2 text-sm text-slate-600">Instances: {current.containers.map(c => `${c.name} (${c.status})`).join(", ") || "none discovered"}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{Object.entries(names).map(([kind, title]) => <div key={kind} className="rounded-lg border p-4"><h3 className="font-semibold">{title}</h3><ul className="mt-2 space-y-1 text-sm">{(analysis[kind] || []).map(item => <li key={item.service_id}>{item.service}{item.distance ? ` · ${item.distance} hops` : ""}</li>)}</ul>{analysis[kind]?.length === 0 && <p className="mt-2 text-sm text-slate-500">No matching services.</p>}</div>)}</div>
    </section>}
  </main>;
}
