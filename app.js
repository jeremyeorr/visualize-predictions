const xVariableSelect = document.getElementById('x-variable');
const interpretationText = document.getElementById('interpretation-text');
const lrPosValue = document.getElementById('lr-pos-value');
const lrNegValue = document.getElementById('lr-neg-value');
const exportStatus = document.getElementById('export-status');

const parameters = {
    prevalence: {
        label: 'Prevalence',
        min: 0.005,
        max: 1,
        slider: document.getElementById('prevalence'),
        input: document.getElementById('prevalence-input'),
        control: document.getElementById('prevalence-control')
    },
    sensitivity: {
        label: 'Sensitivity',
        min: 0.01,
        max: 0.99,
        slider: document.getElementById('sensitivity'),
        input: document.getElementById('sensitivity-input'),
        control: document.getElementById('sensitivity-control')
    },
    specificity: {
        label: 'Specificity',
        min: 0.01,
        max: 0.99,
        slider: document.getElementById('specificity'),
        input: document.getElementById('specificity-input'),
        control: document.getElementById('specificity-control')
    }
};

let probabilityChart = null;
let statusTimeout = null;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function trimTrailingZeros(value) {
    return value.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function formatPercentValue(probability, decimals = 1) {
    if (!Number.isFinite(probability)) return 'N/A';
    return `${trimTrailingZeros((probability * 100).toFixed(decimals))}%`;
}

function formatPercentInput(probability) {
    return trimTrailingZeros((probability * 100).toFixed(2));
}

function formatAxisPercent(probability) {
    const percent = probability * 100;

    if (percent < 1) return `${trimTrailingZeros(percent.toFixed(2))}%`;
    if (percent < 10) return `${trimTrailingZeros(percent.toFixed(1))}%`;
    return `${trimTrailingZeros(percent.toFixed(0))}%`;
}

function parsePercentInput(rawValue) {
    const normalized = String(rawValue).replace('%', '').trim();
    if (!normalized) return null;

    const percent = Number(normalized);
    if (!Number.isFinite(percent)) return null;

    return percent / 100;
}

function parameterValue(name) {
    return parseFloat(parameters[name].slider.value);
}

function currentScenario() {
    const prevalence = parameterValue('prevalence');
    const sensitivity = parameterValue('sensitivity');
    const specificity = parameterValue('specificity');
    const { lrPos, lrNeg } = calculateLikelihoodRatios(sensitivity, specificity);
    const positiveProbability = calculateProbability(prevalence, sensitivity, specificity, 'positive');
    const negativeProbability = calculateProbability(prevalence, sensitivity, specificity, 'negative');

    return {
        prevalence,
        sensitivity,
        specificity,
        lrPos,
        lrNeg,
        positiveProbability,
        negativeProbability
    };
}

function calculateLikelihoodRatios(sensitivity, specificity) {
    return {
        lrPos: sensitivity / (1 - specificity),
        lrNeg: (1 - sensitivity) / specificity
    };
}

function calculateProbability(prevalence, sensitivity, specificity, testResult) {
    if (testResult === 'positive') {
        const numerator = sensitivity * prevalence;
        const denominator = numerator + (1 - specificity) * (1 - prevalence);
        return numerator / denominator;
    }

    const numerator = (1 - sensitivity) * prevalence;
    const denominator = numerator + specificity * (1 - prevalence);
    return numerator / denominator;
}

function generatePlotData() {
    const xVar = xVariableSelect.value;
    const { prevalence, sensitivity, specificity } = currentScenario();
    let xValues = [];

    if (xVar === 'prevalence') {
        const logMin = Math.log10(parameters.prevalence.min);
        const logMax = Math.log10(parameters.prevalence.max);
        xValues = Array.from({ length: 100 }, (_, i) => {
            const logValue = logMin + (i * (logMax - logMin) / 99);
            return Math.pow(10, logValue);
        });
    } else {
        xValues = Array.from({ length: 100 }, (_, i) => 0.01 + (i * 0.98 / 99));
    }

    const positiveProbabilities = [];
    const negativeProbabilities = [];

    xValues.forEach(x => {
        const point = {
            prevalence,
            sensitivity,
            specificity
        };

        point[xVar] = x;

        positiveProbabilities.push(
            calculateProbability(point.prevalence, point.sensitivity, point.specificity, 'positive')
        );
        negativeProbabilities.push(
            calculateProbability(point.prevalence, point.sensitivity, point.specificity, 'negative')
        );
    });

    return {
        xValues,
        positiveProbabilities,
        negativeProbabilities,
        xLabel: parameters[xVar].label
    };
}

const chartBackgroundPlugin = {
    id: 'chartBackground',
    beforeDraw(chart, args, options) {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = options.color || '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
};

const crosshairPlugin = {
    id: 'crosshair',
    afterDraw(chart) {
        if (!chart.crosshair || chart.crosshair.x === undefined) return;

        const ctx = chart.ctx;
        const chartArea = chart.chartArea;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(chart.crosshair.x, chartArea.top);
        ctx.lineTo(chart.crosshair.x, chartArea.bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(31, 41, 55, 0.55)';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.restore();
    }
};

Chart.register(chartBackgroundPlugin, crosshairPlugin);

function createTooltipElement(chartId) {
    const existingTooltip = document.getElementById(`tooltip-${chartId}`);
    if (existingTooltip) return existingTooltip;

    const tooltip = document.createElement('div');
    tooltip.id = `tooltip-${chartId}`;
    tooltip.className = 'crosshair-tooltip';
    tooltip.style.display = 'none';

    document.getElementById(chartId).parentElement.appendChild(tooltip);
    return tooltip;
}

function setupCrosshairHandlers(chart, chartId) {
    const canvas = chart.canvas;
    const tooltip = createTooltipElement(chartId);

    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const chartArea = chart.chartArea;

        if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) {
            chart.crosshair = null;
            chart.update('none');
            tooltip.style.display = 'none';
            return;
        }

        chart.crosshair = { x };
        chart.update('none');

        const xScale = chart.scales.x;
        const xValue = xScale.getValueForPixel(x);
        const data = chart.data.datasets[0].data;
        let closestIndex = 0;
        let closestDistance = Infinity;

        for (let i = 0; i < data.length; i++) {
            const distance = Math.abs(data[i].x - xValue);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }

        let tooltipContent = `<div class="tooltip-x">${chart.options.scales.x.title.text}: ${formatPercentValue(data[closestIndex].x, 2)}</div>`;
        tooltipContent += '<div class="tooltip-y">';

        chart.data.datasets.forEach(ds => {
            const point = ds.data[closestIndex];
            if (!point) return;

            const colorClass = ds.label.toLowerCase().includes('positive')
                ? 'tooltip-positive'
                : 'tooltip-negative';
            tooltipContent += `<span class="${colorClass}">${ds.label}: ${formatPercentValue(point.y, 1)}</span>`;
        });

        tooltipContent += '</div>';
        tooltip.innerHTML = tooltipContent;
        tooltip.style.display = 'block';
        tooltip.style.left = `${x}px`;
        tooltip.style.bottom = `${canvas.height - chartArea.top + 10}px`;
        tooltip.style.top = 'auto';
    });

    canvas.addEventListener('mouseleave', function() {
        chart.crosshair = null;
        chart.update('none');
        tooltip.style.display = 'none';
    });
}

function updateCharts() {
    const { xValues, positiveProbabilities, negativeProbabilities, xLabel } = generatePlotData();
    const xVar = xVariableSelect.value;
    const isLogScale = xVar === 'prevalence';

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: true,
        animation: {
            duration: 300
        },
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            chartBackground: {
                color: '#ffffff'
            },
            legend: {
                display: true,
                position: 'top',
                labels: {
                    font: {
                        size: 13,
                        weight: 'bold'
                    },
                    padding: 15,
                    usePointStyle: true,
                    pointStyle: 'line'
                }
            },
            tooltip: {
                enabled: false
            }
        },
        scales: {
            x: {
                type: isLogScale ? 'logarithmic' : 'linear',
                min: isLogScale ? parameters.prevalence.min : 0.01,
                max: isLogScale ? parameters.prevalence.max : 0.99,
                title: {
                    display: true,
                    text: xLabel,
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                ticks: {
                    callback: function(value) {
                        return formatAxisPercent(Number(value));
                    }
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Post-test probability',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                min: 0,
                max: 1,
                ticks: {
                    callback: function(value) {
                        return formatAxisPercent(Number(value));
                    }
                }
            }
        }
    };

    const datasets = [
        {
            label: 'Positive test result',
            data: xValues.map((x, i) => ({ x, y: positiveProbabilities[i] })),
            borderColor: 'rgb(37, 99, 235)',
            backgroundColor: 'rgba(37, 99, 235, 0.10)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5
        },
        {
            label: 'Negative test result',
            data: xValues.map((x, i) => ({ x, y: negativeProbabilities[i] })),
            borderColor: 'rgb(190, 18, 60)',
            backgroundColor: 'rgba(190, 18, 60, 0.08)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5
        }
    ];

    if (!probabilityChart) {
        const ctx = document.getElementById('probability-chart').getContext('2d');

        probabilityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: xValues,
                datasets
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    title: {
                        display: true,
                        text: `Post-test probability by ${xLabel.toLowerCase()}`,
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        padding: 20
                    }
                }
            }
        });

        setupCrosshairHandlers(probabilityChart, 'probability-chart');
    } else {
        probabilityChart.options.scales.x.type = isLogScale ? 'logarithmic' : 'linear';
        probabilityChart.options.scales.x.min = isLogScale ? parameters.prevalence.min : 0.01;
        probabilityChart.options.scales.x.max = isLogScale ? parameters.prevalence.max : 0.99;
        probabilityChart.options.scales.x.title.text = xLabel;
        probabilityChart.options.plugins.title.text = `Post-test probability by ${xLabel.toLowerCase()}`;
        probabilityChart.data.labels = xValues;
        probabilityChart.data.datasets[0].data = datasets[0].data;
        probabilityChart.data.datasets[1].data = datasets[1].data;
        probabilityChart.update('none');
    }

    updateInterpretation(positiveProbabilities, negativeProbabilities, xValues);
}

function analyzeInflection(values, xValues) {
    const derivatives = [];

    for (let i = 1; i < values.length - 1; i++) {
        const dx = xValues[i + 1] - xValues[i - 1];
        const dy = values[i + 1] - values[i - 1];
        derivatives.push({
            x: xValues[i],
            y: values[i],
            derivative: dy / dx
        });
    }

    return derivatives.reduce((best, point) => {
        return Math.abs(point.derivative) > Math.abs(best.derivative) ? point : best;
    }, derivatives[0]);
}

function updateInterpretation(positiveProbabilities, negativeProbabilities, xValues) {
    const xVar = xVariableSelect.value;
    const scenario = currentScenario();
    const posInflection = analyzeInflection(positiveProbabilities, xValues);
    let interpretation = `At ${formatPercentValue(scenario.prevalence)} pre-test probability, a positive result raises the estimated probability of disease to ${formatPercentValue(scenario.positiveProbability)} and a negative result lowers it to ${formatPercentValue(scenario.negativeProbability)}. `;

    if (xVar === 'prevalence') {
        interpretation += `With sensitivity ${formatPercentValue(scenario.sensitivity)} and specificity ${formatPercentValue(scenario.specificity)}, the positive-result curve changes fastest near ${formatPercentValue(posInflection.x, 2)} pre-test probability.`;
    } else if (xVar === 'sensitivity') {
        interpretation += `Across the sensitivity range, the negative-result probability moves from ${formatPercentValue(negativeProbabilities[0])} to ${formatPercentValue(negativeProbabilities[negativeProbabilities.length - 1])}.`;
    } else if (xVar === 'specificity') {
        interpretation += `Across the specificity range, the positive-result probability moves from ${formatPercentValue(positiveProbabilities[0])} to ${formatPercentValue(positiveProbabilities[positiveProbabilities.length - 1])}.`;
    }

    interpretationText.textContent = interpretation;
}

function updateControlVisibility() {
    const xVar = xVariableSelect.value;

    Object.values(parameters).forEach(parameter => {
        parameter.control.classList.remove('hidden');
    });

    parameters[xVar].control.classList.add('hidden');
}

function updateLRDisplay() {
    const { lrPos, lrNeg } = currentScenario();
    lrPosValue.textContent = lrPos.toFixed(2);
    lrNegValue.textContent = lrNeg.toFixed(2);
}

function setParameterValue(name, value, formatInput = true) {
    const parameter = parameters[name];
    const nextValue = clamp(value, parameter.min, parameter.max);

    parameter.slider.value = nextValue.toFixed(4);

    if (formatInput) {
        parameter.input.value = formatPercentInput(nextValue);
    }
}

function updateAllInputDisplays() {
    Object.keys(parameters).forEach(name => {
        setParameterValue(name, parameterValue(name), true);
    });
}

function buildPermalink() {
    const url = new URL(window.location.href);
    url.searchParams.set('x', xVariableSelect.value);

    Object.keys(parameters).forEach(name => {
        url.searchParams.set(name, formatPercentInput(parameterValue(name)));
    });

    return url.toString();
}

function updatePermalink() {
    window.history.replaceState(null, '', buildPermalink());
}

function refreshCalculations(options = {}) {
    const { formatInputs = true } = options;

    if (formatInputs) updateAllInputDisplays();
    updateLRDisplay();
    updateCharts();
    updatePermalink();
}

function loadPermalinkParameters() {
    const query = new URLSearchParams(window.location.search);
    const xVar = query.get('x');

    if (xVar && parameters[xVar]) {
        xVariableSelect.value = xVar;
    }

    Object.keys(parameters).forEach(name => {
        const rawValue = query.get(name);
        if (!rawValue) return;

        const normalized = String(rawValue).replace('%', '').trim();
        const numericValue = Number(normalized);
        if (!Number.isFinite(numericValue)) return;

        const value = Math.abs(numericValue) > 1 ? numericValue / 100 : numericValue;
        setParameterValue(name, value, true);
    });
}

function csvEscape(value) {
    const text = String(value);
    if (!/[",\n]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function timestampForFilename() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function buildCalculationText() {
    const scenario = currentScenario();

    return [
        'Post-Test Probability Explorer',
        `Pre-test probability: ${formatPercentValue(scenario.prevalence, 2)}`,
        `Sensitivity: ${formatPercentValue(scenario.sensitivity, 2)}`,
        `Specificity: ${formatPercentValue(scenario.specificity, 2)}`,
        `LR+: ${scenario.lrPos.toFixed(2)}`,
        `LR-: ${scenario.lrNeg.toFixed(2)}`,
        `Positive result post-test probability: ${formatPercentValue(scenario.positiveProbability, 2)}`,
        `Negative result post-test probability: ${formatPercentValue(scenario.negativeProbability, 2)}`,
        `Permalink: ${buildPermalink()}`
    ].join('\n');
}

function buildCsv() {
    const { xValues, positiveProbabilities, negativeProbabilities, xLabel } = generatePlotData();
    const rows = [
        [
            'x_variable',
            'x_percent',
            'positive_result_post_test_probability_percent',
            'negative_result_post_test_probability_percent'
        ]
    ];

    xValues.forEach((x, index) => {
        rows.push([
            xLabel,
            formatPercentInput(x),
            formatPercentInput(positiveProbabilities[index]),
            formatPercentInput(negativeProbabilities[index])
        ]);
    });

    return rows.map(row => row.map(csvEscape).join(',')).join('\n');
}

async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            // Fall through to the textarea copy path for browsers that deny clipboard access.
        }
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
}

function showStatus(message) {
    exportStatus.textContent = message;
    window.clearTimeout(statusTimeout);
    statusTimeout = window.setTimeout(() => {
        exportStatus.textContent = '';
    }, 3500);
}

Object.keys(parameters).forEach(name => {
    const parameter = parameters[name];

    parameter.slider.addEventListener('input', () => {
        setParameterValue(name, parseFloat(parameter.slider.value), true);
        refreshCalculations({ formatInputs: false });
    });

    parameter.input.addEventListener('input', () => {
        const parsedValue = parsePercentInput(parameter.input.value);
        if (parsedValue === null) return;

        setParameterValue(name, parsedValue, false);
        refreshCalculations({ formatInputs: false });
    });

    parameter.input.addEventListener('blur', () => {
        const parsedValue = parsePercentInput(parameter.input.value);
        setParameterValue(name, parsedValue === null ? parameterValue(name) : parsedValue, true);
        refreshCalculations({ formatInputs: false });
    });
});

xVariableSelect.addEventListener('change', () => {
    updateControlVisibility();
    refreshCalculations();
});

document.getElementById('copy-calculation').addEventListener('click', async () => {
    await copyText(buildCalculationText());
    showStatus('Calculation copied.');
});

document.getElementById('export-png').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = probabilityChart.toBase64Image('image/png', 1);
    link.download = `post-test-probability-${timestampForFilename()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showStatus('PNG exported.');
});

document.getElementById('export-csv').addEventListener('click', () => {
    downloadBlob(buildCsv(), 'text/csv;charset=utf-8', `post-test-probability-${timestampForFilename()}.csv`);
    showStatus('CSV exported.');
});

document.getElementById('copy-link').addEventListener('click', async () => {
    await copyText(buildPermalink());
    showStatus('Link copied.');
});

loadPermalinkParameters();
updateControlVisibility();
refreshCalculations();
