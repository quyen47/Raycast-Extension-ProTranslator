import OpenAI from "openai";
import { ToneType, ProviderConfig, ProviderType } from "../types";
import { getPrefs } from "../utils";

// --- Provider Configuration ---

const PROVIDER_CONFIGS: Record<string, { baseUrl: string; model: string }> = {
  [ProviderType.OpenAI]: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  [ProviderType.Gemini]: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-2.0-flash",
  },
  [ProviderType.DeepSeek]: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  [ProviderType.Groq]: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
};

export function getProviderConfig(): ProviderConfig {
  const prefs = getPrefs();
  const provider = prefs.provider;

  if (provider === ProviderType.Custom) {
    return {
      baseUrl: prefs.customBaseUrl || "",
      model: prefs.customModel || "",
      apiKey: prefs.apiKey,
    };
  }

  const config =
    PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS[ProviderType.Gemini];
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: prefs.apiKey,
  };
}

// --- AI Module ---

export class AIModule {
  private openai: OpenAI;
  private model: string;

  constructor(config: ProviderConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model;
  }

  async fixGrammar(text: string): Promise<string> {
    const prompt = `Fix grammar and spelling mistakes in the following text. Do not rewrite it entirely, just fix errors. Return the result STRICTLY as a JSON object with two keys: "fixed" containing the fixed text, and "explanation" containing a concise bulleted list of grammar mistakes you found and fixed (in Vietnamese, or English if text is Vietnamese). If no errors were found, "explanation" should say "No errors found". Do not include any markdown formatting or backticks outside the JSON. Text: "${text}"`;
    const response = await this.aiRequest(prompt);
    try {
      const start = response.indexOf("{");
      const end = response.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        const jsonStr = response.slice(start, end + 1);
        const parsed = JSON.parse(jsonStr);
        return `${parsed.fixed}\n\n---EXPLANATION---\n\n${parsed.explanation}`;
      }
      return response;
    } catch {
      // Fallback
      return response;
    }
  }

  async paraphrase(text: string): Promise<string> {
    const prompt = `Paraphrase the following text to make it sound more natural and fluent. Only output the paraphrased text, nothing else. Text: "${text}"`;
    return await this.aiRequest(prompt);
  }

  async changeTone(text: string, tone: ToneType): Promise<string> {
    const prompt = `Rewrite the following text in a ${tone.toLowerCase()} tone. Only output the rewritten text, nothing else. Text: "${text}"`;
    return await this.aiRequest(prompt);
  }

  async continueText(text: string): Promise<string> {
    const prompt = `Continue the following text naturally for a few sentences. Only output the continuation, do not repeat the original text. Text: "${text}"`;
    return await this.aiRequest(prompt);
  }

  async runCustomPrompt(text: string, userPrompt: string): Promise<string> {
    const prompt = `${userPrompt}\n\nText: "${text}"`;
    return await this.aiRequest(prompt);
  }

  async refineAndTranslate(
    inputText: string,
  ): Promise<{ refined: string; translated: string }> {
    const prompt = `Please refine the following text. Then, translate it to Vietnamese if it's in English, or to English if it's in Vietnamese. Return the result STRICTLY as a JSON object with two keys: "refined" containing the refined original text, and "translated" containing the translated text. Do not include any markdown formatting, backticks, or other text outside the JSON object. Text to process: "${inputText}"`;
    const response = await this.aiRequest(prompt);
    try {
      const start = response.indexOf("{");
      const end = response.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        const jsonStr = response.slice(start, end + 1);
        return JSON.parse(jsonStr);
      }
      throw new Error("No JSON found");
    } catch {
      // Fallback if the model fails to return JSON
      return {
        refined: "Failed to parse JSON. Raw response:\n" + response,
        translated: "",
      };
    }
  }

  async generateVocabInsight(term: string, definition: string): Promise<string> {
    const prompt = `Act as an expert English Teacher. The user is practicing the vocabulary flashcard:
Term: "${term}"
Definition: "${definition}"

Generate an insight or a mini-exercise for this word.
You MUST return ONLY a valid JSON object with no markdown wrapping. Do not include \`\`\`json or \`\`\`.

Choose randomly between two types: "reading" or "exercise".

If you choose "reading", provide ONE of the following (pick randomly):
- Cambridge Dictionary style definition: word type - pronunciation (IPA) - precise meaning - 1 clear example.
- Root word analysis. If the word does not have a clear root word, pick another option.
- Common collocations or language building blocks containing the word, with examples.
Return this JSON format:
{
  "type": "reading",
  "markdown": "Your engaging explanation here. Do NOT use numbered lists like 1) 2). Write beautifully in Vietnamese, except for the English examples. MUST use blank lines (\\n\\n) to separate sections, bullet points, and paragraphs for readability."
}

If you choose "exercise", provide a fill-in-the-blank sentence where the target word "${term}" is missing.
Return this JSON format:
{
  "type": "exercise",
  "question": "Sentence with a _____ where the word should be.",
  "answer": "${term}",
  "translation": "Vietnamese translation of the full sentence."
}`;
    return await this.aiRequest(prompt);
  }

  private async aiRequest(prompt: string, retries = 3): Promise<string> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                "You are a professional writing assistant. You help fix grammar, paraphrase text, change tone, and continue writing. Always respond in the same language as the input text. Return only the result without any explanation or context.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
        });

        return response.choices[0]?.message?.content?.trim() ?? "";
      } catch (error: unknown) {
        const statusCode = (error as { status?: number }).status;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Rate limit — retry with backoff
        if (statusCode === 429 && attempt < retries - 1) {
          const waitMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        // Specific error messages
        if (statusCode === 429) {
          throw new Error(
            "Rate limit exceeded. Please wait a moment and try again, or check your API quota.",
          );
        }
        if (statusCode === 401) {
          throw new Error(
            "Invalid API key. Please check your key in extension preferences.",
          );
        }
        if (statusCode === 403) {
          throw new Error(
            "Access denied. Your API key may not have permission for this model.",
          );
        }
        if (statusCode === 404) {
          throw new Error(
            `Model "${this.model}" not found. Check your provider/model settings.`,
          );
        }

        throw new Error(errorMessage || "Unknown API error occurred.");
      }
    }
    throw new Error("Failed after multiple retries.");
  }
}
