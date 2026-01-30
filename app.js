// Get DOM elements
const xVariableSelect = document.getElementById('x-variable');
const prevalenceSlider = document.getElementById('prevalence');
const sensitivitySlider = document.getElementById('sensitivity');
const specificitySlider = document.getElementById('specificity');
const interpretationText = document.getElementById('interpretation-text');

// Control visibility elements
const prevalenceControl = document.getElementById('prevalence-control');
const sensitivityControl = document.getElementById('sensitivity-control');
const specificityControl = document.getElementById('specificity-control');

// Value display elements
const prevalenceValue = document.getElementById('prevalence-value');
const sensitivityValue = document.getElementById('sensitivity-value');
const specificityValue = document.getElementById('specificity-value');
const lrPosValue = document.getElementById('lr-pos-value');
const lrNegValue = document.getElementById('lr-neg-value');

// Chart setup
let probabilityChart = null;

// Calculate likelihood ratios from sensitivity and specificity
function calculateLikelihoodRatios(sensitivity, specificity) {
    const lrPos = sensitivity / (1 - specificity);
    const lrNeg = (1 - sensitivity) / specificity;
    return { lrPos, lrNeg };
}

// Calculate post-test probability using Bayes' theorem
function calculateProbability(prevalence, sensitivity, specificity, testResult) {
    if (testResult === 'positive') {
        // P(Disease|+) = [Sensitivity * Prevalence] / [Sensitivity * Prevalence + (1-Specificity) * (1-Prevalence)]
        const numerator = sensitivity * prevalence;
        const denominator = sensitivity * prevalence + (1 - specificity) * (1 - prevalence);
        return numerator / denominator;
    } else {
        // P(Disease|-) = [(1-Sensitivity) * Prevalence] / [(1-Sensitivity) * Prevalence + Specificity * (1-Prevalence)]
        const numerator = (1 - sensitivity) * prevalence;
        const denominator = (1 - sensitivity) * prevalence + specificity * (1 - prevalence);
        return numerator / denominator;
    }
}

// Format number to 3 significant figures
function toSignificantFigures(num, sigFigs) {
    if (num === 0) return '0';
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const scale = Math.pow(10, sigFigs - 1 - magnitude);
    return (Math.round(num * scale) / scale).toString();
}

// Generate data for plotting
function generatePlotData() {
    const xVar = xVariableSelect.value;
    const prevalence = parseFloat(prevalenceSlider.value);
    const sensitivity = parseFloat(sensitivitySlider.value);
    const specificity = parseFloat(specificitySlider.value);

    let xValues = [];
    let xLabel = '';

    // Generate x-axis values based on selected variable
    if (xVar === 'prevalence') {
        // Logarithmic scale for prevalence: from 0.005 to 1
        const logMin = Math.log10(0.005);
        const logMax = Math.log10(1);
        xValues = Array.from({length: 100}, (_, i) => {
            const logValue = logMin + (i * (logMax - logMin) / 99);
            return Math.pow(10, logValue);
        });
        xLabel = 'Prevalence';
    } else if (xVar === 'sensitivity') {
        xValues = Array.from({length: 100}, (_, i) => 0.01 + (i * 0.98 / 99));
        xLabel = 'Sensitivity';
    } else if (xVar === 'specificity') {
        xValues = Array.from({length: 100}, (_, i) => 0.01 + (i * 0.98 / 99));
        xLabel = 'Specificity';
    }

    // Calculate probabilities for each x value
    const positiveProbabilities = [];
    const negativeProbabilities = [];

    xValues.forEach(x => {
        let sens = sensitivity;
        let spec = specificity;
        let prev = prevalence;

        // Determine which variable is varying
        if (xVar === 'prevalence') {
            prev = x;
        } else if (xVar === 'sensitivity') {
            sens = x;
        } else if (xVar === 'specificity') {
            spec = x;
        }

        positiveProbabilities.push(calculateProbability(prev, sens, spec, 'positive'));
        negativeProbabilities.push(calculateProbability(prev, sens, spec, 'negative'));
    });

    return { xValues, positiveProbabilities, negativeProbabilities, xLabel };
}

// Custom plugin for crosshair
const crosshairPlugin = {
    id: 'crosshair',
    afterDraw: function(chart) {
        if (chart.crosshair && chart.crosshair.x !== undefined) {
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            const x = chart.crosshair.x;

            // Draw vertical line
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        }
    }
};

// Register the crosshair plugin
Chart.register(crosshairPlugin);

// Create tooltip element for a chart
function createTooltipElement(chartId) {
    const existingTooltip = document.getElementById(`tooltip-${chartId}`);
    if (existingTooltip) {
        return existingTooltip;
    }

    const tooltip = document.createElement('div');
    tooltip.id = `tooltip-${chartId}`;
    tooltip.className = 'crosshair-tooltip';
    tooltip.style.display = 'none';

    const chartWrapper = document.getElementById(chartId).parentElement;
    chartWrapper.appendChild(tooltip);

    return tooltip;
}

// Handle mouse move for crosshair
function setupCrosshairHandlers(chart, chartId, datasets) {
    const canvas = chart.canvas;
    const tooltip = createTooltipElement(chartId);

    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const chartArea = chart.chartArea;

        // Check if mouse is within chart area
        if (x >= chartArea.left && x <= chartArea.right && y >= chartArea.top && y <= chartArea.bottom) {
            chart.crosshair = { x: x };
            chart.update('none');

            // Get x value at this position
            const xScale = chart.scales.x;
            const xValue = xScale.getValueForPixel(x);

            // Find closest data point
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

            // Get y values for both datasets at this x position
            const xLabel = chart.options.scales.x.title.text;
            const yValues = chart.data.datasets.map(ds => {
                if (ds.data[closestIndex]) {
                    return {
                        label: ds.label,
                        value: ds.data[closestIndex].y,
                        color: ds.borderColor
                    };
                }
                return null;
            }).filter(v => v !== null);

            // Update tooltip content
            const xVar = xVariableSelect.value;
            const xFormatted = xVar === 'prevalence' ? toSignificantFigures(xValue, 3) : xValue.toFixed(2);
            let tooltipContent = `<div class="tooltip-x">${xLabel}: ${xFormatted}</div>`;
            tooltipContent += '<div class="tooltip-y">';
            yValues.forEach(yv => {
                const colorClass = yv.label.includes('Positive') || yv.label.includes('PPV') ? 'tooltip-positive' : 'tooltip-negative';
                tooltipContent += `<span class="${colorClass}">${yv.label}: ${(yv.value * 100).toFixed(1)}%</span>`;
            });
            tooltipContent += '</div>';

            tooltip.innerHTML = tooltipContent;
            tooltip.style.display = 'block';

            // Position tooltip above the chart, centered on cursor
            const tooltipX = x;
            const tooltipY = chartArea.top - 10;

            tooltip.style.left = `${tooltipX}px`;
            tooltip.style.bottom = `${canvas.height - tooltipY + 10}px`;
            tooltip.style.top = 'auto';
        } else {
            chart.crosshair = null;
            chart.update('none');
            tooltip.style.display = 'none';
        }
    });

    canvas.addEventListener('mouseleave', function() {
        chart.crosshair = null;
        chart.update('none');
        tooltip.style.display = 'none';
    });
}

// Update the charts
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
                enabled: false // Disable default tooltip, use our custom crosshair
            }
        },
        scales: {
            x: {
                type: isLogScale ? 'logarithmic' : 'linear',
                min: isLogScale ? 0.005 : undefined,
                max: isLogScale ? 1 : undefined,
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
                        if (isLogScale) {
                            return toSignificantFigures(value, 3);
                        }
                        return value.toFixed(2);
                    }
                }
            },
            y: {
                title: {
                    display: true,
                    text: '',
                    font: {
                        size: 14,
                        weight: 'bold'
                    }
                },
                min: 0,
                max: 1,
                ticks: {
                    callback: function(value) {
                        return (value * 100).toFixed(0) + '%';
                    }
                }
            }
        }
    };

    // Create or update probability chart
    if (!probabilityChart) {
        const ctx = document.getElementById('probability-chart').getContext('2d');

        probabilityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: xValues,
                datasets: [
                    {
                        label: 'Positive Test Result',
                        data: xValues.map((x, i) => ({x: x, y: positiveProbabilities[i]})),
                        borderColor: 'rgb(102, 126, 234)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Negative Test Result',
                        data: xValues.map((x, i) => ({x: x, y: negativeProbabilities[i]})),
                        borderColor: 'rgb(220, 38, 127)',
                        backgroundColor: 'rgba(220, 38, 127, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    title: {
                        display: true,
                        text: 'Post-Test Probability of Disease',
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        padding: 20
                    }
                },
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        title: {
                            ...commonOptions.scales.y.title,
                            text: 'Probability of Disease'
                        }
                    }
                }
            }
        });

        setupCrosshairHandlers(probabilityChart, 'probability-chart');
    } else {
        probabilityChart.options.scales.x.type = isLogScale ? 'logarithmic' : 'linear';
        probabilityChart.options.scales.x.min = isLogScale ? 0.005 : undefined;
        probabilityChart.options.scales.x.max = isLogScale ? 1 : undefined;
        probabilityChart.options.scales.x.title.text = xLabel;
        probabilityChart.options.scales.x.ticks.callback = function(value) {
            if (isLogScale) {
                return toSignificantFigures(value, 3);
            }
            return value.toFixed(2);
        };
        probabilityChart.data.labels = xValues;
        probabilityChart.data.datasets[0].data = xValues.map((x, i) => ({x: x, y: positiveProbabilities[i]}));
        probabilityChart.data.datasets[1].data = xValues.map((x, i) => ({x: x, y: negativeProbabilities[i]}));
        probabilityChart.update('none');
    }

    updateInterpretation(positiveProbabilities, negativeProbabilities, xLabel);
}

// Find inflection points and plateaus in a curve
function analyzeInflectionAndPlateau(values, xValues) {
    const n = values.length;

    // Calculate first derivative (rate of change)
    const derivatives = [];
    for (let i = 1; i < n - 1; i++) {
        // Use central difference for better accuracy
        const dx = xValues[i + 1] - xValues[i - 1];
        const dy = values[i + 1] - values[i - 1];
        derivatives.push({ index: i, derivative: dy / dx, x: xValues[i], y: values[i] });
    }

    // Find max rate of change (steepest point / inflection region)
    let maxDerivIdx = 0;
    let maxDeriv = Math.abs(derivatives[0].derivative);
    for (let i = 1; i < derivatives.length; i++) {
        if (Math.abs(derivatives[i].derivative) > maxDeriv) {
            maxDeriv = Math.abs(derivatives[i].derivative);
            maxDerivIdx = i;
        }
    }
    const inflectionPoint = derivatives[maxDerivIdx];

    // Detect plateaus: regions where derivative is near zero relative to max
    const threshold = maxDeriv * 0.1; // 10% of max slope
    const lowPlateau = derivatives.slice(0, Math.floor(derivatives.length / 3))
        .filter(d => Math.abs(d.derivative) < threshold);
    const highPlateau = derivatives.slice(Math.floor(2 * derivatives.length / 3))
        .filter(d => Math.abs(d.derivative) < threshold);

    return {
        inflectionPoint,
        hasLowPlateau: lowPlateau.length > derivatives.length / 6,
        hasHighPlateau: highPlateau.length > derivatives.length / 6,
        lowPlateauValue: values[0],
        highPlateauValue: values[n - 1]
    };
}

// Update interpretation text with meaningful insights
function updateInterpretation(positiveProbabilities, negativeProbabilities, xLabel) {
    const xVar = xVariableSelect.value;
    const { xValues } = generatePlotData();

    const posAnalysis = analyzeInflectionAndPlateau(positiveProbabilities, xValues);
    const negAnalysis = analyzeInflectionAndPlateau(negativeProbabilities, xValues);

    let interpretation = '';

    if (xVar === 'prevalence') {
        // Describe positive test curve behavior
        const posInflectionPrev = toSignificantFigures(posAnalysis.inflectionPoint.x, 2);
        const posInflectionProb = (posAnalysis.inflectionPoint.y * 100).toFixed(0);

        interpretation = `The positive test curve shows its steepest change around prevalence ${posInflectionPrev} (at ${posInflectionProb}% probability). `;

        if (posAnalysis.hasLowPlateau && posAnalysis.hasHighPlateau) {
            interpretation += `The curve plateaus at both extremes: near ${(posAnalysis.lowPlateauValue * 100).toFixed(0)}% at low prevalence and ${(posAnalysis.highPlateauValue * 100).toFixed(0)}% at high prevalence. `;
        } else if (posAnalysis.hasHighPlateau) {
            interpretation += `At high prevalence, the curve plateaus near ${(posAnalysis.highPlateauValue * 100).toFixed(0)}%. `;
        } else if (posAnalysis.hasLowPlateau) {
            interpretation += `At low prevalence, the curve plateaus near ${(posAnalysis.lowPlateauValue * 100).toFixed(0)}%. `;
        }

        // Note about negative test
        interpretation += `A negative test keeps probability below ${(Math.max(...negativeProbabilities) * 100).toFixed(0)}% across all prevalence values.`;

    } else if (xVar === 'sensitivity') {
        const posInflectionSens = posAnalysis.inflectionPoint.x.toFixed(2);
        const posInflectionProb = (posAnalysis.inflectionPoint.y * 100).toFixed(0);

        interpretation = `Post-test probability changes most rapidly around sensitivity ${posInflectionSens}. `;

        if (posAnalysis.hasHighPlateau) {
            interpretation += `Above this point, increasing sensitivity yields diminishing returns as probability plateaus near ${(posAnalysis.highPlateauValue * 100).toFixed(0)}%. `;
        }

        interpretation += `Negative test probability drops from ${(negativeProbabilities[0] * 100).toFixed(0)}% to ${(negativeProbabilities[negativeProbabilities.length - 1] * 100).toFixed(0)}% as sensitivity increases.`;

    } else if (xVar === 'specificity') {
        const posInflectionSpec = posAnalysis.inflectionPoint.x.toFixed(2);
        const posInflectionProb = (posAnalysis.inflectionPoint.y * 100).toFixed(0);

        interpretation = `The positive test curve inflects near specificity ${posInflectionSpec} (${posInflectionProb}% probability). `;

        if (posAnalysis.hasLowPlateau) {
            interpretation += `At low specificity, false positives dominate and probability plateaus near ${(posAnalysis.lowPlateauValue * 100).toFixed(0)}%. `;
        }
        if (posAnalysis.hasHighPlateau) {
            interpretation += `High specificity (>0.95) offers diminishing returns as the curve flattens near ${(posAnalysis.highPlateauValue * 100).toFixed(0)}%. `;
        }

        interpretation += `Negative test probability remains stable around ${(negativeProbabilities[Math.floor(negativeProbabilities.length / 2)] * 100).toFixed(0)}%.`;
    }

    interpretationText.textContent = interpretation;
}

// Update control visibility based on selected x-variable
function updateControlVisibility() {
    const xVar = xVariableSelect.value;

    // Show all controls
    prevalenceControl.classList.remove('hidden');
    sensitivityControl.classList.remove('hidden');
    specificityControl.classList.remove('hidden');

    if (xVar === 'prevalence') {
        prevalenceControl.classList.add('hidden');
    } else if (xVar === 'sensitivity') {
        sensitivityControl.classList.add('hidden');
    } else if (xVar === 'specificity') {
        specificityControl.classList.add('hidden');
    }
}

// Update LR display values
function updateLRDisplay() {
    const sensitivity = parseFloat(sensitivitySlider.value);
    const specificity = parseFloat(specificitySlider.value);
    const { lrPos, lrNeg } = calculateLikelihoodRatios(sensitivity, specificity);

    lrPosValue.textContent = lrPos.toFixed(2);
    lrNegValue.textContent = lrNeg.toFixed(2);
}

// Update value displays
function updateValueDisplays() {
    prevalenceValue.textContent = toSignificantFigures(parseFloat(prevalenceSlider.value), 3);
    sensitivityValue.textContent = parseFloat(sensitivitySlider.value).toFixed(2);
    specificityValue.textContent = parseFloat(specificitySlider.value).toFixed(2);
    updateLRDisplay();
}

// Event listeners
xVariableSelect.addEventListener('change', () => {
    updateControlVisibility();
    updateCharts();
});

prevalenceSlider.addEventListener('input', () => {
    updateValueDisplays();
    updateCharts();
});

sensitivitySlider.addEventListener('input', () => {
    updateValueDisplays();
    updateCharts();
});

specificitySlider.addEventListener('input', () => {
    updateValueDisplays();
    updateCharts();
});

// Initialize
updateControlVisibility();
updateValueDisplays();
updateCharts();
