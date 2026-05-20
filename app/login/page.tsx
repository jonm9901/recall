"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      const callbackUrl = searchParams.get("callbackUrl") || "/";
      router.push(callbackUrl);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" className="w-24 h-24 mx-auto mb-4">
            <path d="M10 60 C30 25, 90 25, 110 60 C90 95, 30 95, 10 60 Z" fill="#1e293b" stroke="#60a5fa" strokeWidth="3"/>
            <circle cx="60" cy="60" r="22" fill="#1d4ed8"/>
            <circle cx="60" cy="60" r="22" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 2"/>
            <circle cx="60" cy="60" r="17" fill="none" stroke="#2563eb" strokeWidth="1" strokeDasharray="4 3"/>
            <circle cx="60" cy="60" r="12" fill="none" stroke="#1e40af" strokeWidth="1.5" strokeDasharray="2 2"/>
            <line x1="60" y1="38" x2="60" y2="44" stroke="#93c5fd" strokeWidth="1" opacity="0.6"/>
            <line x1="60" y1="76" x2="60" y2="82" stroke="#93c5fd" strokeWidth="1" opacity="0.6"/>
            <line x1="38" y1="60" x2="44" y2="60" stroke="#93c5fd" strokeWidth="1" opacity="0.6"/>
            <line x1="76" y1="60" x2="82" y2="60" stroke="#93c5fd" strokeWidth="1" opacity="0.6"/>
            <line x1="44.5" y1="44.5" x2="48.7" y2="48.7" stroke="#93c5fd" strokeWidth="1" opacity="0.6"/>
            <line x1="71.3" y1="71.3" x2="75.5" y2="75.5" stroke="#93c5fd" strokeWidth="1" opacity="0.6"/>
            <line x1="75.5" y1="44.5" x2="71.3" y2="48.7" stroke="#93c5fd" strokeWidth="1" opacity="0.6"/>
            <line x1="48.7" y1="71.3" x2="44.5" y2="75.5" stroke="#93c5fd" strokeWidth="1" opacity="0.6"/>
            <circle cx="60" cy="60" r="9" fill="#0f172a"/>
            <circle cx="55" cy="55" r="3" fill="white" opacity="0.35"/>
            <circle cx="65" cy="63" r="1.5" fill="white" opacity="0.2"/>
            <path d="M10 60 C30 25, 90 25, 110 60" fill="none" stroke="#93c5fd" strokeWidth="1" opacity="0.4"/>
          </svg>
          <h1 className="text-4xl font-bold text-white tracking-tight">Total Recall</h1>
          <p className="text-gray-400 mt-1 text-sm">Personal photo intelligence</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-8 space-y-5 border border-gray-800">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
