"use client";

import { useEffect, useState } from "react";

type Event = {
  container_name: string;
  service_name: string;
  event_type: string;
  event_time: string;
  mongo_ref: string | null;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadEvents() {
    try {
      const response = await fetch("/api/events", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();

      setEvents(data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to load event history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();

    const interval = setInterval(loadEvents, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-8 text-gray-900">

      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex items-center justify-between">

          <div>
            <h1 className="text-3xl font-bold">
              Event History
            </h1>

            <p className="mt-2 text-gray-600">
              Docker runtime events recorded by the system
            </p>
          </div>

          <a
            href="/"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Dashboard
          </a>

        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-white shadow">

          <div className="border-b p-6">

            <h2 className="text-xl font-semibold">
              Docker Event Log
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Automatically refreshed every 5 seconds
            </p>

          </div>

          {loading ? (

            <div className="p-6 text-gray-500">
              Loading events...
            </div>

          ) : events.length === 0 ? (

            <div className="p-6 text-gray-500">
              No events recorded.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-left text-sm">

                <thead className="bg-gray-50 text-gray-600">

                  <tr>

                    <th className="px-6 py-4">
                      Container
                    </th>

                    <th className="px-6 py-4">
                      Service
                    </th>

                    <th className="px-6 py-4">
                      Event
                    </th>

                    <th className="px-6 py-4">
                      Time
                    </th>

                    <th className="px-6 py-4">
                      Mongo Reference
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {events.map((event, index) => (

                    <tr
                      key={`${event.container_name}-${event.event_time}-${index}`}
                      className="border-t hover:bg-gray-50"
                    >

                      <td className="px-6 py-4 font-medium">
                        {event.container_name}
                      </td>

                      <td className="px-6 py-4">
                        {event.service_name}
                      </td>

                      <td className="px-6 py-4">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            event.event_type === "start"
                              ? "bg-green-100 text-green-700"
                              : event.event_type === "die" ||
                                event.event_type === "kill"
                              ? "bg-red-100 text-red-700"
                              : event.event_type === "stop"
                              ? "bg-gray-200 text-gray-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {event.event_type}
                        </span>

                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {new Date(event.event_time).toLocaleString()}
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-500">
                        {event.mongo_ref || "-"}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </main>
  );
}
