import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { Chat } from "../types";
import FlashcardForm from "./FlashcardForm";
import { playAudio } from "../utils/audioUtil";

export default function ResultSection({
  chat,
  isShowingDetail,
  setIsShowingDetail,
}: {
  chat: Chat;
  isShowingDetail: boolean;
  setIsShowingDetail: (value: boolean) => void;
}) {
  if (!chat.answer) return null;

  const parts = chat.answer.split("\n\n---EXPLANATION---\n\n");
  const fixedText = parts[0];
  const explanation = parts.length > 1 ? parts[1] : null;

  const detailMarkdown = `## Result\n\n${fixedText}\n\n${explanation ? `## Explanation\n\n${explanation}\n\n` : ""}---\n\n## Original\n\n${chat.question}`;

  return (
    <List.Section title="Result">
      <List.Item
        id="ai-response"
        title="AI Response"
        subtitle={isShowingDetail ? undefined : fixedText}
        detail={<List.Item.Detail markdown={detailMarkdown} />}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Result" content={fixedText} />
            <Action
              title="Listen to Result"
              icon={Icon.SpeakerOn}
              onAction={() => playAudio(fixedText)}
              shortcut={{ modifiers: ["cmd"], key: "p" }}
            />
            <Action.Push
              title="Save to Flashcards"
              icon={Icon.Star}
              target={
                <FlashcardForm
                  initialTerm={fixedText}
                  initialDefinition={chat.question}
                />
              }
              shortcut={{ modifiers: ["cmd"], key: "s" }}
            />
            <Action.Paste title="Paste Result" content={fixedText} />
            <Action
              title={isShowingDetail ? "Hide Detail" : "Show Detail"}
              icon={isShowingDetail ? Icon.EyeDisabled : Icon.Eye}
              onAction={() => setIsShowingDetail(!isShowingDetail)}
            />
            <Action.CopyToClipboard
              title="Copy Original"
              content={chat.question}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
            <Action
              title="Listen to Original"
              icon={Icon.SpeakerOn}
              onAction={() => playAudio(chat.question)}
            />
          </ActionPanel>
        }
      />
    </List.Section>
  );
}
