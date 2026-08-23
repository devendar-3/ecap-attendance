/** Great-circle distance between two coordinates, in metres. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** GPS accuracy we are willing to forgive when checking the fence, in metres. */
export const ACCURACY_TOLERANCE_M = 75;

export const MIN_RADIUS_M = 5;
export const MAX_RADIUS_M = 5000;

/** Presets sized to real rooms — 100 m covers a whole building, so it is not the default. */
export const RADIUS_OPTIONS = [
  { value: 10, label: "10 m — one classroom" },
  { value: 20, label: "20 m — large classroom / lab" },
  { value: 40, label: "40 m — lecture hall" },
  { value: 75, label: "75 m — floor / wing" },
  { value: 150, label: "150 m — whole building" },
] as const;

export const DEFAULT_RADIUS_M = 20;

export function readPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device can't share its location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 0,
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was blocked. Allow location access and try again."
              : "Could not get your location. Move somewhere with a clearer signal and retry.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
