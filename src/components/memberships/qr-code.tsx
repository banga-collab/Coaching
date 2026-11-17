import QRCode from "qrcode";
import { cn } from "@/lib/utils";

/** QR code généré côté serveur (SVG), contraste élevé pour les scanners. */
export async function QrCode({ value, className, label }: { value: string; className?: string; label?: string }) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#12495f", light: "#ffffff" },
  });
  return (
    <div
      role="img"
      aria-label={label ?? `QR code ${value}`}
      className={cn("[&>svg]:block [&>svg]:h-full [&>svg]:w-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
