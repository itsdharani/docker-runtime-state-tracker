"use client";

import { useEffect, useState } from "react";

type Container = {
  container_id: string;
  container_name: string;
  service_name: string;
  service_image: string;
  container_image: string;
  current_state: string;
  last_event_type: string | null;
  restart_count: number;
  last_updated: string;
};

export default function Home() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadContainers() {
    try {
      const response = await fetch("/api/containers", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch containers");
      }

      const data = await response.json();
      setContainers(data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to load container data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = setTimeout(loadContainers, 0);
    const interval = setInterval(loadContainers, 5000);

    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, []);

  const running = containers.filter(
    (c) => c.current_state === "running"
  ).length;

  const stopped = containers.filter(
    (c) => c.current_state === "stopped"
  ).length;

  const restarting = containers.filter(
    (c) => c.current_state === "restarting"
  ).length;

  const totalRestarts = containers.reduce(
    (sum, c) => sum + Number(c.restart_count || 0),
    0
  );

  return (
    <main className="min-h-screen bg-gray-100 p-8 text-gray-900">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <nav className="mb-4 flex gap-3 text-sm font-medium">
            <a className="rounded-lg bg-white px-4 py-2 shadow" href="/events">Event history</a>
            <a className="rounded-lg bg-white px-4 py-2 shadow" href="/dependencies">Dependencies</a>
          </nav>
          <h1 className="text-3xl font-bold">
            Docker Runtime Tracker
          </h1>

          <p className="mt-2 text-gray-600">
            Real-time container state and runtime event monitoring
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Total Containers
            </p>

            <p className="mt-2 text-3xl font-bold">
              {containers.length}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Running
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {running}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Stopped
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-600">
              {stopped}
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Total Restarts
            </p>

            <p className="mt-2 text-3xl font-bold text-orange-600">
              {totalRestarts}
            </p>
          </div>

        </div>

        <div className="rounded-xl bg-white shadow">

          <div className="border-b p-6">
            <h2 className="text-xl font-semibold">
              Container Status
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Automatically refreshed every 5 seconds
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Dependency relationships are declared for Compose services. Standalone containers have unknown dependencies.
            </p>
          </div>

          {loading ? (
            <div className="p-6 text-gray-500">
              Loading container data...
            </div>
          ) : containers.length === 0 ? (
            <div className="p-6 text-gray-500">
              No containers found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">

                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-6 py-4">Container</th>
                    <th className="px-6 py-4">Service</th>
                    <th className="px-6 py-4">Image</th>
                    <th className="px-6 py-4">State</th>
                    <th className="px-6 py-4">Last Event</th>
                    <th className="px-6 py-4">Restarts</th>
                  </tr>
                </thead>

                <tbody>

                  {containers.map((container) => (

                    <tr
                      key={container.container_id}
                      className="border-t hover:bg-gray-50"
                    >

                      <td className="px-6 py-4 font-medium">
                        {container.container_name}
                      </td>

                      <td className="px-6 py-4">
                        {container.service_name}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {container.container_image}
                      </td>

                      <td className="px-6 py-4">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            container.current_state === "running"
                              ? "bg-green-100 text-green-700"
                              : container.current_state === "stopped"
                              ? "bg-gray-200 text-gray-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {container.current_state}
                        </span>

                      </td>

                      <td className="px-6 py-4">
                        {container.last_event_type || "-"}
                      </td>

                      <td className="px-6 py-4 font-medium">
                        {container.restart_count}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>
          )}

        </div>

        <div className="mt-4 text-right text-xs text-gray-500">
          {restarting > 0
            ? `${restarting} container(s) restarting`
            : "System monitored through Docker events"}
        </div>

      </div>
    </main>
  );
}
