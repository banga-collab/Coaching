"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "./ui";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={buttonClass("brand")}>
      <Printer className="size-4" /> Imprimer / PDF
    </button>
  );
}
