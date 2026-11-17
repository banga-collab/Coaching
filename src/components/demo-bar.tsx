import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { DEMO } from "@/lib/demo";
import { cn } from "@/lib/utils";

async function switchRole(fd: FormData) {
  "use server";
  const role = String(fd.get("role")) === "client" ? "client" : "admin";
  (await cookies()).set("demo_role", role, { path: "/" });
  redirect(role === "client" ? "/moi" : "/");
}

export async function DemoBar() {
  if (!DEMO) return null;
  const role = (await cookies()).get("demo_role")?.value === "client" ? "client" : "admin";
  return (
    <div className="no-print fixed right-14 top-2 z-30 flex items-center gap-2 rounded-full bg-ink/90 p-1 pl-3 text-xs text-white shadow-pop backdrop-blur lg:bottom-[92px] lg:left-4 lg:right-auto lg:top-auto" title="Mode démo : données fictives">
      <Sparkles className="size-3.5 text-accent-400" />
      <form action={switchRole} className="flex rounded-full bg-white/10 p-0.5">
        {(["admin", "client"] as const).map((r) => (
          <button key={r} name="role" value={r} className={cn("rounded-full px-3 py-1.5 font-semibold transition", role === r ? "bg-white text-ink" : "text-white/70 hover:text-white")}>
            <span className="hidden lg:inline">Vue </span>
            {r === "admin" ? "coach" : "adhérent"}
          </button>
        ))}
      </form>
    </div>
  );
}
