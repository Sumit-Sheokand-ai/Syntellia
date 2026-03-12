"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type AccountMenuProps = {
  email: string;
};

export function AccountMenu({ email }: AccountMenuProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const signOut = async () => {
    setIsPending(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">{email}</div>
      <button
        type="button"
        onClick={signOut}
        disabled={isPending}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-60"
      >
        {isPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
