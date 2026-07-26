require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());

// Check that the API key exists
if (!TWELVE_DATA_API_KEY) {
  console.error("ERROR: TWELVE_DATA_API_KEY is missing from .env");
}

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Forex AI Market Data Backend is running"
  });
});

// Get forex market data
app.get("/api/market", async (req, res) => {
  try {
    const symbol = req.query.symbol || "EUR/USD";
    const interval = req.query.interval || "15min";
    const outputsize = req.query.outputsize || "50";

    const url = new URL("https://api.twelvedata.com/time_series");

    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", outputsize);
    url.searchParams.set("apikey", TWELVE_DATA_API_KEY);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status === "error") {
      return res.status(400).json({
        success: false,
        error: data.message || "Unable to retrieve forex data"
      });
    }

    res.json({
      success: true,
      symbol: data.meta?.symbol || symbol,
      interval: data.meta?.interval || interval,
      currency_base: data.meta?.currency_base || null,
      currency_quote: data.meta?.currency_quote || null,
      data: data.values || []
    });

  } catch (error) {
    console.error("Market data error:", error);

    res.status(500).json({
      success: false,
      error: "Server error while retrieving market data"
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Forex AI backend running on port ${PORT}`);
});