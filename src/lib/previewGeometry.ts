export function containRect(sourceWidth: number, sourceHeight: number, width: number, height: number) {
  if (!(sourceWidth > 0 && sourceHeight > 0 && width > 0 && height > 0)) return { x: 0, y: 0, width, height };
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const fittedWidth = sourceWidth * scale;
  const fittedHeight = sourceHeight * scale;
  return { x: (width - fittedWidth) / 2, y: (height - fittedHeight) / 2, width: fittedWidth, height: fittedHeight };
}

export function pointInSource(x: number, y: number, viewport: ReturnType<typeof containRect>) {
  return { x: (x - viewport.x) / viewport.width * 100, y: (y - viewport.y) / viewport.height * 100 };
}
