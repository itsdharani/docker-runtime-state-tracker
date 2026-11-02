"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

const pages = [
  ["Overview", "/"], ["Dependency graph", "/dependencies"],
  ["Containers", "/containers"], ["Event history", "/events"],
  ["Impact analysis", "/impact"],
  ["User administration", "/users"],
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/login") return null;
  return (
    <aside className="w-full shrink-0 border-b border-slate-800 bg-slate-950 p-5 text-white md:min-h-screen md:w-60 md:border-b-0 md:border-r">
      <Link className="text-lg font-semibold" href="/">Runtime Tracker</Link>
      <nav aria-label="Main navigation" className="mt-8 flex flex-wrap gap-2 md:flex-col">
        {pages.map(([label, href]) => <Link key={href} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white" href={href}>{label}</Link>)}
      </nav>
      <button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh();}} className="mt-6 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800">Sign out</button>
    </aside>
  );
}
