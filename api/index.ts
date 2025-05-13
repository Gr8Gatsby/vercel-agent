const express = require("express");
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Agent card endpoint
app.get("/.well-known/agent.json", (req, res) => {
  res.json({
    "@context": "https://google.github.io/A2A/specification/agent-card/",
    "@type": "Agent",
    "name": "Simple Greeting Agent",
    "description": "A simple agent that provides greeting capabilities",
    "capabilities": [
      {
        "@type": "Capability",
        "name": "greeting",
        "description": "Provides a simple greeting message"
      }
    ],
    "endpoint": {
      "@type": "Endpoint",
      "url": "/tasks/send"
    }
  });
});

// Task handling endpoint
app.post("/tasks/send", (req, res) => {
  const { task } = req.body;
  
  if (!task || !task.capability || task.capability !== "greeting") {
    return res.status(400).json({
      error: "Invalid task or unsupported capability"
    });
  }

  // Create a response task
  const responseTask = {
    "@context": "https://google.github.io/A2A/specification/task/",
    "@type": "Task",
    "status": "completed",
    "result": {
      "message": "Hello"
    }
  };

  res.status(200).json(responseTask);
});

// Health check endpoint
app.get("/", (req, res) => res.send("A2A Greeting Agent is running"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`A2A Greeting Agent ready on port ${port}`));

module.exports = app;