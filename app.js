const xVariableSelect = document.getElementById('x-variable');
const xAxisSection = document.getElementById('x-axis-section');
const lrPosValue = document.getElementById('lr-pos-value');
const lrNegValue = document.getElementById('lr-neg-value');
const exportStatus = document.getElementById('export-status');
const parameterSectionHeading = document.getElementById('parameter-section-heading');
const prevalenceLabel = document.getElementById('prevalence-label');
const tabButtons = document.querySelectorAll('.tab-button');
const pointPanel = document.getElementById('point-panel');
const bayesianPanel = document.getElementById('bayesian-panel');
const naturalFrequencyContext = document.getElementById('natural-frequency-context');
const naturalFrequencyFields = {
    truePositive: document.getElementById('true-positive-count'),
    falsePositive: document.getElementById('false-positive-count'),
    falseNegative: document.getElementById('false-negative-count'),
    trueNegative: document.getElementById('true-negative-count'),
    ppv: document.getElementById('ppv-value'),
    npv: document.getElementById('npv-value')
};

const parameters = {
    prevalence: {
        label: 'Pre-test probability',
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

const priorStrength = {
    min: 1,
    max: 100,
    defaultValue: 20,
    slider: document.getElementById('prior-strength'),
    input: document.getElementById('prior-strength-input'),
    control: document.getElementById('prior-strength-control')
};

let activeTab = 'point';
let probabilityChart = null;
let bayesianChart = null;
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

function formatFrequencyCount(value) {
    if (!Number.isFinite(value)) return 'N/A';
    return `${Math.round(value).toLocaleString()} patients`;
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

function parsePriorStrength(rawValue) {
    const strength = Number(String(rawValue).trim());
    if (!Number.isFinite(strength)) return null;
    return strength;
}

function parameterValue(name) {
    return parseFloat(parameters[name].slider.value);
}

function priorStrengthValue() {
    return parseInt(priorStrength.slider.value, 10);
}

function confidenceToPriorStrength(confidence) {
    const normalized = clamp(confidence, priorStrength.min, priorStrength.max) / priorStrength.max;
    return 2 + normalized * normalized * 498;
}

function buildScenario(prevalence, sensitivity, specificity) {
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

function currentScenario() {
    return buildScenario(
        parameterValue('prevalence'),
        parameterValue('sensitivity'),
        parameterValue('specificity')
    );
}

function scenarioForChartPoint(xValue) {
    const values = {
        prevalence: parameterValue('prevalence'),
        sensitivity: parameterValue('sensitivity'),
        specificity: parameterValue('specificity')
    };
    const xVar = xVariableSelect.value;

    values[xVar] = clamp(xValue, 0, 1);
    return buildScenario(values.prevalence, values.sensitivity, values.specificity);
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
        return denominator > 0 ? numerator / denominator : Number.NaN;
    }

    const numerator = (1 - sensitivity) * prevalence;
    const denominator = numerator + specificity * (1 - prevalence);
    return denominator > 0 ? numerator / denominator : Number.NaN;
}

function safeRatio(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : Number.NaN;
}

function calculateNaturalFrequencies(scenario = currentScenario()) {
    const cohortSize = 1000;
    const diseased = scenario.prevalence * cohortSize;
    const nonDiseased = cohortSize - diseased;
    const truePositive = diseased * scenario.sensitivity;
    const falseNegative = diseased * (1 - scenario.sensitivity);
    const trueNegative = nonDiseased * scenario.specificity;
    const falsePositive = nonDiseased * (1 - scenario.specificity);
    const ppv = safeRatio(truePositive, truePositive + falsePositive);
    const npv = safeRatio(trueNegative, trueNegative + falseNegative);

    return {
        cohortSize,
        diseased,
        nonDiseased,
        truePositive,
        falsePositive,
        falseNegative,
        trueNegative,
        ppv,
        npv
    };
}

function describeNaturalFrequencyScenario(scenario, label) {
    return `${label}: pre-test probability ${formatPercentValue(scenario.prevalence, 2)}, sensitivity ${formatPercentValue(scenario.sensitivity, 2)}, specificity ${formatPercentValue(scenario.specificity, 2)}.`;
}

function updateNaturalFrequencyTable(scenario = currentScenario(), label = 'Selected point') {
    const frequencies = calculateNaturalFrequencies(scenario);

    naturalFrequencyContext.textContent = describeNaturalFrequencyScenario(scenario, label);
    naturalFrequencyFields.truePositive.textContent = formatFrequencyCount(frequencies.truePositive);
    naturalFrequencyFields.falsePositive.textContent = formatFrequencyCount(frequencies.falsePositive);
    naturalFrequencyFields.falseNegative.textContent = formatFrequencyCount(frequencies.falseNegative);
    naturalFrequencyFields.trueNegative.textContent = formatFrequencyCount(frequencies.trueNegative);
    naturalFrequencyFields.ppv.textContent = formatPercentValue(frequencies.ppv);
    naturalFrequencyFields.npv.textContent = formatPercentValue(frequencies.npv);
}

function generatePlotData() {
    const xVar = xVariableSelect.value;
    const { prevalence, sensitivity, specificity } = currentScenario();
    let xValues = [];

    xValues = Array.from({ length: 101 }, (_, i) => i / 100);

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

function logGamma(value) {
    const coefficients = [
        676.5203681218851,
        -1259.1392167224028,
        771.3234287776531,
        -176.6150291621406,
        12.507343278686905,
        -0.13857109526572012,
        9.984369578019572e-6,
        1.5056327351493116e-7
    ];

    if (value < 0.5) {
        return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
    }

    let x = 0.9999999999998099;
    const shifted = value - 1;

    for (let i = 0; i < coefficients.length; i++) {
        x += coefficients[i] / (shifted + i + 1);
    }

    const t = shifted + coefficients.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaPdf(probability, alpha, beta) {
    const p = clamp(probability, 1e-8, 1 - 1e-8);
    const logBeta = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
    const logDensity = (alpha - 1) * Math.log(p) + (beta - 1) * Math.log1p(-p) - logBeta;
    const density = Math.exp(logDensity);

    return Number.isFinite(density) ? density : 0;
}

function normalizeWeights(weights) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);

    if (!Number.isFinite(total) || total <= 0) {
        return weights.map(() => 1 / weights.length);
    }

    return weights.map(weight => weight / total);
}

function normalizeDensity(values) {
    const maxValue = Math.max(...values);
    if (!Number.isFinite(maxValue) || maxValue <= 0) return values.map(() => 0);

    return values.map(value => value / maxValue);
}

function gaussianSmooth(values, sigma) {
    const radius = Math.max(2, Math.ceil(sigma * 4));
    const kernel = [];
    let kernelTotal = 0;

    for (let offset = -radius; offset <= radius; offset++) {
        const weight = Math.exp(-(offset * offset) / (2 * sigma * sigma));
        kernel.push(weight);
        kernelTotal += weight;
    }

    return values.map((value, index) => {
        let smoothedValue = 0;
        let smoothedWeight = 0;

        kernel.forEach((weight, kernelIndex) => {
            const sourceIndex = index + kernelIndex - radius;
            if (sourceIndex < 0 || sourceIndex >= values.length) return;

            smoothedValue += values[sourceIndex] * weight;
            smoothedWeight += weight;
        });

        return smoothedWeight > 0 ? smoothedValue / smoothedWeight : value;
    });
}

function binWeightedDistribution(values, weights, binCount, smoothingSigma = 5) {
    const bins = Array.from({ length: binCount }, () => 0);

    values.forEach((value, index) => {
        const scaledIndex = clamp(value, 0, 1) * (binCount - 1);
        const lowerIndex = Math.floor(scaledIndex);
        const upperIndex = Math.min(binCount - 1, lowerIndex + 1);
        const upperWeight = scaledIndex - lowerIndex;
        const lowerWeight = 1 - upperWeight;

        bins[lowerIndex] += weights[index] * lowerWeight;
        bins[upperIndex] += weights[index] * upperWeight;
    });

    return normalizeDensity(gaussianSmooth(bins, smoothingSigma));
}

function weightedQuantile(values, weights, quantile) {
    const paired = values
        .map((value, index) => ({ value, weight: weights[index] }))
        .sort((a, b) => a.value - b.value);
    const target = weights.reduce((sum, weight) => sum + weight, 0) * quantile;
    let cumulative = 0;

    for (const point of paired) {
        cumulative += point.weight;
        if (cumulative >= target) return point.value;
    }

    return paired[paired.length - 1].value;
}

function summarizeWeightedDistribution(values, weights) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const mean = values.reduce((sum, value, index) => sum + value * weights[index], 0) / total;

    return {
        mean,
        median: weightedQuantile(values, weights, 0.5),
        lower: weightedQuantile(values, weights, 0.025),
        upper: weightedQuantile(values, weights, 0.975)
    };
}

function generateBayesianData() {
    const scenario = currentScenario();
    const confidence = priorStrengthValue();
    const strength = confidenceToPriorStrength(confidence);
    const priorMean = clamp(scenario.prevalence, 1e-6, 1 - 1e-6);
    const alpha = clamp(priorMean * strength, 1e-6, Number.POSITIVE_INFINITY);
    const beta = clamp((1 - priorMean) * strength, 1e-6, Number.POSITIVE_INFINITY);
    const sampleCount = 6000;
    const binCount = 401;
    const priorValues = Array.from({ length: sampleCount }, (_, index) => (index + 0.5) / sampleCount);
    const priorWeights = normalizeWeights(priorValues.map(value => betaPdf(value, alpha, beta)));
    const positiveValues = priorValues.map(value => calculateProbability(value, scenario.sensitivity, scenario.specificity, 'positive'));
    const negativeValues = priorValues.map(value => calculateProbability(value, scenario.sensitivity, scenario.specificity, 'negative'));
    const probabilityValues = Array.from({ length: binCount }, (_, index) => index / (binCount - 1));

    return {
        scenario,
        confidence,
        strength,
        alpha,
        beta,
        probabilityValues,
        priorDensity: binWeightedDistribution(priorValues, priorWeights, binCount, 3),
        positiveDensity: binWeightedDistribution(positiveValues, priorWeights, binCount, 6),
        negativeDensity: binWeightedDistribution(negativeValues, priorWeights, binCount, 6),
        summaries: {
            prior: summarizeWeightedDistribution(priorValues, priorWeights),
            positive: summarizeWeightedDistribution(positiveValues, priorWeights),
            negative: summarizeWeightedDistribution(negativeValues, priorWeights)
        }
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

function setupCrosshairHandlers(chart, chartId, mode = 'probability', options = {}) {
    const canvas = chart.canvas;
    const tooltip = createTooltipElement(chartId);
    const { onHoverPoint, onLeave } = options;

    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const chartArea = chart.chartArea;

        if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) {
            chart.crosshair = null;
            chart.update('none');
            tooltip.style.display = 'none';
            if (typeof onLeave === 'function') onLeave();
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

        const closestPoint = data[closestIndex];
        const hoverScenario = mode === 'probability' ? scenarioForChartPoint(closestPoint.x) : null;

        if (hoverScenario && typeof onHoverPoint === 'function') {
            onHoverPoint(hoverScenario);
        }

        let tooltipContent = `<div class="tooltip-x">${chart.options.scales.x.title.text}: ${formatPercentValue(data[closestIndex].x, 2)}</div>`;
        tooltipContent += '<div class="tooltip-y">';

        chart.data.datasets.forEach(ds => {
            const point = ds.data[closestIndex];
            if (!point) return;

            const colorClass = ds.label.toLowerCase().includes('positive')
                ? 'tooltip-positive'
                : ds.label.toLowerCase().includes('negative')
                    ? 'tooltip-negative'
                    : 'tooltip-prior';
            const formattedValue = mode === 'density'
                ? point.y.toFixed(2)
                : formatPercentValue(point.y, 1);
            tooltipContent += `<span class="${colorClass}">${ds.label}: ${formattedValue}</span>`;
        });

        tooltipContent += '</div>';

        if (hoverScenario) {
            const frequencies = calculateNaturalFrequencies(hoverScenario);
            tooltipContent += '<div class="tooltip-frequency">';
            tooltipContent += `<span>Per 1,000: TP ${Math.round(frequencies.truePositive).toLocaleString()}, FP ${Math.round(frequencies.falsePositive).toLocaleString()}</span>`;
            tooltipContent += `<span>FN ${Math.round(frequencies.falseNegative).toLocaleString()}, TN ${Math.round(frequencies.trueNegative).toLocaleString()}</span>`;
            tooltipContent += `<span>PPV ${formatPercentValue(frequencies.ppv)}, NPV ${formatPercentValue(frequencies.npv)}</span>`;
            tooltipContent += '</div>';
        }

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
        if (typeof onLeave === 'function') onLeave();
    });
}

function pointChartOptions(xLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
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
            title: {
                display: true,
                text: `Post-test probability by ${xLabel.toLowerCase()}`,
                font: {
                    size: 18,
                    weight: 'bold'
                },
                padding: 20
            },
            tooltip: {
                enabled: false
            }
        },
        scales: {
            x: {
                type: 'linear',
                min: 0,
                max: 1,
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
}

function updatePointChart() {
    const { xValues, positiveProbabilities, negativeProbabilities, xLabel } = generatePlotData();
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
            options: pointChartOptions(xLabel)
        });

        setupCrosshairHandlers(probabilityChart, 'probability-chart', 'probability', {
            onHoverPoint: scenario => updateNaturalFrequencyTable(scenario, 'Hovered point'),
            onLeave: () => updateNaturalFrequencyTable()
        });
    } else {
        probabilityChart.options.scales.x.type = 'linear';
        probabilityChart.options.scales.x.min = 0;
        probabilityChart.options.scales.x.max = 1;
        probabilityChart.options.scales.x.title.text = xLabel;
        probabilityChart.options.plugins.title.text = `Post-test probability by ${xLabel.toLowerCase()}`;
        probabilityChart.data.labels = xValues;
        probabilityChart.data.datasets[0].data = datasets[0].data;
        probabilityChart.data.datasets[1].data = datasets[1].data;
        probabilityChart.update('none');
    }

    updateNaturalFrequencyTable();
}

function bayesianChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
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
            title: {
                display: true,
                text: 'Prior and posterior disease-risk distributions',
                font: {
                    size: 18,
                    weight: 'bold'
                },
                padding: 20
            },
            tooltip: {
                enabled: false
            }
        },
        scales: {
            x: {
                type: 'linear',
                min: 0,
                max: 1,
                title: {
                    display: true,
                    text: 'Disease probability',
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
                    text: 'Relative density',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                min: 0,
                max: 1.05,
                ticks: {
                    callback: function(value) {
                        return Number(value).toFixed(1);
                    }
                }
            }
        }
    };
}

function updateBayesianChart() {
    const data = generateBayesianData();
    const datasets = [
        {
            label: 'Prior',
            data: data.probabilityValues.map((x, i) => ({ x, y: data.priorDensity[i] })),
            borderColor: 'rgb(15, 118, 110)',
            backgroundColor: 'rgba(15, 118, 110, 0.08)',
            borderWidth: 3,
            fill: false,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4
        },
        {
            label: 'Positive result posterior',
            data: data.probabilityValues.map((x, i) => ({ x, y: data.positiveDensity[i] })),
            borderColor: 'rgb(37, 99, 235)',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            borderWidth: 3,
            fill: false,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4
        },
        {
            label: 'Negative result posterior',
            data: data.probabilityValues.map((x, i) => ({ x, y: data.negativeDensity[i] })),
            borderColor: 'rgb(190, 18, 60)',
            backgroundColor: 'rgba(190, 18, 60, 0.08)',
            borderWidth: 3,
            fill: false,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4
        }
    ];

    if (!bayesianChart) {
        const ctx = document.getElementById('bayesian-chart').getContext('2d');

        bayesianChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.probabilityValues,
                datasets
            },
            options: bayesianChartOptions()
        });

        setupCrosshairHandlers(bayesianChart, 'bayesian-chart', 'density');
    } else {
        bayesianChart.data.labels = data.probabilityValues;
        bayesianChart.data.datasets[0].data = datasets[0].data;
        bayesianChart.data.datasets[1].data = datasets[1].data;
        bayesianChart.data.datasets[2].data = datasets[2].data;
        bayesianChart.update('none');
    }

    updateBayesianSummary(data);
}

function formatInterval(summary) {
    return `${formatPercentValue(summary.lower)} to ${formatPercentValue(summary.upper)}`;
}

function updateSummaryCard(prefix, summary) {
    document.getElementById(`${prefix}-mean-value`).textContent = formatPercentValue(summary.mean);
    document.getElementById(`${prefix}-median-value`).textContent = formatPercentValue(summary.median);
    document.getElementById(`${prefix}-interval-value`).textContent = formatInterval(summary);
}

function updateBayesianSummary(data) {
    const { summaries } = data;

    updateSummaryCard('prior', summaries.prior);
    updateSummaryCard('positive', summaries.positive);
    updateSummaryCard('negative', summaries.negative);
}

function updateControlVisibility() {
    if (activeTab === 'bayesian') {
        parameterSectionHeading.textContent = 'Prior and Test Inputs';
        prevalenceLabel.textContent = 'Pre-test probability / prior mean';
        xAxisSection.classList.add('hidden');
        priorStrength.control.classList.remove('hidden');
        Object.values(parameters).forEach(parameter => {
            parameter.control.classList.remove('hidden');
        });
        return;
    }

    parameterSectionHeading.textContent = 'Point Estimate Inputs';
    prevalenceLabel.textContent = 'Pre-test probability';
    xAxisSection.classList.remove('hidden');
    priorStrength.control.classList.add('hidden');
    Object.values(parameters).forEach(parameter => {
        parameter.control.classList.remove('hidden');
    });

    parameters[xVariableSelect.value].control.classList.add('hidden');
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

function setPriorStrengthValue(value, formatInput = true) {
    const nextValue = Math.round(clamp(value, priorStrength.min, priorStrength.max));

    priorStrength.slider.value = String(nextValue);

    if (formatInput) {
        priorStrength.input.value = String(nextValue);
    }
}

function updateAllInputDisplays() {
    Object.keys(parameters).forEach(name => {
        setParameterValue(name, parameterValue(name), true);
    });
    setPriorStrengthValue(priorStrengthValue(), true);
}

function buildPermalink() {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    url.searchParams.set('x', xVariableSelect.value);
    url.searchParams.set('priorStrength', priorStrengthValue());

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

    if (activeTab === 'bayesian') {
        updateBayesianChart();
    } else {
        updatePointChart();
    }

    updatePermalink();
}

function setActiveTab(nextTab, options = {}) {
    activeTab = nextTab === 'bayesian' ? 'bayesian' : 'point';

    tabButtons.forEach(button => {
        const isActive = button.dataset.tab === activeTab;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', String(isActive));
    });

    pointPanel.classList.toggle('hidden', activeTab !== 'point');
    bayesianPanel.classList.toggle('hidden', activeTab !== 'bayesian');
    updateControlVisibility();

    if (!options.skipRefresh) {
        refreshCalculations(options);
    }
}

function loadPermalinkParameters() {
    const query = new URLSearchParams(window.location.search);
    const tab = query.get('tab');
    const xVar = query.get('x');
    const strength = query.get('priorStrength');

    if (tab === 'bayesian' || tab === 'point') {
        activeTab = tab;
    }

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

    if (strength) {
        const parsedStrength = parsePriorStrength(strength);
        if (parsedStrength !== null) {
            setPriorStrengthValue(parsedStrength, true);
        }
    }
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

function buildPointCalculationText() {
    const scenario = currentScenario();
    const frequencies = calculateNaturalFrequencies(scenario);

    return [
        'Post-Test Probability Explorer - Point Estimate',
        `Pre-test probability: ${formatPercentValue(scenario.prevalence, 2)}`,
        `Sensitivity: ${formatPercentValue(scenario.sensitivity, 2)}`,
        `Specificity: ${formatPercentValue(scenario.specificity, 2)}`,
        `LR+: ${scenario.lrPos.toFixed(2)}`,
        `LR-: ${scenario.lrNeg.toFixed(2)}`,
        `Positive result post-test probability: ${formatPercentValue(scenario.positiveProbability, 2)}`,
        `Negative result post-test probability: ${formatPercentValue(scenario.negativeProbability, 2)}`,
        '',
        'Natural frequencies per 1,000 similar patients:',
        `True positives: ${formatFrequencyCount(frequencies.truePositive)}`,
        `False positives: ${formatFrequencyCount(frequencies.falsePositive)}`,
        `False negatives: ${formatFrequencyCount(frequencies.falseNegative)}`,
        `True negatives: ${formatFrequencyCount(frequencies.trueNegative)}`,
        `PPV: ${formatPercentValue(frequencies.ppv)}`,
        `NPV: ${formatPercentValue(frequencies.npv)}`,
        '',
        `Permalink: ${buildPermalink()}`
    ].join('\n');
}

function buildBayesianCalculationText() {
    const data = generateBayesianData();
    const { scenario, summaries, confidence } = data;

    return [
        'Post-Test Probability Explorer - Bayesian Distributions',
        `Prior mean: ${formatPercentValue(scenario.prevalence, 2)}`,
        `Prior confidence: ${confidence}/100`,
        `Sensitivity: ${formatPercentValue(scenario.sensitivity, 2)}`,
        `Specificity: ${formatPercentValue(scenario.specificity, 2)}`,
        `LR+: ${scenario.lrPos.toFixed(2)}`,
        `LR-: ${scenario.lrNeg.toFixed(2)}`,
        `Prior mean / median / 95% interval: ${formatPercentValue(summaries.prior.mean, 2)} / ${formatPercentValue(summaries.prior.median, 2)} / ${formatInterval(summaries.prior)}`,
        `Positive posterior mean / median / 95% interval: ${formatPercentValue(summaries.positive.mean, 2)} / ${formatPercentValue(summaries.positive.median, 2)} / ${formatInterval(summaries.positive)}`,
        `Negative posterior mean / median / 95% interval: ${formatPercentValue(summaries.negative.mean, 2)} / ${formatPercentValue(summaries.negative.median, 2)} / ${formatInterval(summaries.negative)}`,
        `Permalink: ${buildPermalink()}`
    ].join('\n');
}

function buildCalculationText() {
    return activeTab === 'bayesian' ? buildBayesianCalculationText() : buildPointCalculationText();
}

function buildPointCsv() {
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

function buildBayesianCsv() {
    const data = generateBayesianData();
    const rows = [
        [
            'probability_percent',
            'prior_relative_density',
            'positive_posterior_relative_density',
            'negative_posterior_relative_density'
        ]
    ];

    data.probabilityValues.forEach((value, index) => {
        rows.push([
            formatPercentInput(value),
            data.priorDensity[index].toFixed(6),
            data.positiveDensity[index].toFixed(6),
            data.negativeDensity[index].toFixed(6)
        ]);
    });

    return rows.map(row => row.map(csvEscape).join(',')).join('\n');
}

function buildCsv() {
    return activeTab === 'bayesian' ? buildBayesianCsv() : buildPointCsv();
}

function activeChart() {
    return activeTab === 'bayesian' ? bayesianChart : probabilityChart;
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

priorStrength.slider.addEventListener('input', () => {
    setPriorStrengthValue(parsePriorStrength(priorStrength.slider.value), true);
    refreshCalculations({ formatInputs: false });
});

priorStrength.input.addEventListener('input', () => {
    const parsedValue = parsePriorStrength(priorStrength.input.value);
    if (parsedValue === null) return;

    setPriorStrengthValue(parsedValue, false);
    refreshCalculations({ formatInputs: false });
});

priorStrength.input.addEventListener('blur', () => {
    const parsedValue = parsePriorStrength(priorStrength.input.value);
    setPriorStrengthValue(parsedValue === null ? priorStrengthValue() : parsedValue, true);
    refreshCalculations({ formatInputs: false });
});

xVariableSelect.addEventListener('change', () => {
    updateControlVisibility();
    refreshCalculations();
});

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        setActiveTab(button.dataset.tab);
    });
});

document.getElementById('copy-calculation').addEventListener('click', async () => {
    await copyText(buildCalculationText());
    showStatus('Calculation copied.');
});

document.getElementById('export-png').addEventListener('click', () => {
    const chart = activeChart();
    if (!chart) return;

    const link = document.createElement('a');
    link.href = chart.toBase64Image('image/png', 1);
    link.download = `post-test-probability-${activeTab}-${timestampForFilename()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showStatus('PNG exported.');
});

document.getElementById('export-csv').addEventListener('click', () => {
    downloadBlob(buildCsv(), 'text/csv;charset=utf-8', `post-test-probability-${activeTab}-${timestampForFilename()}.csv`);
    showStatus('CSV exported.');
});

document.getElementById('copy-link').addEventListener('click', async () => {
    await copyText(buildPermalink());
    showStatus('Link copied.');
});

loadPermalinkParameters();
setActiveTab(activeTab);
