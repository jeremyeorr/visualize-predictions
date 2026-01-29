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
let predictiveValueChart = null;

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

// Calculate PPV and NPV
function calculatePredictiveValues(prevalence, sensitivity, specificity) {
    // PPV = P(Disease|+) - same as positive post-test probability
    const ppv = calculateProbability(prevalence, sensitivity, specificity, 'positive');
    // NPV = P(No Disease|-) = 1 - P(Disease|-)
    const npv = 1 - calculateProbability(prevalence, sensitivity, specificity, 'negative');
    return { ppv, npv };
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
        xValues = Array.from({length: 100}, (_, i) => 0.01 + (i * 0.98 / 99));
        xLabel = 'Prevalence';
    } else if (xVar === 'sensitivity') {
        xValues = Array.from({length: 100}, (_, i) => 0.01 + (i * 0.98 / 99));
        xLabel = 'Sensitivity';
    } else if (xVar === 'specificity') {
        xValues = Array.from({length: 100}, (_, i) => 0.01 + (i * 0.98 / 99));
        xLabel = 'Specificity';
    }

    // Calculate probabilities and predictive values for each x value
    const positiveProbabilities = [];
    const negativeProbabilities = [];
    const ppvValues = [];
    const npvValues = [];

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

        const { ppv, npv } = calculatePredictiveValues(prev, sens, spec);
        ppvValues.push(ppv);
        npvValues.push(npv);
    });

    return { xValues, positiveProbabilities, negativeProbabilities, ppvValues, npvValues, xLabel };
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
            let tooltipContent = `<div class="tooltip-x">${xLabel}: ${xValue.toFixed(2)}</div>`;
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
    const { xValues, positiveProbabilities, negativeProbabilities, ppvValues, npvValues, xLabel } = generatePlotData();

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
                type: 'linear',
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
        probabilityChart.options.scales.x.title.text = xLabel;
        probabilityChart.data.labels = xValues;
        probabilityChart.data.datasets[0].data = xValues.map((x, i) => ({x: x, y: positiveProbabilities[i]}));
        probabilityChart.data.datasets[1].data = xValues.map((x, i) => ({x: x, y: negativeProbabilities[i]}));
        probabilityChart.update('none');
    }

    // Create or update predictive value chart
    if (!predictiveValueChart) {
        const ctx = document.getElementById('predictive-value-chart').getContext('2d');

        predictiveValueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: xValues,
                datasets: [
                    {
                        label: 'Positive Predictive Value (PPV)',
                        data: xValues.map((x, i) => ({x: x, y: ppvValues[i]})),
                        borderColor: 'rgb(102, 126, 234)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Negative Predictive Value (NPV)',
                        data: xValues.map((x, i) => ({x: x, y: npvValues[i]})),
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
                        text: 'Predictive Values',
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
                            text: 'Predictive Value'
                        }
                    }
                }
            }
        });

        setupCrosshairHandlers(predictiveValueChart, 'predictive-value-chart');
    } else {
        predictiveValueChart.options.scales.x.title.text = xLabel;
        predictiveValueChart.data.labels = xValues;
        predictiveValueChart.data.datasets[0].data = xValues.map((x, i) => ({x: x, y: ppvValues[i]}));
        predictiveValueChart.data.datasets[1].data = xValues.map((x, i) => ({x: x, y: npvValues[i]}));
        predictiveValueChart.update('none');
    }

    updateInterpretation(positiveProbabilities, negativeProbabilities, ppvValues, npvValues, xLabel);
}

// Update interpretation text with meaningful insights
function updateInterpretation(positiveProbabilities, negativeProbabilities, ppvValues, npvValues, xLabel) {
    const minPosProb = Math.min(...positiveProbabilities);
    const maxPosProb = Math.max(...positiveProbabilities);
    const minNegProb = Math.min(...negativeProbabilities);
    const maxNegProb = Math.max(...negativeProbabilities);
    const minPPV = Math.min(...ppvValues);
    const maxPPV = Math.max(...ppvValues);
    const minNPV = Math.min(...npvValues);
    const maxNPV = Math.max(...npvValues);

    const xVar = xVariableSelect.value;
    const currentPrevalence = parseFloat(prevalenceSlider.value);

    let interpretation = '';

    // Main message based on x-axis variable
    if (xVar === 'prevalence') {
        const lowPrev = minPosProb < 0.5 && maxPosProb < 0.5;
        const highPrev = minPosProb > 0.5 && maxPosProb > 0.5;

        if (lowPrev) {
            interpretation = `Even with a positive test, post-test probability peaks at ${(maxPosProb * 100).toFixed(0)}% when prevalence is highest. In low-prevalence settings, positive results may require confirmation. `;
        } else if (highPrev) {
            interpretation = `In high-prevalence settings, a positive test confirms disease with ${(maxPosProb * 100).toFixed(0)}% probability. `;
        } else {
            interpretation = `Post-test probability crosses the 50% threshold as prevalence increases. `;
        }

        interpretation += `PPV ranges from ${(minPPV * 100).toFixed(0)}% to ${(maxPPV * 100).toFixed(0)}%, while NPV ranges from ${(minNPV * 100).toFixed(0)}% to ${(maxNPV * 100).toFixed(0)}%.`;

    } else if (xVar === 'sensitivity') {
        if (maxPosProb > 0.9) {
            interpretation = `High sensitivity (>80%) makes positive tests highly informative, reaching ${(maxPosProb * 100).toFixed(0)}% probability. `;
        } else {
            interpretation = `With current specificity (${(parseFloat(specificitySlider.value) * 100).toFixed(0)}%), positive tests peak at ${(maxPosProb * 100).toFixed(0)}% probability. `;
        }

        interpretation += `NPV improves from ${(minNPV * 100).toFixed(0)}% to ${(maxNPV * 100).toFixed(0)}% as sensitivity increases.`;

    } else if (xVar === 'specificity') {
        if (minPosProb < 0.3) {
            interpretation = `Low specificity leads to many false positives - even with a positive test, probability is only ${(minPosProb * 100).toFixed(0)}% at low specificity. `;
        } else {
            interpretation = `Specificity strongly affects positive predictive value: PPV ranges from ${(minPPV * 100).toFixed(0)}% to ${(maxPPV * 100).toFixed(0)}%. `;
        }

        interpretation += `Higher specificity greatly improves PPV for ruling in disease.`;
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
    prevalenceValue.textContent = parseFloat(prevalenceSlider.value).toFixed(2);
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
