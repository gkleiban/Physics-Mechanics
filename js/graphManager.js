/**
 * Reusable real-time graph: Chart.js line chart with multiple datasets,
 * appendPoint / clear, axis labels, legend.
 */

const Chart = window.Chart;

const DEFAULT_COLORS = [
  '#7cafc2',
  '#c27c7c',
  '#7cc27c',
  '#c2a67c',
  '#a67cc2',
];

/**
 * @typedef {Object} DatasetDef
 * @property {string} id - Unique id (used when appending data)
 * @property {string} label - Legend label
 * @property {string} [unit] - Optional unit for axis/tooltip
 * @property {string} [color] - Hex color
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ xLabel?: string, yLabel?: string, datasets: DatasetDef[], maxPoints?: number }} config
 * @returns {{ appendPoint: (t: number, values: Record<string, number>) => void, clear: () => void, setYRange: (min?: number, max?: number) => void }}
 */
export function createGraphManager(canvas, config) {
  const { xLabel = 'Time (s)', yLabel = 'Value', datasets: datasetDefs, maxPoints = 500 } = config;
  const ctx = canvas.getContext('2d');
  if (!ctx || !Chart) return { appendPoint: () => {}, clear: () => {}, setYRange: () => {} };

  const chartDatasets = datasetDefs.map((def, i) => ({
    id: def.id,
    label: def.label + (def.unit ? ` (${def.unit})` : ''),
    data: [],
    borderColor: def.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    backgroundColor: (def.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]) + '33',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0,
    fill: false,
  }));

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: chartDatasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: true, position: 'top' },
      },
      scales: {
        x: {
          title: { display: true, text: xLabel },
          type: 'linear',
          min: 0,
        },
        y: {
          title: { display: true, text: yLabel },
          type: 'linear',
          beginAtZero: false,
        },
      },
    },
  });

  const datasets = chart.data.datasets;

  function appendPoint(t, values) {
    for (const ds of datasets) {
      const v = values[ds.id];
      ds.data.push({ x: t, y: v != null ? v : null });
    }
    const len = datasets[0]?.data.length ?? 0;
    if (len > maxPoints) {
      for (const ds of datasets) ds.data.shift();
    }
    chart.update('none');
  }

  function clear() {
    for (const ds of datasets) ds.data.length = 0;
    chart.update('none');
  }

  function setYRange(min, max) {
    const opts = chart.options.scales?.y;
    if (opts) {
      if (min != null) opts.min = min;
      if (max != null) opts.max = max;
      chart.update('none');
    }
  }

  return { appendPoint, clear, setYRange, chart };
}
