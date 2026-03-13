"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const requestedNext = url.searchParams.get("next");
      const safeNext = requestedNext && requestedNext.startsWith("/") ? requestedNext : "/app/dashboard";

      if (!code) {
        router.replace(safeNext);
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      router.replace(safeNext);
      router.refresh();
    };

    run();
  }, [router]);

  return (
    <div className="panel rounded-[30px] p-8">
      <p className="text-sm uppercase tracking-[0.3em] text-white/45">Completing sign in</p>
      {error ? (
        <p className="mt-4 text-sm text-[#ffb39f]">{error}</p>
      ) : (
        <p className="mt-4 text-sm text-white/62">Finalizing your session and redirecting...</p>
      )}
    </div>
  );
}
