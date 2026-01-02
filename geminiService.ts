
import { GoogleGenAI } from "@google/genai";

export const getSmartWeekendSuggestion = async (isBusy: boolean): Promise<string> => {
  // Use a fresh instance with the required initialization pattern
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const prompt = isBusy 
      ? "Give me a short, 3-5 word productive or necessary weekend task (e.g., 'Groceries and meal prep', 'Home renovation')."
      : "Give me a short, 3-5 word fun weekend activity (e.g., 'Hike in the woods', 'Try new ramen spot').";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        maxOutputTokens: 20,
        temperature: 0.8,
      }
    });

    return response.text?.trim() || (isBusy ? "Important tasks" : "Fun activity");
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return isBusy ? "Busy day" : "Free day";
  }
};
