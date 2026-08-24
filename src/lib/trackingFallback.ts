export type TrackingDelegate = "GPU" | "CPU";
type StoppableTracker = { stop: () => void };

export type TrackerInitializationResult<T extends StoppableTracker> =
  | { status: "active"; tracker: T }
  | { status: "failed"; error: unknown }
  | { status: "stale" };

export async function initializeWithDelegateFallback<T>(
  create: (delegate: TrackingDelegate) => Promise<T>,
  report: (message: string, detail?: unknown) => void = () => undefined,
) {
  try {
    const instance = await create("GPU");
    report("GPU initialization succeeded");
    return instance;
  } catch (gpuError) {
    report("GPU initialization failed; retrying with CPU", gpuError);
    try {
      const instance = await create("CPU");
      report("CPU fallback succeeded");
      return instance;
    } catch (cpuError) {
      report("CPU fallback failed", cpuError);
      throw cpuError;
    }
  }
}

export async function initializeTrackerSafely<T extends StoppableTracker>(
  create: () => Promise<T>,
  isCameraCurrent: () => boolean,
): Promise<TrackerInitializationResult<T>> {
  try {
    const tracker = await create();
    if (!isCameraCurrent()) {
      tracker.stop();
      return { status: "stale" };
    }
    return { status: "active", tracker };
  } catch (error) {
    return { status: "failed", error };
  }
}
