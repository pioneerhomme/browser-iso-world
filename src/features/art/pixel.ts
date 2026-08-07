export function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

export function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 255) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 255) * factor));
  const b = Math.min(255, Math.floor((color & 255) * factor));
  return (r << 16) | (g << 8) | b;
}

export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function drawRows(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  palette: Record<string, string>,
  px: number
): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    }
  });
}

export function canvasFromPixelMap(
  rows: string[],
  palette: Record<string, string>,
  px: number
): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w * px;
  canvas.height = rows.length * px;
  const ctx = canvas.getContext('2d')!;
  drawRows(ctx, rows, palette, px);
  return canvas;
}