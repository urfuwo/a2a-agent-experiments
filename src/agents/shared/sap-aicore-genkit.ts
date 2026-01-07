/**
 * GenKit Plugin for SAP AI Core Orchestration Service
 * 
 * This plugin allows GenKit to use SAP AI Core models instead of direct Gemini API.
 * Supports multiple model providers through SAP: OpenAI, Anthropic, Google, Mistral.
 */

import { z, type Genkit } from "genkit";
import { modelRef, type ModelReference, type MessageData, type CandidateData } from "genkit/model";
import { genkitPlugin, type GenkitPlugin } from "genkit/plugin";
import { OrchestrationClient } from "@sap-ai-sdk/orchestration";
import type {
  ChatMessage,
  UserChatMessage,
  AssistantChatMessage,
  SystemChatMessage,
} from "@sap-ai-sdk/orchestration";

/**
 * Configuration for SAP AI Core plugin
 */
export interface SapAiCoreConfig {
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  baseUrl?: string;
  resourceGroup?: string;
}

/**
 * Supported SAP AI Core models
 */
export type SapAiCoreModelId =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4"
  | "anthropic--claude-3.5-sonnet"
  | "anthropic--claude-3-opus"
  | "anthropic--claude-3-haiku"
  | "gemini-2.5-flash"
  | "gemini-2.0-flash";

/**
 * Model configuration schema
 */
const SapAiCoreConfigSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().optional(),
  topP: z.number().min(0).max(1).optional(),
}).passthrough();

/**
 * Convert GenKit messages to SAP Orchestration format
 */
function convertGenkitToSapMessages(messages: MessageData[]): ChatMessage[] {
  const sapMessages: ChatMessage[] = [];

  for (const message of messages) {
    const role = message.role;
    
    // Extract text content from parts
    const textParts = message.content.filter(
      (part): part is { text: string } => 
        "text" in part && typeof part.text === "string"
    );
    
    if (textParts.length === 0) {
      continue; // Skip messages with no text content
    }

    const content = textParts.map((part) => part.text).join("\n");

    if (role === "user") {
      const userMessage: UserChatMessage = {
        role: "user",
        content,
      };
      sapMessages.push(userMessage);
    } else if (role === "model") {
      const assistantMessage: AssistantChatMessage = {
        role: "assistant",
        content,
      };
      sapMessages.push(assistantMessage);
    } else if (role === "system") {
      const systemMessage: SystemChatMessage = {
        role: "system",
        content,
      };
      sapMessages.push(systemMessage);
    }
  }

  return sapMessages;
}

/**
 * Convert SAP response to GenKit format
 */
function convertSapToGenkitCandidate(response: any): CandidateData {
  let text = "";

  // Extract text content from response
  if (typeof response === "string") {
    text = response;
  } else if (response && typeof response.getContent === "function") {
    const content = response.getContent();
    text = content !== null && content !== undefined ? String(content) : "";
  } else if (response && response.content) {
    text = response.content;
  } else if (
    response &&
    response.choices &&
    response.choices[0]?.message?.content
  ) {
    text = response.choices[0].message.content;
  }

  return {
    index: 0,
    message: {
      role: "model",
      content: [{ text }],
    },
    finishReason: "stop",
  };
}

/**
 * Create SAP AI Core service key from credentials
 */
function createServiceKey(config: SapAiCoreConfig): void {
  const clientId = config.clientId || process.env.SAP_AI_CORE_CLIENT_ID;
  const clientSecret =
    config.clientSecret || process.env.SAP_AI_CORE_CLIENT_SECRET;
  const tokenUrl = config.tokenUrl || process.env.SAP_AI_CORE_TOKEN_URL;
  const baseUrl = config.baseUrl || process.env.SAP_AI_CORE_BASE_URL;

  if (!clientId || !clientSecret || !tokenUrl || !baseUrl) {
    throw new Error(
      "SAP AI Core credentials not found. Please set environment variables:\n" +
        "  SAP_AI_CORE_CLIENT_ID\n" +
        "  SAP_AI_CORE_CLIENT_SECRET\n" +
        "  SAP_AI_CORE_TOKEN_URL\n" +
        "  SAP_AI_CORE_BASE_URL"
    );
  }

  // Normalize URLs by removing trailing slashes
  const normalizeUrl = (url: string) => url.replace(/\/+$/, "");

  const serviceKey = {
    clientid: clientId,
    clientsecret: clientSecret,
    url: normalizeUrl(tokenUrl),
    serviceurls: {
      AI_API_URL: normalizeUrl(baseUrl),
    },
  };

  process.env.AICORE_SERVICE_KEY = JSON.stringify(serviceKey);
}

/**
 * Define a SAP AI Core model for GenKit
 */
function defineSapAiCoreModel(
  ai: Genkit,
  modelId: SapAiCoreModelId,
  config: SapAiCoreConfig
): void {
  const resourceGroup =
    config.resourceGroup ||
    process.env.SAP_AI_CORE_RESOURCE_GROUP ||
    "default";

  ai.defineModel(
    {
      name: `sap-aicore/${modelId}`,
      label: `SAP AI Core - ${modelId}`,
      supports: {
        multiturn: true,
        media: false,
        tools: false,
        systemRole: true,
        output: ["text"],
      },
      configSchema: SapAiCoreConfigSchema,
    },
    async (request, streamingCallback) => {
      // Convert GenKit messages to SAP format
      const sapMessages = convertGenkitToSapMessages(request.messages);

      if (sapMessages.length === 0) {
        throw new Error("No valid messages to send to SAP AI Core");
      }

      // Build orchestration configuration
      const orchestrationConfig: any = {
        llm: {
          model_name: modelId,
          model_params: {
            temperature: request.config?.temperature ?? 0.7,
            max_tokens: request.config?.maxOutputTokens ?? 4096,
          },
        },
      };

      // Create orchestration client
      const client = new OrchestrationClient(orchestrationConfig, {
        resourceGroup,
      });

      console.log(
        `[SAP AI Core] Sending request to model: ${modelId}, messages: ${sapMessages.length}`
      );

      try {
        // Check if streaming is requested
        if (streamingCallback) {
          // Streaming mode
          const response = await client.stream({
            messages: sapMessages,
          });

          // Stream text chunks
          for await (const chunk of response.stream) {
            const deltaContent = chunk.getDeltaContent();
            if (deltaContent) {
              streamingCallback({
                index: 0,
                content: [{ text: deltaContent }],
              });
            }
          }

          // Log token usage
          const tokenUsage = response.getTokenUsage?.();
          if (tokenUsage) {
            console.log(
              `[SAP AI Core] Token usage - Input: ${tokenUsage.prompt_tokens || 0}, ` +
                `Output: ${tokenUsage.completion_tokens || 0}, ` +
                `Total: ${tokenUsage.total_tokens || 0}`
            );
          }

          return {
            candidates: [convertSapToGenkitCandidate(response)],
            usage: {
              inputTokens: tokenUsage?.prompt_tokens || 0,
              outputTokens: tokenUsage?.completion_tokens || 0,
              totalTokens: tokenUsage?.total_tokens || 0,
            },
          };
        } else {
          // Non-streaming mode
          const response = await client.chatCompletion({
            messages: sapMessages,
          });

          // Log token usage
          const tokenUsage = response.getTokenUsage?.();
          if (tokenUsage) {
            console.log(
              `[SAP AI Core] Token usage - Input: ${tokenUsage.prompt_tokens || 0}, ` +
                `Output: ${tokenUsage.completion_tokens || 0}, ` +
                `Total: ${tokenUsage.total_tokens || 0}`
            );
          }

          return {
            candidates: [convertSapToGenkitCandidate(response)],
            usage: {
              inputTokens: tokenUsage?.prompt_tokens || 0,
              outputTokens: tokenUsage?.completion_tokens || 0,
              totalTokens: tokenUsage?.total_tokens || 0,
            },
          };
        }
      } catch (error) {
        throw new Error(
          `SAP AI Core error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}

/**
 * SAP AI Core plugin for GenKit
 */
export function sapAiCorePlugin(config: SapAiCoreConfig = {}): GenkitPlugin {
  // Create service key for SAP AI SDK
  createServiceKey(config);

  return genkitPlugin(
    "sap-aicore",
    async (ai: Genkit) => {
      // Define available models
      defineSapAiCoreModel(ai, "gpt-4o", config);
      defineSapAiCoreModel(ai, "gpt-4o-mini", config);
      defineSapAiCoreModel(ai, "gpt-4", config);
      defineSapAiCoreModel(ai, "anthropic--claude-3.5-sonnet", config);
      defineSapAiCoreModel(ai, "anthropic--claude-3-opus", config);
      defineSapAiCoreModel(ai, "anthropic--claude-3-haiku", config);
      defineSapAiCoreModel(ai, "gemini-2.5-flash", config);
      defineSapAiCoreModel(ai, "gemini-2.0-flash", config);
    }
  );
}

/**
 * Plugin type with model helper
 */
export type SapAiCorePlugin = {
  (params?: SapAiCoreConfig): GenkitPlugin;
  model(
    name: SapAiCoreModelId,
    config?: z.infer<typeof SapAiCoreConfigSchema>
  ): ModelReference<typeof SapAiCoreConfigSchema>;
};

/**
 * SAP AI Core plugin for GenKit
 */
export const sapAiCore = sapAiCorePlugin as SapAiCorePlugin;

// Provide model helper function
(sapAiCore as any).model = (
  name: SapAiCoreModelId,
  config?: any
): ModelReference<typeof SapAiCoreConfigSchema> => {
  return modelRef({
    name: `sap-aicore/${name}`,
    config,
    configSchema: SapAiCoreConfigSchema,
  });
};
