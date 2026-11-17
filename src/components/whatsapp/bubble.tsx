import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bulle façon WhatsApp (message sortant). */
export function WaBubble({ text, time = "09:41", className }: { text: string; time?: string; className?: string }) {
  return (
    <div className={cn("relative ml-auto w-fit max-w-[92%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 pb-1.5 pt-2 text-[13px] leading-snug text-[#111b21] shadow-sm", className)}>
      <span
        aria-hidden
        className="absolute -right-2 top-0 size-0"
        style={{ borderLeft: "8px solid #d9fdd3", borderBottom: "8px solid transparent" }}
      />
      <p className="whitespace-pre-wrap break-words">{text}</p>
      <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
        {time} <CheckCheck className="size-3.5 text-[#53bdeb]" />
      </p>
    </div>
  );
}

/** Fond « papier peint » WhatsApp. */
export function WaWall({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("rounded-xl bg-[#efeae2] p-3", className)}
      style={{ backgroundImage: "radial-gradient(rgba(0,0,0,.035) 1px, transparent 1px)", backgroundSize: "14px 14px" }}
    >
      {children}
    </div>
  );
}
