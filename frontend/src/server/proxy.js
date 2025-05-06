const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  next();
});

// GraphQL endpoint
app.post('/graphql', async (req, res) => {
  const { url, query, variables } = req.body;

  console.log('Proxying request to:', url);
  console.log('Query:', query);
  console.log('Variables:', variables);

  try {
    const response = await axios.post(url, {
      query,
      variables
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    if (response.data.errors) {
      console.error('GraphQL errors:', response.data.errors);
      
      // Handle specific error cases
      const error = response.data.errors[0];
      if (error.message.includes('subgraph not found')) {
        return res.status(404).json({
          error: 'Subgraph not found',
          message: 'The requested subgraph does not exist or is not accessible',
          details: error.message
        });
      }
      
      if (error.message.includes('auth error')) {
        return res.status(401).json({
          error: 'Authentication error',
          message: 'Invalid or missing API key',
          details: error.message
        });
      }

      return res.status(400).json({
        errors: response.data.errors
      });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Error proxying request:', error.message);
    console.error('Error details:', {
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });

    // Handle different types of errors
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Could not connect to the subgraph service'
      });
    }

    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'Gateway timeout',
        message: 'The subgraph service took too long to respond'
      });
    }

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      return res.status(error.response.status).json({
        error: 'Upstream error',
        message: error.response.data?.errors?.[0]?.message || error.message
      });
    }

    // Something happened in setting up the request that triggered an Error
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(port, () => {
  console.log(`[SERVER] Proxy server running at http://localhost:${port}`);
  console.log('[SERVER] Ready to handle GraphQL requests');
}); 