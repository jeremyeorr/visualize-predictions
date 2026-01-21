# Disease Probability Visualizer

A web application for visualizing post-test probability of disease based on diagnostic test parameters. Built with HTML, CSS, and JavaScript - runs entirely in the browser with no server required.

## Features

- Visualize how post-test probability changes across the full range of:
  - Prevalence
  - Sensitivity
  - Specificity
  - Likelihood Ratio + (positive)
  - Likelihood Ratio - (negative)

- Select which parameter to vary on the x-axis
- Hold other parameters constant at user-defined values
- Calculate probability for both positive and negative test results
- Interactive sliders and inputs for easy parameter adjustment
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
3. **Choose Test Result**: Select whether you want to see probability for a positive or negative test result
4. **Interpret the Graph**: The y-axis shows the post-test probability of disease

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

## Technical Details

- Pure JavaScript implementation using Chart.js for visualization
- No dependencies beyond Chart.js CDN
- Fully responsive CSS Grid layout
- Works offline after initial load
