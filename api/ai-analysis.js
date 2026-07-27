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

    const { image, pair } = req.body || {};

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "No chart image was provided."
      });
    }

    // Make sure the image is a valid data URL
    if (!image.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        error: "Invalid chart image format. Please upload a valid image."
      });
    }

    const symbol = pair || "EUR/USD";

    // More specific and detailed prompt for accurate analysis
    const prompt = `
You are an expert forex technical analyst. Analyze this forex chart image carefully and provide a detailed technical analysis.

CHART INFORMATION:
- Instrument: ${symbol}
- The chart shows price action with candlesticks

Please analyze the chart and provide the following in a structured JSON format:

1. MARKET BIAS: Determine if the market is Bullish, Bearish, or Neutral based on the overall price action.

2. TREND: Describe the current trend (e.g., "Strong uptrend with higher highs and higher lows", "Downtrend with lower lows and lower highs", "Range-bound/consolidation", etc.)

3. PRICE ACTION: Describe what you see in the price action. Include:
   - Recent price movements
   - Candlestick patterns if visible
   - Momentum indicators if visible
   - Breakouts or breakdowns
   - Key levels being tested

4. SUPPORT LEVELS: Identify 2-3 key support levels visible on the chart with specific price values.

5. RESISTANCE LEVELS: Identify 2-3 key resistance levels visible on the chart with specific price values.

6. ENTRY ZONE: Based on the chart, what would be a good entry zone for a trade?

7. STOP LOSS: Where would you place a stop loss based on the chart structure?

8. TAKE PROFIT: Where would you place a take profit based on the chart structure?

9. RISK/REWARD: Calculate the risk to reward ratio based on your entry, stop loss, and take profit levels.

10. INVALIDATION: At what price level would this analysis be invalidated?

11. CONFIDENCE: Rate your confidence in this analysis from 0-100.

12. REASONING: Provide a brief explanation of your analysis reasoning.

13. BULLISH SCENARIO: Describe what would confirm a bullish outcome.

14. BEARISH SCENARIO: Describe what would confirm a bearish outcome.

Return ONLY valid JSON with this exact structure. Be specific with price levels based on what you see in the chart.
Do not use markdown. Return ONLY the JSON object.

{
  "marketBias": "",
  "trend": "",
  "priceAction": "",
  "support": [],
  "resistance": [],
  "entry": "",
  "stopLoss": "",
  "takeProfit": "",
  "riskReward": "",
  "invalidation": "",
  "confidence": 0,
  "reasoning": "",
  "bullishScenario": "",
  "bearishScenario": ""
}`;

    console.log("Sending to OpenAI with image...");
    
    // Try multiple models if needed
    let response;
    let data;
    let modelsToTry = ["gpt-4o", "gpt-4-vision-preview"];
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        console.log(`Trying model: ${model}`);
        
        response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: prompt
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: image,
                        detail: "high"
                      }
                    }
                  ]
                }
              ],
              max_tokens: 2000,
              temperature: 0.3,
              response_format: { type: "json_object" }
            })
          }
        );

        data = await response.json();

        if (response.ok) {
          console.log(`Success with model: ${model}`);
          break;
        } else {
          console.log(`Model ${model} failed:`, data?.error?.message);
          lastError = data?.error?.message;
        }
      } catch (modelError) {
        console.log(`Model ${model} error:`, modelError.message);
        lastError = modelError.message;
        continue;
      }
    }

    // If all models failed, return specific error
    if (!response || !response.ok) {
      console.error("All OpenAI models failed:", lastError);
      
      // Return a structured error response
      return res.status(500).json({
        success: false,
        error: "AI analysis failed. Please check your OpenAI API key and try again.",
        details: lastError || "All models failed"
      });
    }

    // Extract the response
    let outputText = data.choices?.[0]?.message?.content || "";

    if (!outputText) {
      return res.status(500).json({
        success: false,
        error: "OpenAI returned an empty response."
      });
    }

    // Clean the response - remove markdown
    let cleanedText = outputText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // Try to parse JSON
    let analysis = null;
    let parseError = null;

    try {
      // First attempt: direct parse
      analysis = JSON.parse(cleanedText);
    } catch (e) {
      parseError = e;
      console.log("Direct parse failed, attempting to extract JSON...");
      
      // Second attempt: find JSON in the text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0]);
          console.log("Successfully extracted JSON from response");
        } catch (e2) {
          parseError = e2;
          console.log("Failed to extract JSON from response");
        }
      }
    }

    // If we still don't have analysis, try to manually parse
    if (!analysis) {
      console.log("Attempting manual JSON extraction...");
      console.log("Raw output:", outputText.substring(0, 500));
      
      // Try to find any JSON-like structure
      const jsonRegex = /\{[^{}]*"marketBias"[^{}]*\}/s;
      const match = outputText.match(jsonRegex);
      if (match) {
        try {
          analysis = JSON.parse(match[0]);
        } catch (e) {
          console.log("Manual extraction failed");
        }
      }
    }

    // If parsing still fails, return a specific error
    if (!analysis) {
      console.error("Failed to parse AI response:", outputText);
      return res.status(500).json({
        success: false,
        error: "Failed to parse AI analysis response. The AI may have returned an unexpected format.",
        rawResponse: outputText.substring(0, 500) // Include first 500 chars for debugging
      });
    }

    // Validate and structure the analysis
    const structuredAnalysis = {
      marketBias: analysis.marketBias || "Neutral",
      trend: analysis.trend || "Sideways",
      priceAction: analysis.priceAction || "No clear price action identified.",
      support: Array.isArray(analysis.support) ? analysis.support : ["Not clearly visible on chart"],
      resistance: Array.isArray(analysis.resistance) ? analysis.resistance : ["Not clearly visible on chart"],
      entry: analysis.entry || "Not clearly visible on chart",
      stopLoss: analysis.stopLoss || "Not clearly visible on chart",
      takeProfit: analysis.takeProfit || "Not clearly visible on chart",
      riskReward: analysis.riskReward || "Not calculable from chart",
      invalidation: analysis.invalidation || "Not clearly visible on chart",
      confidence: typeof analysis.confidence === "number" ? Math.min(100, Math.max(0, analysis.confidence)) : 50,
      reasoning: analysis.reasoning || "Analysis completed.",
      bullishScenario: analysis.bullishScenario || "Not clearly defined from chart",
      bearishScenario: analysis.bearishScenario || "Not clearly defined from chart"
    };

    return res.status(200).json({
      success: true,
      symbol: symbol,
      analysis: structuredAnalysis
    });

  } catch (error) {
    console.error("AI Analysis Server Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while analyzing the chart: " + error.message
    });
  }
}