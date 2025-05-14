const express = require("express");
const QuickChart = require('quickchart-js');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Agent card endpoint
app.get("/.well-known/agent.json", (req, res) => {
  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;
  
  const agentCard = {
    id: "chart-agent-001",
    name: "Chart Agent",
    description: "This agent creates charts based on provided data and specifications.",
    endpoint: `${baseUrl}`,
    capabilities: ["chart-generation"],
    skills: ["data-visualization"],
    contact: "https://github.com/your-org/chart-agent",
    authentication: {
      type: "none"
    }
  };
  
  res.json(agentCard);
});

// Task handling endpoint
app.post("/tasks/send", async (req, res) => {
  const { task } = req.body;
  
  if (!task || !task.capability || task.capability !== "chart-generation") {
    return res.status(400).json({
      "@context": "https://google.github.io/A2A/specification/task/",
      "@type": "Task",
      "status": "failed",
      "error": "Invalid task or unsupported capability"
    });
  }

  try {
    const inputData = task.input?.parts?.[0]?.data;
    if (!inputData || !inputData.chartType || !inputData.data) {
      throw new Error("Missing required fields (chartType, data) in input data");
    }

    const { chartType, data, options = {} } = inputData;
    const chartWidth = options.width || 800;
    const chartHeight = options.height || 600;

    const chartJsConfig = {
      type: chartType.toLowerCase(),
      data: {
        labels: data.map(d => d.label || d.month || d.category || 'Unknown'),
        datasets: [{
          label: options.title || 'Dataset',
          data: data.map(d => d.value || d.sales || 0),
          backgroundColor: chartType === 'bar' ? 'rgba(75, 192, 192, 0.2)' : undefined,
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          fill: chartType === 'line' ? false : undefined,
          tension: chartType === 'line' ? 0.1 : undefined,
        }]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          title: { 
            display: !!options.title, 
            text: options.title,
            font: { family: 'sans-serif', size: 18, weight: 'bold' }
          },
          legend: { 
            labels: { font: { family: 'sans-serif' } } 
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { 
              display: !!options.yAxisLabel, 
              text: options.yAxisLabel,
              font: { family: 'sans-serif' }
            }
          },
          x: {
            title: { 
              display: !!options.xAxisLabel, 
              text: options.xAxisLabel,
              font: { family: 'sans-serif' }
            }
          }
        },
        ...options
      }
    };

    const chart = new QuickChart();
    chart.setConfig(chartJsConfig);
    chart.setWidth(chartWidth);
    chart.setHeight(chartHeight);
    chart.setFormat('svg');

    const chartUrl = await chart.getShortUrl();
    if (!chartUrl) {
      throw new Error("Failed to generate chart URL");
    }

    const responseTask = {
      "@context": "https://google.github.io/A2A/specification/task/",
      "@type": "Task",
      "status": "completed",
      "result": {
        "parts": [{
          "type": "data",
          "mimeType": "application/json",
          "data": {
            "chartImage": chartUrl,
            "message": "Chart generated successfully"
          }
        }]
      }
    };

    res.status(200).json(responseTask);
  } catch (error) {
    res.status(500).json({
      "@context": "https://google.github.io/A2A/specification/task/",
      "@type": "Task",
      "status": "failed",
      "error": error.message
    });
  }
});

// Health check endpoint
app.get("/", (req, res) => res.send("A2A Chart Generation Agent is running"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`A2A Chart Generation Agent ready on port ${port}`));

module.exports = app;