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
 * @returns {{ appendPoint: (t: number, values: Record<string, number>) => void, clear: () => void, setYRange: (min?: number, max?: number) => void, setBounds: (bounds: { xMin?: number, xMax?: number, yMin?: number, yMax?: number }) => void }}
 */
export function createGraphManager(canvas, config) {
  const { xLabel = 'Time (s)', yLabel = 'Value', datasets: datasetDefs, maxPoints = 500 } = config;
  const ctx = canvas.getContext('2d');
  if (!ctx || !Chart) return { appendPoint: () => {}, clear: () => {}, setYRange: () => {}, setBounds: () => {} };

  const dualAxis = datasetDefs.length >= 2;

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
    ...(dualAxis && { yAxisID: i === 0 ? 'y' : 'y1' }),
  }));

  const zeroLineColor = 'rgba(150, 150, 150, 0.8)';
  const baseYScale = {
    type: 'linear',
    beginAtZero: false,
    grid: {
      color: (ctx) => (ctx.tick.value === 0 ? zeroLineColor : undefined),
      lineWidth: (ctx) => (ctx.tick.value === 0 ? 1.5 : 1),
    },
  };

  const axisLabelFont = { size: 15 };
  const scales = {
    x: {
      title: { display: true, text: xLabel, font: axisLabelFont },
      type: 'linear',
      min: 0,
      max: 1,
      position: 'bottom',
      ticks: { font: { size: 13 } },
    },
    y: {
      ...baseYScale,
      title: {
        display: true,
        text: dualAxis ? (datasetDefs[0].label + (datasetDefs[0].unit ? ` (${datasetDefs[0].unit})` : '')) : yLabel,
        font: axisLabelFont,
      },
      position: dualAxis ? 'left' : undefined,
      ticks: { font: { size: 13 } },
    },
    ...(dualAxis && {
      y1: {
        ...baseYScale,
        title: {
          display: true,
          text: datasetDefs[1].label + (datasetDefs[1].unit ? ` (${datasetDefs[1].unit})` : ''),
          font: axisLabelFont,
        },
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { font: { size: 13 } },
      },
    }),
  };

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
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 14 } },
        },
      },
      scales,
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

  function setBounds(bounds) {
    const xOpts = chart.options.scales?.x;
    const yOpts = chart.options.scales?.y;
    const y1Opts = chart.options.scales?.y1;
    if (xOpts) {
      if (bounds.xMin != null) xOpts.min = bounds.xMin;
      if (bounds.xMax != null) xOpts.max = bounds.xMax;
    }
    if (yOpts) {
      if (bounds.yMin != null) yOpts.min = bounds.yMin;
      if (bounds.yMax != null) yOpts.max = bounds.yMax;
    }
    if (y1Opts) {
      if (bounds.y1Min != null) y1Opts.min = bounds.y1Min;
      if (bounds.y1Max != null) y1Opts.max = bounds.y1Max;
    }
    chart.update('none');
  }

  return { appendPoint, clear, setYRange, setBounds, chart };
}
