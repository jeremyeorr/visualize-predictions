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
        // Vary LR+ by adjusting sensitivity, keeping specificity constant
        // LR+ = sens / (1 - spec), where sens ranges from 0.01 to 0.99
        // Min LR+ when sens = 0.01: 0.01 / (1 - spec)
        // Max LR+ when sens = 0.99: 0.99 / (1 - spec)
        const minLRPos = 0.01 / (1 - specificity);
        const maxLRPos = 0.99 / (1 - specificity);
        const minLog = Math.log10(Math.max(minLRPos, 0.01));
        const maxLog = Math.log10(Math.min(maxLRPos, 1000));
        xValues = Array.from({length: 100}, (_, i) => {
            const logValue = minLog + (i * (maxLog - minLog) / 99);
            return Math.pow(10, logValue);
        });
        xLabel = 'Likelihood Ratio +';
    } else if (xVar === 'lr_neg') {
        // Vary LR- by adjusting specificity, keeping sensitivity constant
        // LR- = (1 - sens) / spec, where spec ranges from 0.01 to 0.99
        // Max LR- when spec = 0.01: (1 - sens) / 0.01
        // Min LR- when spec = 0.99: (1 - sens) / 0.99
        const minLRNeg = (1 - sensitivity) / 0.99;
        const maxLRNeg = (1 - sensitivity) / 0.01;
        const minLog = Math.log10(Math.max(minLRNeg, 0.001));
        const maxLog = Math.log10(Math.min(maxLRNeg, 100));
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
            // Vary LR+ by adjusting sensitivity, keep specificity constant
            // LR+ = sens / (1 - spec)
            // Therefore: sens = LR+ * (1 - spec)
            sens = x * (1 - specificity);
            spec = specificity;

            // Validate bounds
            if (sens < 0 || sens > 1 || spec < 0 || spec > 1) {
                positiveProbabilities.push(NaN);
                negativeProbabilities.push(NaN);
                return;
            }
        } else if (xVar === 'lr_neg') {
            // Vary LR- by adjusting specificity, keep sensitivity constant
            // LR- = (1 - sens) / spec
            // Therefore: spec = (1 - sens) / LR-
            spec = (1 - sensitivity) / x;
            sens = sensitivity;

            // Validate bounds
            if (sens < 0 || sens > 1 || spec < 0 || spec > 1) {
                positiveProbabilities.push(NaN);
                negativeProbabilities.push(NaN);
                return;
            }
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
                        data: xValues.map((x, i) => ({x: x, y: positiveProbabilities[i]})).filter(p => !isNaN(p.y)),
                        borderColor: 'rgb(102, 126, 234)',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        spanGaps: false
                    },
                    {
                        label: 'Negative Test Result',
                        data: xValues.map((x, i) => ({x: x, y: negativeProbabilities[i]})).filter(p => !isNaN(p.y)),
                        borderColor: 'rgb(220, 38, 127)',
                        backgroundColor: 'rgba(220, 38, 127, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        spanGaps: false
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
        // Filter out NaN values for invalid combinations
        chart.data.datasets[0].data = xValues.map((x, i) => ({x: x, y: positiveProbabilities[i]})).filter(p => !isNaN(p.y));
        chart.data.datasets[1].data = xValues.map((x, i) => ({x: x, y: negativeProbabilities[i]})).filter(p => !isNaN(p.y));
        chart.update('none');
    }

    updateInterpretation(positiveProbabilities, negativeProbabilities, xLabel);
}

// Update interpretation text with meaningful insights
function updateInterpretation(positiveProbabilities, negativeProbabilities, xLabel) {
    const minPosProb = Math.min(...positiveProbabilities);
    const maxPosProb = Math.max(...positiveProbabilities);
    const minNegProb = Math.min(...negativeProbabilities);
    const maxNegProb = Math.max(...negativeProbabilities);

    const xVar = xVariableSelect.value;
    const currentPrevalence = parseFloat(prevalenceSlider.value);

    let interpretation = '';

    // Calculate key insights
    const posRange = maxPosProb - minPosProb;
    const negRange = maxNegProb - minNegProb;
    const posImpact = posRange / currentPrevalence; // How much test changes from baseline
    const negImpact = (currentPrevalence - minNegProb) / currentPrevalence;

    // Main message based on x-axis variable
    if (xVar === 'prevalence') {
        const lowPrev = minPosProb < 0.5 && maxPosProb < 0.5;
        const highPrev = minPosProb > 0.5 && maxPosProb > 0.5;

        if (lowPrev) {
            interpretation = `Even with a positive test, post-test probability peaks at ${(maxPosProb * 100).toFixed(0)}% when prevalence is highest. In low-prevalence settings, positive results may require confirmation. `;
        } else if (highPrev) {
            interpretation = `In high-prevalence settings, a positive test confirms disease with ${(maxPosProb * 100).toFixed(0)}% probability. `;
        } else {
            interpretation = `Post-test probability crosses the 50% threshold around ${(0.5 / maxPosProb * 0.99).toFixed(0)}% prevalence. `;
        }

        if (minNegProb < 0.05) {
            interpretation += `A negative test effectively rules out disease (down to ${(minNegProb * 100).toFixed(1)}%).`;
        } else if (minNegProb > 0.1) {
            interpretation += `However, even with a negative test, ${(minNegProb * 100).toFixed(0)}% probability remains at low prevalence.`;
        }

    } else if (xVar === 'sensitivity') {
        if (maxPosProb > 0.9) {
            interpretation = `High sensitivity (>80%) makes positive tests highly informative, reaching ${(maxPosProb * 100).toFixed(0)}% probability. `;
        } else {
            interpretation = `With current specificity (${(parseFloat(specificitySlider.value) * 100).toFixed(0)}%), positive tests peak at ${(maxPosProb * 100).toFixed(0)}% probability. `;
        }

        if (maxNegProb > 0.2) {
            interpretation += `Low sensitivity means negative tests cannot rule out disease (${(maxNegProb * 100).toFixed(0)}% remains at low sensitivity).`;
        } else {
            interpretation += `Higher sensitivity makes negative tests more reliable for ruling out disease.`;
        }

    } else if (xVar === 'specificity') {
        if (minPosProb < 0.3) {
            interpretation = `Low specificity leads to many false positives - even with a positive test, probability is only ${(minPosProb * 100).toFixed(0)}% at low specificity. `;
        } else {
            interpretation = `Specificity strongly affects positive predictive value: ${(minPosProb * 100).toFixed(0)}% to ${(maxPosProb * 100).toFixed(0)}%. `;
        }

        interpretation += `Negative tests are less affected by specificity, ranging ${(minNegProb * 100).toFixed(1)}%-${(maxNegProb * 100).toFixed(1)}%.`;

    } else if (xVar === 'lr_pos') {
        const currentLR = parseFloat(lrPosInput.value);

        if (currentLR > 10) {
            interpretation = `Strong LR+ (${currentLR.toFixed(1)}) makes positive tests highly informative. `;
        } else if (currentLR > 5) {
            interpretation = `Moderate LR+ (${currentLR.toFixed(1)}) provides useful information from positive tests. `;
        } else if (currentLR < 2) {
            interpretation = `Weak LR+ (${currentLR.toFixed(1)}) means positive tests add limited diagnostic value. `;
        }

        interpretation += `At ${(currentPrevalence * 100).toFixed(0)}% prevalence, positive tests yield ${(positiveProbabilities[50] * 100).toFixed(0)}% probability at mid-range LR+.`;

    } else if (xVar === 'lr_neg') {
        const currentLR = parseFloat(lrNegInput.value);

        if (currentLR < 0.1) {
            interpretation = `Strong LR- (${currentLR.toFixed(2)}) makes negative tests excellent for ruling out disease. `;
        } else if (currentLR < 0.3) {
            interpretation = `Moderate LR- (${currentLR.toFixed(2)}) makes negative tests useful for reducing probability. `;
        } else {
            interpretation = `Weak LR- (${currentLR.toFixed(2)}) means negative tests provide limited reassurance. `;
        }

        interpretation += `At ${(currentPrevalence * 100).toFixed(0)}% prevalence, negative tests reduce probability to ${(negativeProbabilities[50] * 100).toFixed(1)}% at mid-range LR-.`;
    }

    // Add comparison between positive and negative when useful
    if (xVar !== 'lr_pos' && xVar !== 'lr_neg') {
        const posChangeMax = ((maxPosProb - currentPrevalence) / currentPrevalence * 100);
        const negChangeMax = ((currentPrevalence - minNegProb) / currentPrevalence * 100);

        if (posChangeMax > 300 && negChangeMax > 300) {
            interpretation += ` Both test results are highly informative at optimal values.`;
        } else if (posChangeMax > 300) {
            interpretation += ` Positive tests are more informative than negative ones.`;
        } else if (negChangeMax > 300) {
            interpretation += ` Negative tests are more informative than positive ones.`;
        }
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
    lrPosControl.classList.remove('hidden');
    lrNegControl.classList.remove('hidden');

    if (xVar === 'prevalence') {
        prevalenceControl.classList.add('hidden');
    } else if (xVar === 'sensitivity') {
        sensitivityControl.classList.add('hidden');
    } else if (xVar === 'specificity') {
        specificityControl.classList.add('hidden');
    } else if (xVar === 'lr_pos') {
        // When LR+ is on x-axis: hide LR+
        lrPosControl.classList.add('hidden');
    } else if (xVar === 'lr_neg') {
        // When LR- is on x-axis: hide LR-
        lrNegControl.classList.add('hidden');
    }
}

// Track which slider was adjusted
let lastAdjustedSlider = null;

// Update dependent parameters when sensitivity or specificity changes
function updateFromSensSpec(adjustedSlider) {
    if (isUpdating) return;
    isUpdating = true;

    const xVar = xVariableSelect.value;
    let sensitivity = parseFloat(sensitivitySlider.value);
    let specificity = parseFloat(specificitySlider.value);

    if (xVar === 'lr_pos') {
        // If LR+ is on x-axis, keep LR+ constant
        const lrPos = parseFloat(lrPosInput.value);

        if (adjustedSlider === 'specificity') {
            // User adjusted specificity, recalculate sensitivity to maintain LR+
            const newSens = lrPos * (1 - specificity);
            if (newSens >= 0.01 && newSens <= 0.99) {
                sensitivitySlider.value = newSens.toFixed(2);
                sensitivity = newSens;
            }
        } else if (adjustedSlider === 'sensitivity') {
            // User adjusted sensitivity, recalculate specificity to maintain LR+
            // LR+ = sens / (1 - spec)
            // Therefore: spec = 1 - (sens / LR+)
            const newSpec = 1 - (sensitivity / lrPos);
            if (newSpec >= 0.01 && newSpec <= 0.99) {
                specificitySlider.value = newSpec.toFixed(2);
                specificity = newSpec;
            }
        }

        // Recalculate LR- with updated values
        const { lrNeg } = calculateLikelihoodRatios(sensitivity, specificity);
        lrNegInput.value = lrNeg.toFixed(2);

    } else if (xVar === 'lr_neg') {
        // If LR- is on x-axis, keep LR- constant
        const lrNeg = parseFloat(lrNegInput.value);

        if (adjustedSlider === 'sensitivity') {
            // User adjusted sensitivity, recalculate specificity to maintain LR-
            const newSpec = (1 - sensitivity) / lrNeg;
            if (newSpec >= 0.01 && newSpec <= 0.99) {
                specificitySlider.value = newSpec.toFixed(2);
                specificity = newSpec;
            }
        } else if (adjustedSlider === 'specificity') {
            // User adjusted specificity, recalculate sensitivity to maintain LR-
            // LR- = (1 - sens) / spec
            // Therefore: sens = 1 - (LR- * spec)
            const newSens = 1 - (lrNeg * specificity);
            if (newSens >= 0.01 && newSens <= 0.99) {
                sensitivitySlider.value = newSens.toFixed(2);
                sensitivity = newSens;
            }
        }

        // Recalculate LR+ with updated values
        const { lrPos } = calculateLikelihoodRatios(sensitivity, specificity);
        lrPosInput.value = lrPos.toFixed(2);

    } else {
        // For other x-axis variables, update both LRs normally
        const { lrPos, lrNeg } = calculateLikelihoodRatios(sensitivity, specificity);
        lrPosInput.value = lrPos.toFixed(2);
        lrNegInput.value = lrNeg.toFixed(2);
    }

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
    updateFromSensSpec('sensitivity');
    updateChart();
});

specificitySlider.addEventListener('input', () => {
    updateFromSensSpec('specificity');
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
