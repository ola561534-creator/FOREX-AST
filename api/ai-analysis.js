export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "OpenAI API key is not configured."
      });
    }

    const { image, symbol, timeframe } = req.body || {};

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "No chart image was provided."
      });
    }

    // Make sure the image is a supported data URL.
    if (!image.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        error: "Invalid chart image format."
      });
    }

    const prompt = `
You are the AI market-analysis assistant inside a forex application called FOREX AST.

Analyze the uploaded forex chart carefully.

Instrument:
${symbol || "Unknown"}

Timeframe:
${timeframe || "Unknown"}

Provide a structured analysis.

IMPORTANT:
- Do not claim certainty about future price movement.
- Do not invent exact prices that cannot be read from the chart.
- Clearly separate observations from possible trade scenarios.
- If the chart is unclear, say so.

Analyze:

1. Market bias: Bullish, Bearish, or Neutral
2. Overall trend
3. Market structure
4. Higher Highs (HH)
5. Higher Lows (HL)
6. Lower Highs (LH)
7. Lower Lows (LL)
8. Break of Structure (BOS)
9. Change of Character (CHoCH)
10. Support levels
11. Resistance levels
12. Liquidity areas
13. Candlestick / price action observations
14. Possible bullish scenario
15. Possible bearish scenario
16. Potential entry zone, if clearly identifiable
17. Stop-loss idea, if clearly identifiable
18. Take-profit idea, if clearly identifiable
19. Risk-to-reward assessment
20. Invalidation conditions
21. Confidence level from 0 to 100
22. A concise explanation of your reasoning

Return the result as valid JSON using exactly this structure:

{
  "marketBias": "",
  "trend": "",
  "marketStructure": "",
  "higherHighs": [],
  "higherLows": [],
  "lowerHighs": [],
  "lowerLows": [],
  "bos": "",
  "choch": "",
  "support": [],
  "resistance": [],
  "liquidity": "",
  "priceAction": "",
  "bullishScenario": "",
  "bearishScenario": "",
  "entry": "",
  "stopLoss": "",
  "takeProfit": "",
  "riskReward": "",
  "invalidation": "",
  "confidence": 0,
  "reasoning": ""
}
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: prompt
                },
                {
                  type: "input_image",
                  image_url: image
                }
              ]
            }
          ],
          max_output_tokens: 2500
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API Error:", data);

      return res.status(response.status).json({
        success: false,
        error:
          data?.error?.message ||
          "OpenAI API request failed."
      });
    }

    // Extract the model's text output.
    const outputText =
      data.output_text ||
      data.output
        ?.flatMap(item => item.content || [])
        ?.filter(item => item.type === "output_text")
        ?.map(item => item.text)
        ?.join("") ||
      "";

    if (!outputText) {
      return res.status(500).json({
        success: false,
        error: "The AI returned an empty response."
      });
    }

    // Remove accidental Markdown code fences.
    const cleanedText = outputText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let analysis;

    try {
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("AI JSON Parse Error:", parseError);
      console.error("AI Output:", outputText);

      return res.status(500).json({
        success: false,
        error: "The AI returned an invalid analysis format.",
        raw: outputText
      });
    }

    return res.status(200).json({
      success: true,
      symbol: symbol || null,
      timeframe: timeframe || null,
      analysis
    });

  } catch (error) {
    console.error("AI Analysis Server Error:", error);

    return res.status(500).json({
      success: false,
      error: "Server error while analyzing the chart."
    });
  }
}
