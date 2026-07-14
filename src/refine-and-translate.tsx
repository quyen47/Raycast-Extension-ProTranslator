import { useState, useEffect } from "react";
import {
  List,
  showToast,
  Toast,
  ActionPanel,
  Action,
  Icon,
} from "@raycast/api";
import { AIModule, getProviderConfig } from "./utils/providerUtil";
import FlashcardForm from "./components/FlashcardForm";
import { playAudio } from "./utils/audioUtil";
import { useHistory } from "./utils/historyUtil";
import { v4 as uuidv4 } from "uuid";
import { getRobustSelectedText } from "./utils/textUtil";

interface Result {
  refined: string;
  translated: string;
}

interface CommandArguments {
  text?: string;
}

export default function Command(props: { arguments: CommandArguments }) {
  const [isLoading, setIsLoading] = useState(true);
  const [originalText, setOriginalText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const { add } = useHistory();

  useEffect(() => {
    let isMounted = true;

    async function fetchAndProcess() {
      try {
        let textToProcess = props.arguments.text;

        if (!textToProcess || textToProcess.trim() === "") {
          const selectedText = await getRobustSelectedText();
          if (selectedText && selectedText.trim() !== "") {
            textToProcess = selectedText;
          }
        }

        if (!isMounted) return;

        if (!textToProcess || textToProcess.trim() === "") {
          if (isMounted) setIsLoading(false);
          return; // Wait for user to input text
        }

        if (isMounted) setOriginalText(textToProcess.trim());
        await processText(textToProcess.trim());
      } catch {
        if (!isMounted) return;
        // Only error if there's no argument provided either
        if (!props.arguments.text || props.arguments.text.trim() === "") {
          if (isMounted) setIsLoading(false);
        } else {
          if (isMounted) setOriginalText(props.arguments.text.trim());
          await processText(props.arguments.text.trim());
        }
      }
    }
    fetchAndProcess();

    return () => {
      isMounted = false;
    };
  }, [props.arguments.text]);

  async function processText(text: string) {
    try {
      const config = getProviderConfig();

      if (!config.apiKey) {
        await showToast({
          style: Toast.Style.Failure,
          title: "API Key Required",
        });
        setIsLoading(false);
        return;
      }

      if (config.baseUrl === "" || config.model === "") {
        await showToast({
          style: Toast.Style.Failure,
          title: "Custom Provider Not Configured",
        });
        setIsLoading(false);
        return;
      }

      const ai = new AIModule(config);
      const res = await ai.refineAndTranslate(text);
      setResult(res);
      setIsLoading(false);

      // Save to History
      await add({
        id: uuidv4(),
        question: text,
        answer: `[Refined]\n${res.refined}\n\n[Translated]\n${res.translated}`,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      setIsLoading(false);
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message:
          error instanceof Error ? error.message : "Something went wrong",
      });
    }
  }

  return (
    <List isLoading={isLoading} isShowingDetail>
      {!originalText && !isLoading && (
        <List.EmptyView
          title="No Text Provided"
          description="Select text in another app, OR type your text in Raycast search bar before pressing Enter."
          icon={Icon.TextDocument}
        />
      )}

      {result && (
        <>
          <List.Item
            title="Refined Original"
            icon={Icon.Pencil}
            detail={
              <List.Item.Detail
                markdown={`## Refined Text\n\n${result.refined}`}
              />
            }
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Refined Text"
                  content={result.refined}
                />
                <Action
                  title="Listen"
                  icon={Icon.SpeakerOn}
                  onAction={() => playAudio(result.refined)}
                  shortcut={{ modifiers: ["cmd"], key: "p" }}
                />
                <Action.Push
                  title="Save to Flashcards"
                  icon={Icon.Star}
                  target={
                    <FlashcardForm
                      initialTerm={result.refined}
                      initialDefinition={result.translated}
                    />
                  }
                  shortcut={{ modifiers: ["cmd"], key: "s" }}
                />
                <Action.Paste
                  title="Paste Refined Text"
                  content={result.refined}
                />
              </ActionPanel>
            }
          />
          <List.Item
            title="Translated"
            icon={Icon.Globe}
            detail={
              <List.Item.Detail
                markdown={`## Translated Text\n\n${result.translated}`}
              />
            }
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Translated Text"
                  content={result.translated}
                />
                <Action
                  title="Listen"
                  icon={Icon.SpeakerOn}
                  onAction={() => playAudio(result.translated)}
                  shortcut={{ modifiers: ["cmd"], key: "p" }}
                />
                <Action.Push
                  title="Save to Flashcards"
                  icon={Icon.Star}
                  target={
                    <FlashcardForm
                      initialTerm={result.translated}
                      initialDefinition={result.refined}
                    />
                  }
                  shortcut={{ modifiers: ["cmd"], key: "s" }}
                />
                <Action.Paste
                  title="Paste Translated Text"
                  content={result.translated}
                />
              </ActionPanel>
            }
          />
        </>
      )}
    </List>
  );
}
