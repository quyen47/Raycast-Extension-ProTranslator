import { List, Icon, Color, ActionPanel, Action } from "@raycast/api";
import { CommandType } from "../types";
import CustomPromptForm from "./CustomPromptForm";

const commandIcons: Record<CommandType, { source: Icon; tintColor: Color }> = {
  [CommandType.Fix]: { source: Icon.Check, tintColor: Color.Green },
  [CommandType.Paraphrase]: { source: Icon.Pencil, tintColor: Color.Blue },
  [CommandType.ToneChange]: { source: Icon.Raindrop, tintColor: Color.Orange },
  [CommandType.ContinueText]: {
    source: Icon.ShortParagraph,
    tintColor: Color.Yellow,
  },
};

export default function CommandList({
  onExecute,
  searchText,
}: {
  onExecute: (commandName: string, customPrompt?: string) => void;
  searchText: string;
}) {
  return (
    <List.Section title="Commands">
      {Object.values(CommandType).map((command) => (
        <List.Item
          key={command}
          title={command}
          icon={commandIcons[command]}
          subtitle={
            searchText
              ? `"${searchText.substring(0, 60)}${searchText.length > 60 ? "..." : ""}"`
              : ""
          }
          actions={
            <ActionPanel>
              <Action
                title={`Execute ${command}`}
                icon={commandIcons[command]}
                onAction={() => onExecute(command)}
              />
            </ActionPanel>
          }
        />
      ))}

      <List.Item
        title="Custom Prompt..."
        icon={{ source: Icon.Terminal, tintColor: Color.Purple }}
        subtitle="Write your own instruction for the AI"
        actions={
          <ActionPanel>
            <Action.Push
              title="Enter Custom Prompt"
              icon={Icon.Pencil}
              target={
                <CustomPromptForm
                  originalText={searchText}
                  onExecute={(prompt) => onExecute("Custom Prompt", prompt)}
                />
              }
            />
          </ActionPanel>
        }
      />
    </List.Section>
  );
}
