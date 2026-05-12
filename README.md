# Post-Test Probability Explorer

A browser-based educational tool for exploring how diagnostic test characteristics shift pre-test probability into post-test probability. Built with HTML, CSS, and JavaScript - runs entirely in the browser with no server required.

## Features

- Visualize how post-test probability changes across the full range of:
  - Prevalence
  - Sensitivity
  - Specificity
  - Likelihood Ratio + (positive)
  - Likelihood Ratio - (negative)

- Select which parameter to vary on the x-axis
- Hold other parameters constant with sliders and precise percent inputs
- Calculate probability for both positive and negative test results
- Use percent labels throughout the interface
- Copy a calculation summary, export the chart as PNG, export plotted data as CSV, or copy a permalink with encoded parameters
- Responsive design works on desktop and mobile

## Running Locally

Simply open `index.html` in your web browser. No installation or server required!

## Deploying to GitHub Pages

1. Push this repository to GitHub
2. Go to repository Settings → Pages
3. Under "Source", select your main branch
4. Click Save
5. Your app will be live at `https://yourusername.github.io/visualize-predictions/`

## How to Use

1. **Select X-axis Variable**: Choose which parameter you want to visualize across its full range
2. **Set Fixed Parameters**: Adjust the sliders/inputs for parameters you want to hold constant
3. **Copy or Export**: Use the export actions to copy the current calculation, save the chart, save plotted data, or share a parameterized link
4. **Interpret the Graph**: The y-axis shows the post-test probability of disease after positive and negative test results

## Understanding the Parameters

- **Prevalence**: The proportion of the population that has the disease (pre-test probability)
- **Sensitivity**: The probability that the test is positive given the person has the disease
- **Specificity**: The probability that the test is negative given the person does not have the disease
- **Likelihood Ratio +**: Ratio of true positive rate to false positive rate (Sensitivity / (1-Specificity))
- **Likelihood Ratio -**: Ratio of false negative rate to true negative rate ((1-Sensitivity) / Specificity)

## Calculations

The app uses Bayes' theorem to calculate post-test probabilities:

- When using sensitivity/specificity directly
- When using likelihood ratios (which override sensitivity/specificity)

Post-test probability helps clinicians understand how a test result changes the probability that a patient has a disease.

This app is for education and exploration only. Apply results with clinical context and validated test characteristics; it is not medical advice.

## Technical Details

- Pure JavaScript implementation using Chart.js for visualization
- No dependencies beyond Chart.js CDN
- Fully responsive CSS Grid layout
- Works offline after initial load
