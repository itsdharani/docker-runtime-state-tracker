"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const router=useRouter();
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:form.get("username"),password:form.get("password")})});
    if(response.ok) router.push("/"); else {const result=await response.json();setError(result.error||"Sign-in failed.");setBusy(false);}
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-7 shadow"><h1 className="text-2xl font-bold">Runtime Tracker</h1><p className="mt-1 text-sm text-slate-600">Sign in to view Docker runtime data.</p><label className="mt-6 block text-sm">Username<input required name="username" autoComplete="username" className="mt-1 w-full rounded border p-2"/></label><label className="mt-4 block text-sm">Password<input required name="password" type="password" autoComplete="current-password" className="mt-1 w-full rounded border p-2"/></label>{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="mt-6 w-full rounded bg-slate-900 p-2 font-medium text-white disabled:opacity-50">{busy?"Signing in...":"Sign in"}</button></form></main>;
}
