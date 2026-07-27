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

    // Make sure the image is a supported data URL.
    if (!image.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        error: "Invalid chart image format."
      });
    }

    // Extract the symbol from the pair or use default
    const symbol = pair || "EUR/USD";
    const timeframe = "Unknown"; // You can pass this from frontend

    const prompt = `
You are the AI market-analysis assistant inside a forex application called FOREX AST.

Analyze the uploaded forex chart carefully.

Instrument: ${symbol}
Timeframe: ${timeframe}

Provide a structured analysis.

IMPORTANT:
- Do not claim certainty about future price movement.
- Do not invent exact prices that cannot be read from the chart.
- Clearly separate observations from possible trade scenarios.
- If the chart is unclear, say so.

Analyze the chart and provide:

1. Market bias: Bullish, Bearish, or Neutral
2. Overall trend description
3. Price action observations
4. Support levels (list the key support levels you can identify)
5. Resistance levels (list the key resistance levels you can identify)
6. Potential entry zone, if clearly identifiable
7. Stop-loss idea, if clearly identifiable
8. Take-profit idea, if clearly identifiable
9. Risk-to-reward assessment
10. Invalidation conditions
11. Confidence level from 0 to 100
12. A concise explanation of your reasoning
13. Bullish scenario
14. Bearish scenario

Return ONLY valid JSON using exactly this structure, with no additional text:

{
  "marketBias": "Bullish, Bearish, or Neutral",
  "trend": "Description of the trend",
  "priceAction": "Description of price action observations",
  "support": ["level1", "level2"],
  "resistance": ["level1", "level2"],
  "entry": "Entry zone description",
  "stopLoss": "Stop-loss description",
  "takeProfit": "Take-profit description",
  "riskReward": "Risk-to-reward ratio",
  "invalidation": "Invalidation conditions",
  "confidence": 0,
  "reasoning": "Explanation of the analysis",
  "bullishScenario": "Bullish scenario description",
  "bearishScenario": "Bearish scenario description"
}`;

    // Use the Chat Completions API which is more stable
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4-vision-preview",
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
          max_tokens: 2500,
          temperature: 0.7
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API Error:", data);

      // Try fallback to gpt-4o if gpt-4-vision-preview fails
      if (response.status === 404) {
        console.log("Falling back to gpt-4o model...");
        const fallbackResponse = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: "gpt-4o",
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
              max_tokens: 2500,
              temperature: 0.7
            })
          }
        );

        const fallbackData = await fallbackResponse.json();

        if (!fallbackResponse.ok) {
          throw new Error(fallbackData?.error?.message || "OpenAI API request failed.");
        }

        return processOpenAIResponse(fallbackData, symbol, timeframe, res);
      }

      return res.status(response.status).json({
        success: false,
        error: data?.error?.message || "OpenAI API request failed."
      });
    }

    return processOpenAIResponse(data, symbol, timeframe, res);

  } catch (error) {
    console.error("AI Analysis Server Error:", error);

    return res.status(500).json({
      success: false,
      error: "Server error while analyzing the chart: " + error.message
    });
  }
}

function processOpenAIResponse(data, symbol, timeframe, res) {
  try {
    // Extract the model's text output
    const outputText = data.choices?.[0]?.message?.content || "";

    if (!outputText) {
      return res.status(500).json({
        success: false,
        error: "The AI returned an empty response."
      });
    }

    // Remove accidental Markdown code fences
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

      // Try to extract JSON from the text if it's wrapped
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0]);
        } catch (secondError) {
          // If still can't parse, return error
          return res.status(500).json({
            success: false,
            error: "The AI returned an invalid analysis format.",
            raw: outputText
          });
        }
      } else {
        return res.status(500).json({
          success: false,
          error: "The AI returned an invalid analysis format.",
          raw: outputText
        });
      }
    }

    return res.status(200).json({
      success: true,
      symbol: symbol || null,
      timeframe: timeframe || null,
      analysis
    });

  } catch (error) {
    console.error("Error processing OpenAI response:", error);
    return res.status(500).json({
      success: false,
      error: "Error processing AI response: " + error.message
    });
  }
}