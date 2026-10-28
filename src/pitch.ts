/** Normalized autocorrelation with a silence gate and first strong peak selection. */
export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  let power = 0, mean = 0;
  for (const value of samples) mean += value;
  mean /= samples.length;
  for (const value of samples) power += (value - mean) ** 2;
  if (Math.sqrt(power / samples.length) < .008) return null;
  const minLag = Math.floor(sampleRate / 1000);
  const maxLag = Math.min(Math.ceil(sampleRate / 65), samples.length >> 1);
  const correlations = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let cross = 0, a = 0, b = 0;
    for (let i = 0; i < samples.length - maxLag; i += 2) {
      const x = samples[i] - mean, y = samples[i + lag] - mean;
      cross += x * y; a += x * x; b += y * y;
    }
    correlations[lag] = cross / Math.sqrt(a * b || 1);
  }
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    const left = correlations[lag - 1], mid = correlations[lag], right = correlations[lag + 1];
    if (mid > .85 && mid > left && mid >= right) {
      const offset = .5 * (left - right) / (left - 2 * mid + right || 1);
      return sampleRate / (lag + offset);
    }
  }
  return null;
}
