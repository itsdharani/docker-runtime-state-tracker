"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Dependency = { id: string; name: string; condition: string };
type Service = { id: string; name: string; project: string; dependencies: Dependency[] };

export default function DependenciesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dependencies", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load dependency graph.");
        const data = await response.json();
        setServices(data.services);
      })
      .catch(() => setError("Unable to load dependency graph. Check Neo4j configuration and synchronization."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-8 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Service Dependencies</h1>
            <p className="mt-2 text-gray-600">Declared Compose dependencies stored in Neo4j</p>
          </div>
          <nav className="flex gap-3 text-sm font-medium">
            <Link className="rounded-lg bg-white px-4 py-2 shadow" href="/">Overview</Link>
            <Link className="rounded-lg bg-white px-4 py-2 shadow" href="/events">Events</Link>
          </nav>
        </div>

        {error && <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-700">{error}</div>}
        <section className="rounded-xl bg-white shadow">
          <div className="border-b p-6">
            <h2 className="text-xl font-semibold">Dependency graph</h2>
            <p className="mt-1 text-sm text-gray-500">An arrow points from a dependent service to the service it requires.</p>
          </div>
          {loading ? <p className="p-6 text-gray-500">Loading dependencies...</p> :
            services.length === 0 ? <p className="p-6 text-gray-500">No services found. Synchronize a Compose file to Neo4j.</p> :
              <ul className="divide-y">
                {services.map((service) => (
                  <li key={service.id} className="p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">{service.name}</span>
                      <span className="text-sm text-gray-500">declares</span>
                    </div>
                    {service.dependencies.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">No declared dependencies</p>
                    ) : (
                      <ul className="ml-5 mt-3 space-y-2 border-l-2 border-blue-200 pl-5">
                        {service.dependencies.map((dependency) => (
                          <li key={dependency.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <span aria-hidden="true" className="text-blue-600">→</span>
                            <span className="rounded-md bg-blue-50 px-3 py-1 font-medium text-blue-900">{dependency.name}</span>
                            <span className="text-gray-500">({dependency.condition})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>}
        </section>
        <p className="mt-4 text-xs text-gray-500">These are declared startup dependencies. They do not indicate current health or guarantee that a runtime failure propagates.</p>
      </div>
    </main>
  );
}
