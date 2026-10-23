import { monogram } from "@/lib/og/monogram";

export const contentType = "image/png";

// 192 and 512 are what Android/Chrome expect for an installable app.
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType },
    { id: "512", size: { width: 512, height: 512 }, contentType },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  return monogram(Number(await id) === 192 ? 192 : 512);
}
