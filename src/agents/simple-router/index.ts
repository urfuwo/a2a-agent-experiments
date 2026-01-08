import express from "express";
import { v4 as uuidv4 } from "uuid";

import {
  AgentCard,
  Task,
  TaskStatusUpdateEvent,
  TextPart,
  Message,
} from "@a2a-js/sdk";
import {
  InMemoryTaskStore,
  TaskStore,
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
} from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import { ai } from "./genkit.js";

import * as dotenv from "dotenv";
dotenv.config();

// Load the router prompt
const routerPrompt = ai.prompt("router");

/**
 * Simple Router Agent Executor
 * Routes requests to either Lead Manager or Content Editor
 */
class SimpleRouterAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
    const cancelledUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: uuidv4(),
      status: {
        state: "canceled",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: "Routing task cancelled." }],
          taskId: taskId,
          contextId: uuidv4(),
        },
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(cancelledUpdate);
  };

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    const taskId = existingTask?.id || uuidv4();
    const contextId =
      userMessage.contextId || existingTask?.contextId || uuidv4();

    console.log(
      `[SimpleRouterAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId}`
    );

    // Publish initial task if new
    if (!existingTask) {
      const initialTask: Task = {
        kind: "task",
        id: taskId,
        contextId: contextId,
        status: {
          state: "submitted",
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata,
      };
      eventBus.publish(initialTask);
    }

    // Publish working status
    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "working",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: "Analyzing request and routing to appropriate agent..." }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    try {
      // Extract text input from message
      const inputText = userMessage.parts
        .filter((p): p is TextPart => p.kind === "text")
        .map((p) => p.text)
        .join(" ")
        .trim();

      if (!inputText) {
        throw new Error("No input text found in message");
      }

      console.log(`[SimpleRouterAgentExecutor] User request: ${inputText}`);

      // Use AI to determine routing
      const response = await routerPrompt({
        userRequest: inputText,
      });

      // Parse routing decision
      let routingDecision: {
        targetAgent: string;
        reasoning: string;
        confidence: number;
      };

      try {
        routingDecision = JSON.parse(response.text);
      } catch (e) {
        console.warn("[SimpleRouterAgentExecutor] Failed to parse routing decision, using fallback");
        routingDecision = this.fallbackRouting(inputText);
      }

      console.log(`[SimpleRouterAgentExecutor] Routing decision:`, routingDecision);

      // Check if cancelled
      if (this.cancelledTasks.has(taskId)) {
        console.log(`[SimpleRouterAgentExecutor] Task cancelled: ${taskId}`);
        return;
      }

      // Determine agent URL based on routing decision
      let agentUrl: string;
      let agentName: string;

      if (routingDecision.targetAgent === "lead-manager") {
        agentUrl = process.env.LEAD_MANAGER_URL || "http://localhost:41245";
        agentName = "Lead Manager Agent";
      } else if (routingDecision.targetAgent === "content-editor") {
        agentUrl = process.env.CONTENT_EDITOR_URL || "http://localhost:10003";
        agentName = "Content Editor Agent";
      } else {
        throw new Error(`Unknown target agent: ${routingDecision.targetAgent}`);
      }

      // Build response message
      const responseText = `**Routing Decision**

Target Agent: ${agentName}
Confidence: ${(routingDecision.confidence * 100).toFixed(0)}%
Reasoning: ${routingDecision.reasoning}

Agent URL: ${agentUrl}/.well-known/agent-card.json

To complete your request, please send your message to the ${agentName} at:
${agentUrl}

Your original request: "${inputText}"`;

      const agentMessage: Message = {
        kind: "message",
        role: "agent",
        messageId: uuidv4(),
        parts: [{ kind: "text", text: responseText }],
        taskId: taskId,
        contextId: contextId,
      };

      const finalUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "completed",
          message: agentMessage,
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(finalUpdate);

      console.log(`[SimpleRouterAgentExecutor] Task ${taskId} completed successfully`);
    } catch (error: unknown) {
      console.error(`[SimpleRouterAgentExecutor] Error processing task ${taskId}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [{ kind: "text", text: `Routing error: ${errorMessage}` }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(errorUpdate);
    }
  }

  /**
   * Fallback routing logic if AI fails
   */
  private fallbackRouting(inputText: string): {
    targetAgent: string;
    reasoning: string;
    confidence: number;
  } {
    const lowerText = inputText.toLowerCase();

    // Lead Manager keywords
    const leadKeywords = ["lead", "score", "search", "sales", "qualify", "prospect", "customer", "crm"];
    const leadMatches = leadKeywords.filter(keyword => lowerText.includes(keyword)).length;

    // Content Editor keywords
    const contentKeywords = ["edit", "proofread", "polish", "content", "write", "article", "blog", "copy", "grammar"];
    const contentMatches = contentKeywords.filter(keyword => lowerText.includes(keyword)).length;

    if (leadMatches > contentMatches) {
      return {
        targetAgent: "lead-manager",
        reasoning: `Detected ${leadMatches} lead management keywords in request`,
        confidence: Math.min(0.6 + (leadMatches * 0.1), 0.9),
      };
    } else if (contentMatches > leadMatches) {
      return {
        targetAgent: "content-editor",
        reasoning: `Detected ${contentMatches} content editing keywords in request`,
        confidence: Math.min(0.6 + (contentMatches * 0.1), 0.9),
      };
    } else {
      // Default to content editor for ambiguous requests
      return {
        targetAgent: "content-editor",
        reasoning: "Request is ambiguous, defaulting to content editor",
        confidence: 0.4,
      };
    }
  }
}

/**
 * Agent Card Definition
 */
const simpleRouterAgentCard: AgentCard = {
  name: "Simple Router Agent",
  description:
    "A routing agent that analyzes requests and directs them to either the Lead Manager Agent or Content Editor Agent based on the request content.",
  url: "http://localhost:41250/",
  provider: {
    organization: "A2A Samples",
    url: "https://example.com/a2a-samples",
  },
  version: "1.0.0",
  protocolVersion: "1.0",
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  securitySchemes: undefined,
  security: undefined,
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "route-request",
      name: "Route Request",
      description:
        "Analyzes user requests and routes them to the appropriate specialized agent (Lead Manager or Content Editor).",
      tags: ["routing", "orchestration", "delegation"],
      inputModes: ["text"],
      outputModes: ["text"],
      examples: [
        "Score this lead for Acme Corp",
        "Edit my blog post about AI",
        "Search for leads in the software industry",
        "Proofread this article",
      ],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

/**
 * Main server setup
 */
async function main() {
  const taskStore: TaskStore = new InMemoryTaskStore();
  const agentExecutor: AgentExecutor = new SimpleRouterAgentExecutor();
  const requestHandler = new DefaultRequestHandler(
    simpleRouterAgentCard,
    taskStore,
    agentExecutor
  );

  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express() as any);

  const PORT = process.env.SIMPLE_ROUTER_PORT || 41250;
  expressApp.listen(PORT, () => {
    console.log(
      `[SimpleRouterAgent] Server started on http://localhost:${PORT}`
    );
    console.log(
      `[SimpleRouterAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`
    );
    console.log("[SimpleRouterAgent] Press Ctrl+C to stop the server");
  });
}

main().catch(console.error);
