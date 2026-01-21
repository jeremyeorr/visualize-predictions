// Get DOM elements
const xVariableSelect = document.getElementById('x-variable');
const prevalenceSlider = document.getElementById('prevalence');
const sensitivitySlider = document.getElementById('sensitivity');
const specificitySlider = document.getElementById('specificity');
const lrPosInput = document.getElementById('lr-pos');
const lrNegInput = document.getElementById('lr-neg');
const interpretationText = document.getElementById('interpretation-text');

// Flag to prevent circular updates
let isUpdating = false;

// Control visibility elements
const prevalenceControl = document.getElementById('prevalence-control');
const sensitivityControl = document.getElementById('sensitivity-control');
const specificityControl = document.getElementById('specificity-control');
const lrPosControl = document.getElementById('lr-pos-control');
const lrNegControl = document.getElementById('lr-neg-control');

// Value display elements
const prevalenceValue = document.getElementById('prevalence-value');
const sensitivityValue = document.getElementById('sensitivity-value');
const specificityValue = document.getElementById('specificity-value');
const lrPosValue = document.getElementById('lr-pos-value');
const lrNegValue = document.getElementById('lr-neg-value');

// Chart setup
let chart = null;

// Calculate likelihood ratios from sensitivity and specificity
function calculateLikelihoodRatios(sensitivity, specificity) {
    const lrPos = sensitivity / (1 - specificity);
    const lrNeg = (1 - sensitivity) / specificity;
    return { lrPos, lrNeg };
}

// Calculate sensitivity and specificity from likelihood ratios
function calculateSensSpec(lrPos, lrNeg) {
    // From LR+ = Sens / (1-Spec) and LR- = (1-Sens) / Spec
    // We can derive: Sens = LR+ * (1-Spec) and Sens = 1 - LR- * Spec
    // Solving these equations:
    const specificity = (lrPos - 1) / (lrPos - lrNeg);
    const sensitivity = lrPos * (1 - specificity);
    return { sensitivity, specificity };
}

// Calculate post-test probability using Bayes' theorem
function calculateProbability(prevalence, sensitivity, specificity, testResult) {
    // Always calculate using sensitivity and specificity
    if (testResult === 'positive') {
        // P(Disease|+) = [Sensitivity × Prevalence] / [Sensitivity × Prevalence + (1-Specificity) × (1-Prevalence)]
        const numerator = sensitivity * prevalence;
        const denominator = sensitivity * prevalence + (1 - specificity) * (1 - prevalence);
        return numerator / denominator;
    } else {
        // P(Disease|-) = [(1-Sensitivity) × Prevalence] / [(1-Sensitivity) × Prevalence + Specificity × (1-Prevalence)]
        const numerator = (1 - sensitivity) * prevalence;
        const denominator = (1 - sensitivity) * prevalence + specificity * (1 - prevalence);
        return numerator / denominator;
    }
}

// Generate data for plotting
function generatePlotData() {
    const xVar = xVariableSelect.value;
    const prevalence = parseFloat(prevalenceSlider.value);
    const sensitivity = parseFloat(sensitivitySlider.value);
    const specificity = parseFloat(specificitySlider.value);
    const lrPos = parseFloat(lrPosInput.value);
    const lrNeg = parseFloat(lrNegInput.value);

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
    } else if (xVar === 'lr_pos') {
        // Use logarithmic spacing for LR+
        const minLog = Math.log10(0.1);
        const maxLog = Math.log10(50);
        xValues = Array.from({length: 100}, (_, i) => {
            const logValue = minLog + (i * (maxLog - minLog) / 99);
            return Math.pow(10, logValue);
        });
        xLabel = 'Likelihood Ratio +';
    } else if (xVar === 'lr_neg') {
        // Use logarithmic spacing for LR-
        const minLog = Math.log10(0.01);
        const maxLog = Math.log10(1);
        xValues = Array.from({length: 100}, (_, i) => {
            const logValue = minLog + (i * (maxLog - minLog) / 99);
            return Math.pow(10, logValue);
        });
        xLabel = 'Likelihood Ratio -';
    }

    // Calculate probabilities for each x value for both positive and negative tests
    const positiveProbabilities = [];
    const negativeProbabilities = [];

    xValues.forEach(x => {
        let sens = sensitivity;
        let spec = specificity;

        // Determine sens/spec based on which variable is varying
        if (xVar === 'sensitivity') {
            sens = x;
        } else if (xVar === 'specificity') {
            spec = x;
        } else if (xVar === 'lr_pos') {
            // Keep LR- constant, vary LR+, recalculate sens/spec
            const result = calculateSensSpec(x, lrNeg);
            sens = result.sensitivity;
            spec = result.specificity;
        } else if (xVar === 'lr_neg') {
            // Keep LR+ constant, vary LR-, recalculate sens/spec
            const result = calculateSensSpec(lrPos, x);
            sens = result.sensitivity;
            spec = result.specificity;
        }

        const prev = (xVar === 'prevalence') ? x : prevalence;

        positiveProbabilities.push(calculateProbability(prev, sens, spec, 'positive'));
        negativeProbabilities.push(calculateProbability(prev, sens, spec, 'negative'));
    });

    return { xValues, positiveProbabilities, negativeProbabilities, xLabel };
}

// Update the chart
function updateChart() {
    const { xValues, positiveProbabilities, negativeProbabilities, xLabel } = generatePlotData();
    const xVar = xVariableSelect.value;
    const isLikelihoodRatio = xVar === 'lr_pos' || xVar === 'lr_neg';

    // If chart doesn't exist, create it
    if (!chart) {
        const ctx = document.getElementById('probability-chart').getContext('2d');

        const xAxisConfig = {
            type: isLikelihoodRatio ? 'logarithmic' : 'linear',
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
                    if (isLikelihoodRatio) {
                        // Format as decimal for small values, regular for larger
                        if (value < 1) {
                            return value.toFixed(2);
                        } else if (value < 10) {
                            return value.toFixed(1);
                        } else {
                            return value.toFixed(0);
                        }
                    }
                    return value;
                }
            }
        };

        chart = new Chart(ctx, {
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
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    duration: 300
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
                    title: {
                        display: true,
                        text: 'Post-Test Probability of Disease',
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + (context.parsed.y * 100).toFixed(1) + '%';
                            },
                            title: function(context) {
                                const value = context[0].parsed.x;
                                if (isLikelihoodRatio) {
                                    return xLabel + ': ' + value.toFixed(2);
                                }
                                return xLabel + ': ' + value.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: xAxisConfig,
                    y: {
                        title: {
                            display: true,
                            text: 'Probability of Disease',
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
            }
        });
    } else {
        // Update existing chart data and scale type
        chart.options.scales.x.type = isLikelihoodRatio ? 'logarithmic' : 'linear';
        chart.options.scales.x.title.text = xLabel;
        chart.options.scales.x.ticks.callback = function(value) {
            if (isLikelihoodRatio) {
                if (value < 1) {
                    return value.toFixed(2);
                } else if (value < 10) {
                    return value.toFixed(1);
                } else {
                    return value.toFixed(0);
                }
            }
            return value.toFixed(2);
        };

        chart.data.labels = xValues;
        chart.data.datasets[0].data = xValues.map((x, i) => ({x: x, y: positiveProbabilities[i]}));
        chart.data.datasets[1].data = xValues.map((x, i) => ({x: x, y: negativeProbabilities[i]}));
        chart.update('none');
    }

    updateInterpretation(positiveProbabilities, negativeProbabilities, xLabel);
}

// Update interpretation text
function updateInterpretation(positiveProbabilities, negativeProbabilities, xLabel) {
    const minPosProb = Math.min(...positiveProbabilities);
    const maxPosProb = Math.max(...positiveProbabilities);
    const minNegProb = Math.min(...negativeProbabilities);
    const maxNegProb = Math.max(...negativeProbabilities);

    const varNames = {
        'Prevalence': 'prevalence',
        'Sensitivity': 'sensitivity',
        'Specificity': 'specificity',
        'Likelihood Ratio +': 'positive likelihood ratio',
        'Likelihood Ratio -': 'negative likelihood ratio'
    };

    interpretationText.textContent = `As ${varNames[xLabel]} varies across its range: With a positive test result, the post-test probability ranges from ${(minPosProb * 100).toFixed(1)}% to ${(maxPosProb * 100).toFixed(1)}%. With a negative test result, it ranges from ${(minNegProb * 100).toFixed(1)}% to ${(maxNegProb * 100).toFixed(1)}%.`;
}

// Update control visibility based on selected x-variable
function updateControlVisibility() {
    const xVar = xVariableSelect.value;

    prevalenceControl.classList.remove('hidden');
    sensitivityControl.classList.remove('hidden');
    specificityControl.classList.remove('hidden');
    lrPosControl.classList.remove('hidden');
    lrNegControl.classList.remove('hidden');

    if (xVar === 'prevalence') {
        prevalenceControl.classList.add('hidden');
    } else if (xVar === 'sensitivity') {
        sensitivityControl.classList.add('hidden');
    } else if (xVar === 'specificity') {
        specificityControl.classList.add('hidden');
    } else if (xVar === 'lr_pos') {
        lrPosControl.classList.add('hidden');
    } else if (xVar === 'lr_neg') {
        lrNegControl.classList.add('hidden');
    }
}

// Update dependent parameters when sensitivity or specificity changes
function updateFromSensSpec() {
    if (isUpdating) return;
    isUpdating = true;

    const sensitivity = parseFloat(sensitivitySlider.value);
    const specificity = parseFloat(specificitySlider.value);
    const { lrPos, lrNeg } = calculateLikelihoodRatios(sensitivity, specificity);

    lrPosInput.value = lrPos.toFixed(2);
    lrNegInput.value = lrNeg.toFixed(2);

    updateValueDisplays();
    isUpdating = false;
}

// Update dependent parameters when likelihood ratios change
function updateFromLRs() {
    if (isUpdating) return;
    isUpdating = true;

    const lrPos = parseFloat(lrPosInput.value);
    const lrNeg = parseFloat(lrNegInput.value);

    // Validate that the combination is mathematically valid
    if (lrPos > 0 && lrNeg > 0) {
        const { sensitivity, specificity } = calculateSensSpec(lrPos, lrNeg);

        // Check if values are valid (between 0 and 1)
        if (sensitivity >= 0 && sensitivity <= 1 && specificity >= 0 && specificity <= 1) {
            sensitivitySlider.value = sensitivity.toFixed(2);
            specificitySlider.value = specificity.toFixed(2);
        }
    }

    updateValueDisplays();
    isUpdating = false;
}

// Update value displays
function updateValueDisplays() {
    prevalenceValue.textContent = parseFloat(prevalenceSlider.value).toFixed(2);
    sensitivityValue.textContent = parseFloat(sensitivitySlider.value).toFixed(2);
    specificityValue.textContent = parseFloat(specificitySlider.value).toFixed(2);
    lrPosValue.textContent = parseFloat(lrPosInput.value).toFixed(2);
    lrNegValue.textContent = parseFloat(lrNegInput.value).toFixed(2);
}

// Event listeners
xVariableSelect.addEventListener('change', () => {
    updateControlVisibility();
    updateChart();
});

prevalenceSlider.addEventListener('input', () => {
    updateValueDisplays();
    updateChart();
});

sensitivitySlider.addEventListener('input', () => {
    updateFromSensSpec();
    updateChart();
});

specificitySlider.addEventListener('input', () => {
    updateFromSensSpec();
    updateChart();
});

lrPosInput.addEventListener('input', () => {
    updateFromLRs();
    updateChart();
});

lrNegInput.addEventListener('input', () => {
    updateFromLRs();
    updateChart();
});

// Initialize
updateControlVisibility();
updateFromSensSpec(); // This will sync LRs with initial sens/spec values
updateChart();
