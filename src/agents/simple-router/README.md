# Simple Router Agent

A lightweight orchestrator agent that intelligently routes requests between the Lead Manager Agent and Content Editor Agent using AI-powered analysis.

## Overview

The Simple Router Agent analyzes incoming requests and determines which specialized agent should handle them:

- **Lead Manager Agent** - For lead scoring, lead search, and sales-related tasks
- **Content Editor Agent** - For content editing, proofreading, and writing tasks

## Architecture

```
┌─────────────────────┐
│  Simple Router      │
│  (Port 41250)       │
└──────────┬──────────┘
           │
           ├─────────────────┐
           │                 │
           ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│  Lead Manager    │  │  Content Editor  │
│  (Port 41245)    │  │  (Port 10003)    │
└──────────────────┘  └──────────────────┘
```

## Features

- **AI-Powered Routing**: Uses Genkit with SAP AI Core to analyze requests
- **Fallback Logic**: Keyword-based routing if AI analysis fails
- **Confidence Scoring**: Provides routing confidence levels
- **A2A Protocol Compliant**: Full support for A2A protocol events
- **Easy Testing**: Startup script launches all agents with clear URLs

## Quick Start

### 1. Setup Environment

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your SAP AI Core credentials:

```env
SAP_AI_CORE_CLIENT_ID=your-client-id-here
SAP_AI_CORE_CLIENT_SECRET=your-client-secret-here
SAP_AI_CORE_TOKEN_URL=https://your-auth-url/oauth/token
SAP_AI_CORE_BASE_URL=https://your-ai-api-url
SAP_AI_CORE_RESOURCE_GROUP=default
```

### 2. Start All Agents

Use the convenient startup script to launch all three agents:

```bash
npm run agents:start-all
```

This will start:
- Simple Router Agent on port 41250
- Lead Manager Agent on port 41245
- Content Editor Agent on port 10003

### 3. Test the Router

The startup script will display agent card URLs:

```
Simple Router:
   http://localhost:41250/.well-known/agent-card.json

Lead Manager:
   http://localhost:41245/.well-known/agent-card.json

Content Editor:
   http://localhost:10003/.well-known/agent-card.json
```

## Usage Examples

### Lead Management Requests

These will be routed to the Lead Manager Agent:

```
"Score this lead for Acme Corp in the software industry"
"Search for leads with score above 70"
"Find high-value prospects in healthcare"
"Qualify this customer for enterprise sales"
```

### Content Editing Requests

These will be routed to the Content Editor Agent:

```
"Edit and proofread this article about AI"
"Polish my blog post for publication"
"Improve the grammar in this content"
"Proofread this marketing copy"
```

## Routing Logic

### AI-Powered Analysis

The router uses a Genkit prompt to analyze requests and return:

```json
{
  "targetAgent": "lead-manager" | "content-editor",
  "reasoning": "Brief explanation of routing decision",
  "confidence": 0.85
}
```

### Fallback Keywords

If AI analysis fails, keyword-based routing is used:

**Lead Manager Keywords:**
- lead, score, search, sales, qualify, prospect, customer, crm

**Content Editor Keywords:**
- edit, proofread, polish, content, write, article, blog, copy, grammar

## Running Individual Agents

You can also run agents individually:

```bash
# Router only
npm run agents:simple-router

# Lead Manager only
npm run agents:lead-manager

# Content Editor only
npm run agents:content-editor
```

## Response Format

The router returns a routing decision with:

```
**Routing Decision**

Target Agent: Lead Manager Agent
Confidence: 85%
Reasoning: Detected lead management keywords in request

Agent URL: http://localhost:41245/.well-known/agent-card.json

To complete your request, please send your message to the Lead Manager Agent at:
http://localhost:41245

Your original request: "Score this lead for Acme Corp"
```

## Configuration

### Environment Variables

```env
# SAP AI Core (required)
SAP_AI_CORE_CLIENT_ID=your-client-id-here
SAP_AI_CORE_CLIENT_SECRET=your-client-secret-here
SAP_AI_CORE_TOKEN_URL=https://your-auth-url/oauth/token
SAP_AI_CORE_BASE_URL=https://your-ai-api-url
SAP_AI_CORE_RESOURCE_GROUP=default

# Agent Ports (optional)
SIMPLE_ROUTER_PORT=41250
LEAD_MANAGER_PORT=41245
CONTENT_EDITOR_AGENT_PORT=10003

# Agent URLs (optional)
LEAD_MANAGER_URL=http://localhost:41245
CONTENT_EDITOR_URL=http://localhost:10003
```

## Files

```
src/agents/simple-router/
├── index.ts           # Main router agent implementation
├── genkit.ts          # Genkit/SAP AI Core configuration
├── router.prompt      # AI routing prompt definition
├── start-all.ts       # Startup script for all agents
├── .env.example       # Environment template
└── README.md          # This file
```

## Development

### Testing the Router

1. Start all agents: `npm run agents:start-all`
2. Send requests to the router at `http://localhost:41250`
3. Observe routing decisions in console output
4. Verify requests reach the correct target agent

### Modifying Routing Logic

Edit `router.prompt` to adjust AI routing behavior:

```yaml
---
model: sap-aicore/gpt-4o
input:
  schema:
    userRequest: string
output:
  format: json
---

You are a routing agent...
```

### Adding New Agents

To add more agents to the routing system:

1. Update `router.prompt` with new agent descriptions
2. Add routing logic in `index.ts` `execute()` method
3. Update `start-all.ts` to include new agent
4. Add new agent URL to `.env.example`

## Troubleshooting

### Router Not Starting

- Check SAP AI Core credentials in `.env`
- Verify port 41250 is available
- Check console for error messages

### Routing to Wrong Agent

- Review routing decision reasoning in console
- Adjust keywords in fallback logic if needed
- Modify `router.prompt` for better AI analysis

### Agent Not Responding

- Verify target agent is running
- Check agent URLs in environment variables
- Test agent card URLs directly in browser

## A2A Protocol Compliance

The router implements full A2A protocol support:

- ✅ Task creation and status updates
- ✅ Message history tracking
- ✅ Event streaming
- ✅ Cancellation support
- ✅ Agent card metadata

## License

Part of the a2a-genkit project.
