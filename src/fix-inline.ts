import { showHUD, Clipboard, Toast, showToast } from "@raycast/api";
import { AIModule, getProviderConfig } from "./utils/providerUtil";
import { getRobustSelectedText } from "./utils/textUtil";

export default async function Command() {
  try {
    const textToUse = await getRobustSelectedText();
    if (!textToUse) {
      await showHUD("❌ No text selected or copied");
      return;
    }

    await showHUD("✨ Fixing Grammar...");

    const config = getProviderConfig();
    if (!config.apiKey) {
      await showToast({
        style: Toast.Style.Failure,
        title: "API Key Required",
      });
      return;
    }

    const ai = new AIModule(config);
    const result = await ai.fixGrammar(textToUse.trim());

    // Extract just the fixed text (ignore explanation)
    const fixedText = result.split("\n\n---EXPLANATION---\n\n")[0];

    // Paste the fixed text back, overwriting the selection
    await Clipboard.paste(fixedText);
    await showHUD("✅ Grammar Fixed!");
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message: error instanceof Error ? error.message : "Something went wrong",
    });
  }
}
