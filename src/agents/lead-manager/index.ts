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
import { LeadStore, SearchFilters } from "./lead-store.js";

import * as dotenv from "dotenv";
dotenv.config();

// SAP AI Core credentials are loaded in genkit.ts
// No need to check for API keys

const leadManagerPrompt = ai.prompt("lead-manager");

/**
 * Lead Manager Agent Executor
 * Handles two skills: score-lead and search-leads
 */
class LeadManagerAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  private leadStore: LeadStore;

  constructor() {
    this.leadStore = new LeadStore();
  }

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
          parts: [{ kind: "text", text: "Lead management task cancelled." }],
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
      `[LeadManagerAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId}`
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
          parts: [{ kind: "text", text: "Processing lead management request..." }],
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

      // Try to parse as JSON first, otherwise treat as natural language
      let input: any;
      let isNaturalLanguage = false;
      
      try {
        input = JSON.parse(inputText);
      } catch (e) {
        // Not JSON - treat as natural language query
        isNaturalLanguage = true;
        input = { query: inputText };
      }

      // Determine which skill to execute
      let skillId: string;
      let result: any;

      if (isNaturalLanguage) {
        // Analyze natural language to determine intent
        const lowerQuery = inputText.toLowerCase();
        
        if (lowerQuery.includes('search') || lowerQuery.includes('find') || 
            lowerQuery.includes('list') || lowerQuery.includes('show')) {
          // Search intent
          skillId = "search-leads";
          
          // Extract filters from natural language
          const filters: any = {};
          
          // Extract industry
          const industries = ['software', 'manufacturing', 'retail', 'healthcare', 'financial', 'energy', 'professional'];
          for (const industry of industries) {
            if (lowerQuery.includes(industry)) {
              filters.industry = industry.charAt(0).toUpperCase() + industry.slice(1);
              break;
            }
          }
          
          // Extract score threshold
          const scoreMatch = lowerQuery.match(/score[:\s]+(\d+)|(\d+)\+|above\s+(\d+)|over\s+(\d+)/i);
          if (scoreMatch) {
            filters.min_score = parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3] || scoreMatch[4]);
          }
          
          result = await this.searchLeads(filters, taskId, contextId, eventBus);
        } else {
          // Default to scoring - extract company info from natural language
          skillId = "score-lead";
          
          // Try to extract company name (simple heuristic)
          const companyMatch = inputText.match(/(?:company|lead|score)\s+(?:for\s+)?([A-Z][A-Za-z\s&]+?)(?:\s+in|\s+with|\s*$)/i);
          const company = companyMatch ? companyMatch[1].trim() : inputText;
          
          input = { company };
          result = await this.scoreLead(input, taskId, contextId, eventBus);
        }
      } else {
        // JSON input - use explicit skill
        skillId = input.skill || input.skillId || "score-lead";

        if (skillId === "score-lead") {
          result = await this.scoreLead(input, taskId, contextId, eventBus);
        } else if (skillId === "search-leads") {
          result = await this.searchLeads(input, taskId, contextId, eventBus);
        } else {
          throw new Error(`Unknown skill: ${skillId}`);
        }
      }

      // Check if cancelled
      if (this.cancelledTasks.has(taskId)) {
        console.log(`[LeadManagerAgentExecutor] Task cancelled: ${taskId}`);
        return;
      }

      // Publish success with JSON result
      const agentMessage: Message = {
        kind: "message",
        role: "agent",
        messageId: uuidv4(),
        parts: [{ kind: "text", text: JSON.stringify(result, null, 2) }],
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

      console.log(`[LeadManagerAgentExecutor] Task ${taskId} completed successfully`);
    } catch (error: unknown) {
      console.error(`[LeadManagerAgentExecutor] Error processing task ${taskId}:`, error);
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
            parts: [{ kind: "text", text: `Error: ${errorMessage}` }],
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
   * Score a lead using AI
   */
  private async scoreLead(
    input: any,
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus
  ): Promise<any> {
    console.log(`[LeadManagerAgentExecutor] Scoring lead: ${input.company}`);

    // Update status
    const progressUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "working",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: `Analyzing lead: ${input.company}...` }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(progressUpdate);

    // Use AI to score the lead
    const response = await leadManagerPrompt(
      {
        company: input.company,
        industry: input.industry,
        employees: input.employees,
        engagement: input.engagement,
        revenue: input.revenue,
      },
      {
        model: 'sap-aicore/gpt-4o',
      }
    );

    // Parse AI response
    let scoringResult: any;
    try {
      // Try to extract JSON from response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scoringResult = JSON.parse(jsonMatch[0]);
      } else {
        scoringResult = JSON.parse(response.text);
      }
    } catch (e) {
      console.warn("[LeadManagerAgentExecutor] Failed to parse AI response, using fallback");
      // Fallback scoring logic
      scoringResult = this.fallbackScoring(input);
    }

    return scoringResult;
  }

  /**
   * Fallback scoring logic if AI fails
   */
  private fallbackScoring(input: any): any {
    let score = 0;

    // Company size scoring
    if (input.employees) {
      if (input.employees >= 10000) score += 30;
      else if (input.employees >= 1000) score += 25;
      else if (input.employees >= 100) score += 20;
      else if (input.employees >= 10) score += 10;
      else score += 5;
    } else {
      score += 15; // neutral
    }

    // Engagement scoring
    if (input.engagement === "high") score += 30;
    else if (input.engagement === "medium") score += 20;
    else if (input.engagement === "low") score += 10;
    else score += 15; // neutral

    // Industry scoring
    const industryScores: Record<string, number> = {
      Software: 20,
      "Financial Services": 18,
      Healthcare: 16,
      Manufacturing: 14,
      "Professional Services": 12,
      Retail: 10,
    };
    score += industryScores[input.industry] || 8;

    // Revenue scoring
    if (input.revenue) {
      if (input.revenue >= 1000000000) score += 20;
      else if (input.revenue >= 100000000) score += 16;
      else if (input.revenue >= 10000000) score += 12;
      else if (input.revenue >= 1000000) score += 8;
      else score += 4;
    } else {
      score += 10; // neutral
    }

    // Determine grade
    let grade: string;
    if (score >= 90) grade = "A";
    else if (score >= 70) grade = "B";
    else if (score >= 50) grade = "C";
    else grade = "D";

    // Determine qualification
    const qualified =
      score >= 60 &&
      (input.employees >= 50 || input.engagement === "high");

    // Generate recommendations
    const recommendations: string[] = [];
    if (grade === "A") {
      recommendations.push("Schedule executive-level demo");
      recommendations.push("Prepare custom enterprise solution proposal");
      recommendations.push("Assign senior account executive");
    } else if (grade === "B") {
      recommendations.push("Conduct standard product demo");
      recommendations.push("Share relevant case studies");
      recommendations.push("Follow standard sales process");
    } else if (grade === "C") {
      recommendations.push("Enroll in nurture campaign");
      recommendations.push("Provide educational content");
      recommendations.push("Invite to upcoming webinar");
    } else {
      recommendations.push("Add to automated marketing list");
      recommendations.push("Provide self-service resources");
      recommendations.push("Re-qualify in 6 months");
    }

    return {
      score,
      grade,
      qualified,
      recommendations,
    };
  }

  /**
   * Search leads in the database
   */
  private async searchLeads(
    input: any,
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus
  ): Promise<any> {
    console.log(`[LeadManagerAgentExecutor] Searching leads with filters:`, input);

    // Update status
    const progressUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "working",
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [{ kind: "text", text: "Searching lead database..." }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(progressUpdate);

    // Build search filters
    const filters: SearchFilters = {
      company: input.company,
      industry: input.industry,
      min_score: input.min_score,
    };

    // Search leads
    const leads = this.leadStore.search(filters);

    // Format results
    const formattedLeads = leads.map((lead) => ({
      id: lead.id,
      company: lead.company,
      industry: lead.industry,
      score: lead.score,
      grade: lead.grade,
      qualified: lead.qualified,
      employees: lead.employees,
      engagement: lead.engagement,
    }));

    return {
      leads: formattedLeads,
      total: formattedLeads.length,
      filters: filters,
    };
  }
}

/**
 * Agent Card Definition
 */
const leadManagerAgentCard: AgentCard = {
  name: "Sales Lead Manager",
  description:
    "An AI agent for managing sales leads with structured JSON input and output. Supports lead scoring and search operations.",
  url: "http://localhost:41245/",
  provider: {
    organization: "SAP",
    url: "https://www.sap.com",
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
  defaultInputModes: ["application/json"],
  defaultOutputModes: ["application/json"],
  skills: [
    {
      id: "score-lead",
      name: "Lead Scoring",
      description:
        "Score leads based on company profile and engagement metrics using AI-powered analysis.",
      tags: ["lead-scoring", "qualification", "analytics"],
      inputModes: ["application/json"],
      outputModes: ["application/json"],
      examples: [
        JSON.stringify({
          skill: "score-lead",
          company: "SAP",
          industry: "Software",
          employees: 105000,
          engagement: "high",
        }),
      ],
    },
    {
      id: "search-leads",
      name: "Lead Search",
      description:
        "Search for existing leads using company name, industry, or minimum score filters.",
      tags: ["search", "query", "filter"],
      inputModes: ["application/json"],
      outputModes: ["application/json"],
      examples: [
        JSON.stringify({
          skill: "search-leads",
          industry: "Software",
          min_score: 70,
        }),
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
  const agentExecutor: AgentExecutor = new LeadManagerAgentExecutor();
  const requestHandler = new DefaultRequestHandler(
    leadManagerAgentCard,
    taskStore,
    agentExecutor
  );

  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express() as any);

  const PORT = process.env.LEAD_MANAGER_AGENT_PORT || 41245;
  expressApp.listen(PORT, () => {
    console.log(
      `[LeadManagerAgent] Server started on http://localhost:${PORT}`
    );
    console.log(
      `[LeadManagerAgent] Agent Card: http://localhost:${PORT}/.well-known/agent-card.json`
    );
    console.log("[LeadManagerAgent] Press Ctrl+C to stop the server");
  });
}

main().catch(console.error);
