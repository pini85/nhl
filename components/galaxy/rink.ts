import { CanvasTexture, SRGBColorSpace } from "three";

/** A night-mode NHL rink (200 × 85 ft) drawn on a canvas: dark ice with neon lines and circles. */
export function rinkTexture(width = 2048): CanvasTexture {
  const W = width;
  const H = Math.round((W * 85) / 200);
  const ft = W / 200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;

  const ice = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
  ice.addColorStop(0, "#132640");
  ice.addColorStop(1, "#060c18");
  g.fillStyle = ice;
  g.fillRect(0, 0, W, H);

  const line = (color: string, w: number, blur: number, draw: () => void) => {
    g.save();
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = w;
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.beginPath();
    draw();
    g.restore();
  };
  const RED = "#ff3355";
  const BLUE = "#2f8bff";
  const midY = H / 2;

  // Boards.
  line("#5cc8ff", 0.6 * ft, 3 * ft, () => {
    g.roundRect(0.6 * ft, 0.6 * ft, W - 1.2 * ft, H - 1.2 * ft, 28 * ft);
    g.stroke();
  });
  // Goal lines, blue lines, centre line.
  for (const x of [11, 189]) line(RED, 0.25 * ft, 1.5 * ft, () => (g.moveTo(x * ft, 3 * ft), g.lineTo(x * ft, H - 3 * ft), g.stroke()));
  for (const x of [75, 125]) line(BLUE, 1 * ft, 3 * ft, () => (g.moveTo(x * ft, 0.6 * ft), g.lineTo(x * ft, H - 0.6 * ft), g.stroke()));
  line(RED, 1 * ft, 3 * ft, () => (g.moveTo(100 * ft, 0.6 * ft), g.lineTo(100 * ft, H - 0.6 * ft), g.stroke()));
  // Centre circle and dot.
  line(BLUE, 0.3 * ft, 2 * ft, () => (g.arc(100 * ft, midY, 15 * ft, 0, Math.PI * 2), g.stroke()));
  line(BLUE, 0, 2 * ft, () => (g.arc(100 * ft, midY, 0.8 * ft, 0, Math.PI * 2), g.fill()));
  // End-zone faceoff circles and neutral-zone dots.
  for (const x of [31, 169]) {
    for (const dy of [-22, 22]) {
      line(RED, 0.3 * ft, 2 * ft, () => (g.arc(x * ft, midY + dy * ft, 15 * ft, 0, Math.PI * 2), g.stroke()));
      line(RED, 0, 2 * ft, () => (g.arc(x * ft, midY + dy * ft, 1 * ft, 0, Math.PI * 2), g.fill()));
    }
  }
  for (const x of [80, 120]) for (const dy of [-22, 22]) line(RED, 0, 2 * ft, () => (g.arc(x * ft, midY + dy * ft, 1 * ft, 0, Math.PI * 2), g.fill()));
  // Goal creases.
  line("rgba(92,200,255,0.5)", 0.25 * ft, 1.5 * ft, () => {
    g.arc(11 * ft, midY, 6 * ft, -Math.PI / 2, Math.PI / 2);
    g.fill();
  });
  line("rgba(92,200,255,0.5)", 0.25 * ft, 1.5 * ft, () => {
    g.arc(189 * ft, midY, 6 * ft, Math.PI / 2, (3 * Math.PI) / 2);
    g.fill();
  });
  // Club name across centre ice.
  g.save();
  g.fillStyle = "rgba(92,200,255,0.16)";
  g.font = `900 ${7 * ft}px system-ui, -apple-system, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("DROP DROP DROP", 100 * ft, midY + 30 * ft);
  g.restore();

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
