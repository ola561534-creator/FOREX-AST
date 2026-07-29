module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured."
      });
    }

    const { image, symbol, timeframe } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "No image supplied."
      });
    }

    const prompt = `
You are FOREX AST.

Analyze this forex chart.

Symbol: ${symbol || "Unknown"}
Timeframe: ${timeframe || "Unknown"}

Return ONLY valid JSON:

{
  "marketBias":"",
  "trend":"",
  "marketStructure":"",
  "higherHighs":[],
  "higherLows":[],
  "lowerHighs":[],
  "lowerLows":[],
  "bos":"",
  "choch":"",
  "support":[],
  "resistance":[],
  "liquidity":"",
  "priceAction":"",
  "bullishScenario":"",
  "bearishScenario":"",
  "entry":"",
  "stopLoss":"",
  "takeProfit":"",
  "riskReward":"",
  "invalidation":"",
  "confidence":0,
  "reasoning":""
}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                },
                {
                  inline_data: {
                    mime_type: "image/png",
                    data: image.replace(/^data:image\/\w+;base64,/, "")
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: data.error?.message || "Gemini request failed."
      });
    }

    let text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const analysis = JSON.parse(text);

    return res.status(200).json({
      success: true,
      symbol,
      timeframe,
      analysis
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
