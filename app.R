library(shiny)
library(ggplot2)

# Define UI
ui <- fluidPage(
  titlePanel("Disease Probability Visualizer"),

  sidebarLayout(
    sidebarPanel(
      h4("Select X-axis Variable"),
      selectInput("x_var", "Variable to visualize:",
                  choices = c("Prevalence" = "prevalence",
                              "Sensitivity" = "sensitivity",
                              "Specificity" = "specificity",
                              "Likelihood Ratio +" = "lr_pos",
                              "Likelihood Ratio -" = "lr_neg"),
                  selected = "prevalence"),

      hr(),
      h4("Fixed Parameters"),

      conditionalPanel(
        condition = "input.x_var != 'prevalence'",
        sliderInput("prevalence", "Prevalence:",
                    min = 0.01, max = 0.99, value = 0.10, step = 0.01)
      ),

      conditionalPanel(
        condition = "input.x_var != 'sensitivity'",
        sliderInput("sensitivity", "Sensitivity:",
                    min = 0.01, max = 0.99, value = 0.90, step = 0.01)
      ),

      conditionalPanel(
        condition = "input.x_var != 'specificity'",
        sliderInput("specificity", "Specificity:",
                    min = 0.01, max = 0.99, value = 0.90, step = 0.01)
      ),

      conditionalPanel(
        condition = "input.x_var != 'lr_pos'",
        numericInput("lr_pos", "Likelihood Ratio + :",
                     value = 9, min = 0.1, max = 100, step = 0.1)
      ),

      conditionalPanel(
        condition = "input.x_var != 'lr_neg'",
        numericInput("lr_neg", "Likelihood Ratio - :",
                     value = 0.11, min = 0.01, max = 10, step = 0.01)
      ),

      hr(),
      selectInput("test_result", "Test Result for Probability Calculation:",
                  choices = c("Positive" = "positive",
                              "Negative" = "negative"),
                  selected = "positive"),

      hr(),
      helpText("Note: When using likelihood ratios, they will override sensitivity and specificity calculations.")
    ),

    mainPanel(
      plotOutput("probPlot", height = "500px"),
      hr(),
      h4("Interpretation"),
      textOutput("interpretation")
    )
  )
)

# Define server logic
server <- function(input, output, session) {

  # Calculate post-test probability using Bayes' theorem
  calc_probability <- function(prevalence, sensitivity, specificity, lr_pos, lr_neg, test_result, use_lr = FALSE) {

    if (use_lr) {
      # Calculate using likelihood ratios
      pre_test_odds <- prevalence / (1 - prevalence)

      if (test_result == "positive") {
        post_test_odds <- pre_test_odds * lr_pos
      } else {
        post_test_odds <- pre_test_odds * lr_neg
      }

      post_test_prob <- post_test_odds / (1 + post_test_odds)

    } else {
      # Calculate using sensitivity and specificity
      if (test_result == "positive") {
        # P(Disease|+) = [Sensitivity × Prevalence] / [Sensitivity × Prevalence + (1-Specificity) × (1-Prevalence)]
        numerator <- sensitivity * prevalence
        denominator <- sensitivity * prevalence + (1 - specificity) * (1 - prevalence)
        post_test_prob <- numerator / denominator
      } else {
        # P(Disease|-) = [(1-Sensitivity) × Prevalence] / [(1-Sensitivity) × Prevalence + Specificity × (1-Prevalence)]
        numerator <- (1 - sensitivity) * prevalence
        denominator <- (1 - sensitivity) * prevalence + specificity * (1 - prevalence)
        post_test_prob <- numerator / denominator
      }
    }

    return(post_test_prob)
  }

  # Generate data for plotting
  plot_data <- reactive({
    x_var <- input$x_var
    test_result <- input$test_result

    # Determine if we're using likelihood ratios
    use_lr <- x_var %in% c("lr_pos", "lr_neg")

    # Generate x-axis values
    if (x_var == "prevalence") {
      x_values <- seq(0.01, 0.99, length.out = 100)
      x_label <- "Prevalence"
    } else if (x_var == "sensitivity") {
      x_values <- seq(0.01, 0.99, length.out = 100)
      x_label <- "Sensitivity"
    } else if (x_var == "specificity") {
      x_values <- seq(0.01, 0.99, length.out = 100)
      x_label <- "Specificity"
    } else if (x_var == "lr_pos") {
      x_values <- seq(0.1, 50, length.out = 100)
      x_label <- "Likelihood Ratio +"
      use_lr <- TRUE
    } else if (x_var == "lr_neg") {
      x_values <- seq(0.01, 1, length.out = 100)
      x_label <- "Likelihood Ratio -"
      use_lr <- TRUE
    }

    # Calculate probabilities for each x value
    probs <- sapply(x_values, function(x) {
      if (x_var == "prevalence") {
        calc_probability(x, input$sensitivity, input$specificity,
                        input$lr_pos, input$lr_neg, test_result, use_lr)
      } else if (x_var == "sensitivity") {
        calc_probability(input$prevalence, x, input$specificity,
                        input$lr_pos, input$lr_neg, test_result, use_lr)
      } else if (x_var == "specificity") {
        calc_probability(input$prevalence, input$sensitivity, x,
                        input$lr_pos, input$lr_neg, test_result, use_lr)
      } else if (x_var == "lr_pos") {
        calc_probability(input$prevalence, input$sensitivity, input$specificity,
                        x, input$lr_neg, test_result, use_lr)
      } else if (x_var == "lr_neg") {
        calc_probability(input$prevalence, input$sensitivity, input$specificity,
                        input$lr_pos, x, test_result, use_lr)
      }
    })

    data.frame(x = x_values, probability = probs, x_label = x_label)
  })

  # Render the plot
  output$probPlot <- renderPlot({
    data <- plot_data()

    ggplot(data, aes(x = x, y = probability)) +
      geom_line(color = "steelblue", size = 1.5) +
      geom_hline(yintercept = 0.5, linetype = "dashed", color = "red", alpha = 0.5) +
      labs(title = paste("Post-Test Probability of Disease (",
                         ifelse(input$test_result == "positive", "Positive", "Negative"),
                         "Test Result)"),
           x = unique(data$x_label),
           y = "Probability of Disease") +
      scale_y_continuous(limits = c(0, 1), labels = scales::percent) +
      theme_minimal(base_size = 14) +
      theme(plot.title = element_text(hjust = 0.5, face = "bold"))
  })

  # Interpretation text
  output$interpretation <- renderText({
    data <- plot_data()
    x_var <- input$x_var
    test_result <- input$test_result

    min_prob <- min(data$probability)
    max_prob <- max(data$probability)

    var_names <- c(
      "prevalence" = "prevalence",
      "sensitivity" = "sensitivity",
      "specificity" = "specificity",
      "lr_pos" = "positive likelihood ratio",
      "lr_neg" = "negative likelihood ratio"
    )

    paste0("With a ", ifelse(test_result == "positive", "positive", "negative"),
           " test result, the post-test probability of disease ranges from ",
           sprintf("%.1f%%", min_prob * 100), " to ", sprintf("%.1f%%", max_prob * 100),
           " as ", var_names[x_var], " varies across its range.")
  })
}

# Run the application
shinyApp(ui = ui, server = server)
