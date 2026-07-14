/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** AI Provider - Choose which AI provider to use. */
  "provider": "gemini" | "openai" | "deepseek" | "groq" | "custom",
  /** API Key - Your API key for the selected provider. */
  "apiKey": string,
  /** Custom Base URL - Base URL for custom OpenAI-compatible API (only used when provider is 'Custom'). */
  "customBaseUrl"?: string,
  /** Custom Model - Model name for custom provider (only used when provider is 'Custom'). */
  "customModel"?: string,
  /** Pause History - Stop saving results to history. */
  "isHistoryPaused": boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `improve-selected-text` command */
  export type ImproveSelectedText = ExtensionPreferences & {}
  /** Preferences accessible in the `refine-and-translate` command */
  export type RefineAndTranslate = ExtensionPreferences & {}
  /** Preferences accessible in the `history` command */
  export type History = ExtensionPreferences & {}
  /** Preferences accessible in the `practice-vocab` command */
  export type PracticeVocab = ExtensionPreferences & {}
  /** Preferences accessible in the `fix-inline` command */
  export type FixInline = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `improve-selected-text` command */
  export type ImproveSelectedText = {}
  /** Arguments passed to the `refine-and-translate` command */
  export type RefineAndTranslate = {
  /** Text to refine & translate... */
  "text": string
}
  /** Arguments passed to the `history` command */
  export type History = {}
  /** Arguments passed to the `practice-vocab` command */
  export type PracticeVocab = {}
  /** Arguments passed to the `fix-inline` command */
  export type FixInline = {}
}

