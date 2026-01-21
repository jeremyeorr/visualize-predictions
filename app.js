// Get DOM elements
const xVariableSelect = document.getElementById('x-variable');
const testResultSelect = document.getElementById('test-result');
const prevalenceSlider = document.getElementById('prevalence');
const sensitivitySlider = document.getElementById('sensitivity');
const specificitySlider = document.getElementById('specificity');
const lrPosInput = document.getElementById('lr-pos');
const lrNegInput = document.getElementById('lr-neg');
const interpretationText = document.getElementById('interpretation-text');

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

// Calculate post-test probability using Bayes' theorem
function calculateProbability(prevalence, sensitivity, specificity, lrPos, lrNeg, testResult, useLR = false) {
    if (useLR) {
        // Calculate using likelihood ratios
        const preTestOdds = prevalence / (1 - prevalence);
        let postTestOdds;

        if (testResult === 'positive') {
            postTestOdds = preTestOdds * lrPos;
        } else {
            postTestOdds = preTestOdds * lrNeg;
        }

        const postTestProb = postTestOdds / (1 + postTestOdds);
        return postTestProb;
    } else {
        // Calculate using sensitivity and specificity
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
}

// Generate data for plotting
function generatePlotData() {
    const xVar = xVariableSelect.value;
    const testResult = testResultSelect.value;
    const prevalence = parseFloat(prevalenceSlider.value);
    const sensitivity = parseFloat(sensitivitySlider.value);
    const specificity = parseFloat(specificitySlider.value);
    const lrPos = parseFloat(lrPosInput.value);
    const lrNeg = parseFloat(lrNegInput.value);

    let xValues = [];
    let xLabel = '';
    let useLR = false;

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
        xValues = Array.from({length: 100}, (_, i) => 0.1 + (i * 49.9 / 99));
        xLabel = 'Likelihood Ratio +';
        useLR = true;
    } else if (xVar === 'lr_neg') {
        xValues = Array.from({length: 100}, (_, i) => 0.01 + (i * 0.99 / 99));
        xLabel = 'Likelihood Ratio -';
        useLR = true;
    }

    // Calculate probabilities for each x value
    const probabilities = xValues.map(x => {
        let prob;
        if (xVar === 'prevalence') {
            prob = calculateProbability(x, sensitivity, specificity, lrPos, lrNeg, testResult, useLR);
        } else if (xVar === 'sensitivity') {
            prob = calculateProbability(prevalence, x, specificity, lrPos, lrNeg, testResult, useLR);
        } else if (xVar === 'specificity') {
            prob = calculateProbability(prevalence, sensitivity, x, lrPos, lrNeg, testResult, useLR);
        } else if (xVar === 'lr_pos') {
            prob = calculateProbability(prevalence, sensitivity, specificity, x, lrNeg, testResult, useLR);
        } else if (xVar === 'lr_neg') {
            prob = calculateProbability(prevalence, sensitivity, specificity, lrPos, x, testResult, useLR);
        }
        return prob;
    });

    return { xValues, probabilities, xLabel };
}

// Update the chart
function updateChart() {
    const { xValues, probabilities, xLabel } = generatePlotData();
    const testResult = testResultSelect.value;

    const chartData = {
        labels: xValues.map(x => x.toFixed(2)),
        datasets: [{
            label: 'Post-Test Probability',
            data: probabilities,
            borderColor: 'rgb(102, 126, 234)',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5
        }]
    };

    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: `Post-Test Probability of Disease (${testResult === 'positive' ? 'Positive' : 'Negative'} Test Result)`,
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    padding: 20
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Probability: ' + (context.parsed.y * 100).toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
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
    };

    if (chart) {
        chart.destroy();
    }

    const ctx = document.getElementById('probability-chart').getContext('2d');
    chart = new Chart(ctx, config);

    updateInterpretation(probabilities, xLabel, testResult);
}

// Update interpretation text
function updateInterpretation(probabilities, xLabel, testResult) {
    const minProb = Math.min(...probabilities);
    const maxProb = Math.max(...probabilities);

    const varNames = {
        'Prevalence': 'prevalence',
        'Sensitivity': 'sensitivity',
        'Specificity': 'specificity',
        'Likelihood Ratio +': 'positive likelihood ratio',
        'Likelihood Ratio -': 'negative likelihood ratio'
    };

    interpretationText.textContent = `With a ${testResult} test result, the post-test probability of disease ranges from ${(minProb * 100).toFixed(1)}% to ${(maxProb * 100).toFixed(1)}% as ${varNames[xLabel]} varies across its range.`;
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

testResultSelect.addEventListener('change', updateChart);

prevalenceSlider.addEventListener('input', () => {
    updateValueDisplays();
    updateChart();
});

sensitivitySlider.addEventListener('input', () => {
    updateValueDisplays();
    updateChart();
});

specificitySlider.addEventListener('input', () => {
    updateValueDisplays();
    updateChart();
});

lrPosInput.addEventListener('input', () => {
    updateValueDisplays();
    updateChart();
});

lrNegInput.addEventListener('input', () => {
    updateValueDisplays();
    updateChart();
});

// Initialize
updateControlVisibility();
updateValueDisplays();
updateChart();
