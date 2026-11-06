export const drawingTools = {
  select: "選択・移動", pen: "ペン", brush: "ブラシ", dots: "ドットペン",
  eraser: "消しゴム", glitter: "ラメブラシ", holo: "ホログラムブラシ",
  circle: "正円", ellipse: "楕円", square: "正方形", rectangle: "長方形",
  diamond: "ひし形", triangle: "三角形", star: "星", heart: "ハート",
  line: "直線", curve: "曲線", polka: "水玉模様", french: "フレンチ曲線", gradient: "グラデーション",
} as const;
export type DrawingTool = keyof typeof drawingTools;
export type StrokeTool = "pen" | "brush" | "dots" | "eraser" | "glitter" | "holo";
export type ShapeTool = Exclude<DrawingTool, StrokeTool | "select">;
export type PaintPoint = { x: number; y: number };
// Centers are nail-relative x/width, y/height. Object dimensions, line width and
// path points use nail-width units for an undistorted circle/square at any DPR.
export type PaintStyle = { color: string; strokeColor: string; secondary: string; opacity: number; lineWidth: number; fill: boolean; stroke: boolean; spacing: number };
type Transform = { id: string; x: number; y: number; rotation: number; scale: number; mirror: boolean };
export type StrokeLayer = Transform & PaintStyle & { type: "stroke"; tool: StrokeTool; points: PaintPoint[] };
export type ShapeLayer = Transform & PaintStyle & { type: "shape"; tool: ShapeTool; width: number; height: number; bend: number };
export type PaintLayer = StrokeLayer | ShapeLayer;
export const MAX_PAINT_LAYERS = 32;
export const MAX_STROKE_POINTS = 256;
export const MAX_FINGER_POINTS = 4096;
export const MAX_ERASERS = 8;
export const isStrokeTool = (tool: DrawingTool): tool is StrokeTool => ["pen", "brush", "dots", "eraser", "glitter", "holo"].includes(tool);
