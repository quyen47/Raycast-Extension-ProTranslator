import { useState, useEffect } from "react";
import {
  List,
  showToast,
  Toast,
  getSelectedText,
  getPreferenceValues,
  Clipboard,
} from "@raycast/api";
import { AIModule, getProviderConfig } from "./utils/providerUtil";
import { CommandType, ToneType, State, Chat, Preferences } from "./types";
import CommandList from "./components/CommandList";
import ResultSection from "./components/ResultSection";
import ToneTypeDropdown from "./components/ToneTypeDropdown";
import { getIsHistoryPaused } from "./utils";
import { useHistory } from "./utils/historyUtil";
import { v4 as uuidv4 } from "uuid";
import { getRobustSelectedText } from "./utils/textUtil";

const isHistoryPaused = getIsHistoryPaused();

export default function Command() {
  const { add } = useHistory();

  const [state, setState] = useState<State>({
    command: CommandType.Fix,
    toneType: ToneType.Professional,
    isLoading: true,
    chat: {
      id: uuidv4(),
      question: "",
      answer: "",
      created_at: new Date().toISOString(),
    } as Chat,
  });
  const [isShowingDetail, setIsShowingDetail] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    async function fetchSelectedText() {
      try {
        const textToUse = await getRobustSelectedText();

        if (!isMounted) return;

        if (!textToUse) {
          await showToast({
            style: Toast.Style.Failure,
            title: "No Text Found",
            message: "Please select some text or copy it to your clipboard.",
          });
          if (isMounted) setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        if (isMounted)
          setState((prev) => ({
            ...prev,
            isLoading: false,
            chat: { ...prev.chat, question: textToUse },
          }));
      } catch {
        if (!isMounted) return;
        await showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: "Could not read text.",
        });
        if (isMounted) setState((prev) => ({ ...prev, isLoading: false }));
      }
    }
    fetchSelectedText();

    return () => {
      isMounted = false;
    };
  }, []);

  // Reliably jump focus to the AI response after it renders
  useEffect(() => {
    if (state.chat.answer) {
      // Small timeout ensures Raycast has rendered the new List.Item before trying to focus it
      setTimeout(() => setSelectedItemId("ai-response"), 50);
    }
  }, [state.chat.answer]);

  async function executeCommand(commandName: string, customPrompt?: string) {
    if (!state.chat.question) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No Text",
        message: "No text available to process.",
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      command: commandName,
      isLoading: true,
      chat: { ...prev.chat, answer: "" },
    }));

    try {
      const config = getProviderConfig();

      if (!config.apiKey) {
        await showToast({
          style: Toast.Style.Failure,
          title: "API Key Required",
          message: "Please set your API key in extension preferences.",
        });
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      if (config.baseUrl === "" || config.model === "") {
        await showToast({
          style: Toast.Style.Failure,
          title: "Custom Provider Not Configured",
          message: "Please set custom base URL and model in preferences.",
        });
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const ai = new AIModule(config);
      let result = "";

      if (customPrompt) {
        result = await ai.runCustomPrompt(state.chat.question, customPrompt);
      } else {
        switch (commandName) {
          case CommandType.Fix:
            result = await ai.fixGrammar(state.chat.question);
            break;
          case CommandType.Paraphrase:
            result = await ai.paraphrase(state.chat.question);
            break;
          case CommandType.ToneChange:
            result = await ai.changeTone(state.chat.question, state.toneType);
            break;
          case CommandType.ContinueText:
            result = await ai.continueText(state.chat.question);
            break;
        }
      }

      const updatedChat: Chat = {
        ...state.chat,
        answer: result,
        created_at: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        isLoading: false,
        chat: updatedChat,
      }));

      // Auto-show detail panel so the user can read the Grammar Explanation
      if (commandName === CommandType.Fix) {
        setIsShowingDetail(true);
      }

      if (!isHistoryPaused) {
        await add(updatedChat);
      }

      await showToast({
        style: Toast.Style.Success,
        title: "Done!",
        message: `${commandName} completed successfully.`,
      });

      // Auto copy to clipboard for Custom Prompt as requested
      if (commandName === "Custom Prompt") {
        await Clipboard.copy(result);
        await showToast({
          style: Toast.Style.Success,
          title: "Copied to Clipboard!",
        });
      }
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      await showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message:
          error instanceof Error ? error.message : "Something went wrong",
      });
    }
  }

  return (
    <List
      isLoading={state.isLoading}
      isShowingDetail={isShowingDetail}
      selectedItemId={selectedItemId}
      onSelectionChange={setSelectedItemId}
      searchBarAccessory={
        state.command === CommandType.ToneChange ? (
          <ToneTypeDropdown
            onToneChange={(tone) =>
              setState((prev) => ({ ...prev, toneType: tone }))
            }
          />
        ) : undefined
      }
    >
      <ResultSection
        chat={state.chat}
        isShowingDetail={isShowingDetail}
        setIsShowingDetail={setIsShowingDetail}
      />
      {state.chat.question ? (
        <CommandList
          onExecute={executeCommand}
          searchText={state.chat.question}
        />
      ) : (
        <List.EmptyView
          title="No Text Selected"
          description="Select text in another app and try again."
        />
      )}
    </List>
  );
}
