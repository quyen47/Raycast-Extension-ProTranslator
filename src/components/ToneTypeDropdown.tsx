import { List } from "@raycast/api";
import { ToneType } from "../types";

export default function ToneTypeDropdown({
  onToneChange,
}: {
  onToneChange: (tone: ToneType) => void;
}) {
  return (
    <List.Dropdown
      tooltip="Select Tone"
      storeValue={true}
      onChange={(value) => onToneChange(value as ToneType)}
    >
      <List.Dropdown.Section title="Tone">
        {Object.values(ToneType).map((tone) => (
          <List.Dropdown.Item key={tone} title={tone} value={tone} />
        ))}
      </List.Dropdown.Section>
    </List.Dropdown>
  );
}
