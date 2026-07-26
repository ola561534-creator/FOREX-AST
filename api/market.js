export default async function handler(req, res) {
  try {
    const { symbol = "EUR/USD", interval = "1h", outputsize = "100" } = req.query;

    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Twelve Data API key is not configured."
      });
    }

    const url = new URL("https://api.twelvedata.com/time_series");

    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", outputsize);
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status === "error") {
      return res.status(400).json({
        error: data.message || "Unable to retrieve market data."
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Market API Error:", error);

    return res.status(500).json({
      error: "Server error while retrieving market data."
    });
  }
}
