import type { NailLandmark } from "./nailGeometry";
import type { NailPose } from "./types";

// Physical screen coordinates use frame height as the common unit for x/y.
// This is a projected reference frame, not an estimate of distance in metres.
export type HandReference = { x: number; y: number; scale: number; angle: number; aspect: number };

export function handReference(landmarks: NailLandmark[], mirrored: boolean, aspect: number): HandReference | undefined {
  if (landmarks.length < 21 || !Number.isFinite(aspect) || aspect <= 0) return;
  const points = [0, 5, 9, 13, 17].map((index) => ({
    x: (mirrored ? 1 - landmarks[index].x : landmarks[index].x) * aspect,
    y: landmarks[index].y,
  }));
  if (!points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) return;
  const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const scale = Math.sqrt(points.reduce((sum, point) => sum + (point.x - x) ** 2 + (point.y - y) ** 2, 0) / points.length);
  const dx = points[2].x - points[0].x, dy = points[2].y - points[0].y;
  if (scale < 0.0001 || Math.hypot(dx, dy) < scale * 0.2) return;
  return { x, y, scale, angle: Math.atan2(dy, dx), aspect };
}

export function nailInHandFrame(nail: NailPose, frame: HandReference): NailPose {
  const dx = nail.x / 100 * frame.aspect - frame.x, dy = nail.y / 100 - frame.y;
  const cosine = Math.cos(frame.angle), sine = Math.sin(frame.angle);
  return { ...nail,
    x: (dx * cosine + dy * sine) / frame.scale * 100,
    y: (-dx * sine + dy * cosine) / frame.scale * 100,
    width: nail.width * frame.aspect / frame.scale,
    height: nail.height / frame.scale,
    ...(nail.anchorHeight === undefined ? {} : { anchorHeight: nail.anchorHeight / frame.scale }),
    rotation: nail.rotation - frame.angle * 180 / Math.PI,
  };
}

export function nailFromHandFrame(nail: NailPose, frame: HandReference): NailPose {
  const x = nail.x / 100 * frame.scale, y = nail.y / 100 * frame.scale;
  const cosine = Math.cos(frame.angle), sine = Math.sin(frame.angle);
  return { ...nail,
    x: (frame.x + x * cosine - y * sine) / frame.aspect * 100,
    y: (frame.y + x * sine + y * cosine) * 100,
    width: nail.width * frame.scale / frame.aspect,
    height: nail.height * frame.scale,
    ...(nail.anchorHeight === undefined ? {} : { anchorHeight: nail.anchorHeight * frame.scale }),
    rotation: ((nail.rotation + frame.angle * 180 / Math.PI + 540) % 360) - 180,
  };
}
