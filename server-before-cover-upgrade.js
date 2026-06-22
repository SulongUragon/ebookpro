import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static("public"));

app.post("/api/generate-ebook", async (req, res) => {
  try {
    const {
      topic,
      audience,
      promise,
      language = "Taglish",
      style = "Premium Modern",
      price = "₱499",
      depth = "Premium Paid Ebook"
    } = req.body;

    if (!topic || !audience || !promise) {
      return res.status(400).json({
        error: "Topic, audience, and promise are required."
      });
    }

    const prompt = `
Act as an elite ebook strategist, premium digital product creator, conversion copywriter, visual director, and Canva/Figma layout planner.

Create a powerful premium ebook product.

Topic: ${topic}
Target Audience: ${audience}
Main Promise: ${promise}
Language: ${language}
Visual Style: ${style}
Price Positioning: ${price}
Ebook Type: ${depth}

Return ONLY valid JSON. No markdown. No explanations outside JSON.

Use this exact JSON structure:

{
  "strategy": {
    "bestAngle": "",
    "targetBuyer": "",
    "primaryPromise": "",
    "positioningStatement": "",
    "whyItWillSell": "",
    "recommendedPrice": "",
    "premiumValueStack": []
  },
  "titles": {
    "selectedTitle": "",
    "selectedSubtitle": "",
    "alternativeTitles": [],
    "alternativeSubtitles": []
  },
  "coverConcept": {
    "visualTheme": "",
    "titlePlacement": "",
    "subtitlePlacement": "",
    "backgroundStyle": "",
    "colorPalette": [
      { "name": "", "hex": "" },
      { "name": "", "hex": "" },
      { "name": "", "hex": "" }
    ],
    "fontDirection": "",
    "imageIdea": "",
    "mood": "",
    "buyerAttractionReason": "",
    "aiCoverPrompt": ""
  },
  "visualIdentity": {
    "brandFeel": "",
    "fontPairing": "",
    "iconStyle": "",
    "illustrationStyle": "",
    "photoStyle": "",
    "pageLayoutStyle": "",
    "sectionDividerStyle": "",
    "calloutBoxStyle": "",
    "quoteBoxStyle": "",
    "worksheetStyle": "",
    "premiumDesignRules": []
  },
  "tableOfContents": [
    {
      "chapterNumber": 1,
      "chapterTitle": "",
      "chapterPromise": "",
      "readerOutcome": ""
    }
  ],
  "chapters": [
    {
      "chapterNumber": 1,
      "chapterTitle": "",
      "chapterPurpose": "",
      "opening": "",
      "coreLesson": "",
      "practicalExamples": [],
      "stepByStepProcess": [],
      "commonMistakes": [],
      "actionChecklist": [],
      "miniWorksheet": {
        "title": "",
        "instructions": "",
        "fields": []
      },
      "keyTakeaway": "",
      "visualDirections": {
        "heroImageIdea": "",
        "supportingGraphics": [],
        "infographicIdea": "",
        "diagramIdea": "",
        "aiImagePrompts": []
      }
    }
  ],
  "frameworks": [
    {
      "name": "",
      "purpose": "",
      "visualLayout": "",
      "explanation": "",
      "howToUse": "",
      "designDirection": "",
      "aiGraphicPrompt": ""
    }
  ],
  "worksheets": [
    {
      "title": "",
      "type": "",
      "purpose": "",
      "instructions": "",
      "fields": [],
      "designNotes": ""
    }
  ],
  "salesAssets": {
    "productDescription": "",
    "shortSalesCaption": "",
    "longSalesCaption": "",
    "landingPageHeadline": "",
    "landingPageSubheadline": "",
    "bulletBenefits": [],
    "bonusIdeas": [],
    "launchPost": "",
    "dmSalesScript": ""
  },
  "finalPages": {
    "welcomeLetter": "",
    "howToUseThisEbook": "",
    "quickWinSection": "",
    "finalActionPlan": [],
    "closingMessage": "",
    "finalCTA": "",
    "backCoverCopy": ""
  }
}

Quality rules:
- Create 6 to 8 strong chapters.
- Create at least 5 premium frameworks.
- Create at least 6 worksheets/templates.
- Make it specific, practical, premium, and buyer-attracting.
- Include AI image prompts for the cover and every major chapter visual.
- Write like this ebook can actually be sold.
- Avoid generic content.
`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      input: prompt
    });

    const text = response.output_text;
    const json = extractJson(text);

    res.json(json);
  } catch (error) {
    console.error("Generation error:", error);

    res.status(500).json({
      error: "Failed to generate ebook.",
      details: error.message
    });
  }
});

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("The AI did not return valid JSON.");
    }

    return JSON.parse(match[0]);
  }
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Premium Ebook Generator running at http://localhost:${PORT}`);
});