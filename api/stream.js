export default async function handler(req, res) {
  try {
    const {
      symbol = "EUR/USD"
    } = req.query;

    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Twelve Data API key is not configured."
      });
    }

    // Twelve Data WebSocket endpoint
    const wsUrl =
      `wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKey}`;

    return res.status(200).json({
      success: true,
      symbol,
      websocketUrl: wsUrl,
      message: "WebSocket configuration ready."
    });

  } catch (error) {
    console.error("Stream API Error:", error);

    return res.status(500).json({
      success: false,
      error: "Server error while creating market stream."
    });
  }
}
