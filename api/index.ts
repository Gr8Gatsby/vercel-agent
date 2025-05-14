const express = require("express");
const QuickChart = require('quickchart-js');
// const fetch = require('node-fetch'); // Use global fetch if available (Node 18+)
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
    description: "This agent creates charts based on provided data and specifications, returning both a URL and embedded Base64 PNG.",
    endpoint: `${baseUrl}/tasks/send`,
    capabilities: ["chart-generation"],
    skills: ["data-visualization", "png-generation"],
    contact: "https://github.com/your-org/chart-agent",
    authentication: {
      type: "none"
    }
  };
  
  res.json(agentCard);
});

// Task handling endpoint, now directly on app
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
    if (!task.input || !Array.isArray(task.input.parts) || task.input.parts.length === 0) {
      throw new Error("Input message or parts are missing in the task.");
    }
    const inputData = task.input.parts[0]?.data;
    if (!inputData || !inputData.chartType || !inputData.data) {
      throw new Error("Missing required fields (chartType, data) in input data part.");
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
          backgroundColor: chartType.toLowerCase() === 'bar' ? 'rgba(75, 192, 192, 0.2)' : undefined,
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          fill: chartType.toLowerCase() === 'line' ? false : undefined,
          tension: chartType.toLowerCase() === 'line' ? 0.1 : undefined,
        }]
      },
      options: {
        responsive: false,
        animation: false, // No animation for static images
        // Ensure a background color for PNG if transparency isn't desired or handled well by QuickChart
        // backgroundColor: options.backgroundColor || 'white', // Example: default to white
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
        ...options // Spread other Chart.js options from input
      }
    };

    const chart = new QuickChart();
    chart.setConfig(chartJsConfig);
    chart.setWidth(chartWidth);
    chart.setHeight(chartHeight);
    chart.setFormat('png'); // Request PNG format
    // chart.setBackgroundColor('transparent'); // If transparent PNG is desired and supported

    const chartUrl = await chart.getShortUrl();
    if (!chartUrl) {
      throw new Error("Failed to generate chart URL from QuickChart.io.");
    }

    // Download the PNG content
    const pngResponse = await fetch(chartUrl);
    if (!pngResponse.ok) {
      throw new Error(`Failed to download chart PNG: ${pngResponse.statusText}`);
    }
    // Get response as an ArrayBuffer, then convert to Buffer for Base64 encoding
    const imageArrayBuffer = await pngResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);
    const base64PngContent = imageBuffer.toString('base64');

    const responseTask = {
      "@context": "https://google.github.io/A2A/specification/task/",
      "@type": "Task",
      "status": "completed",
      "result": { 
        "id": `msg-${Date.now()}`,
        "role": "agent",
        "parts": [
          {
            "type": "data",
            "mimeType": "application/json",
            "data": {
              "chartImage": chartUrl, // URL to the chart on QuickChart.io
              "message": "Chart generated successfully. Base64 PNG data is in a separate part."
            }
          },
          {
            "type": "data",
            "mimeType": "image/png", // Set MIME type to image/png
            "data": base64PngContent // The Base64 encoded PNG string
          }
        ]
      }
    };

    res.status(200).json(responseTask);
  } catch (error) {
    console.error("Error in task processing:", error);
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