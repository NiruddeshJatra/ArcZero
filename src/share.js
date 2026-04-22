/**
 * Share payload builder for ArcZero daily runs.
 */

/**
 * Build the shareable text block for a daily run.
 * @param {{ score: number, level: number, longestChain: number, closestMissM: number, dateISO: string }} runResult
 * @param {Array<{ intercepts: number, spawns: number } | undefined>} waveStats - index 0–9 for waves 1–10
 * @returns {string}
 */
export function buildShareText(runResult, waveStats) {
  const grid = Array.from({ length: 10 }, (_, i) => {
    const w = waveStats[i];
    if (!w) return '⬛';
    const acc = w.intercepts / Math.max(1, w.spawns);
    if (acc >= 0.8) return '🟩';
    if (acc >= 0.5) return '🟨';
    if (acc >= 0.3) return '🟧';
    return '⬛';
  }).join('');

  const closest =
    (runResult.closestMissM == null || runResult.closestMissM === Infinity)
      ? 'no near-misses'
      : runResult.closestMissM.toFixed(1) + 'm';

  return [
    `ArcZero · Daily ${runResult.dateISO}`,
    `Score ${runResult.score} · Lv ${runResult.level} · Chain ×${runResult.longestChain} · Closest ${closest}`,
    grid,
    `arczero.app/?seed=${runResult.dateISO}`,
  ].join('\n');
}
