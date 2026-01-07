# SAP AI Core Integration for a2a-genkit

This document describes the integration of SAP AI Core Orchestration Service into the a2a-genkit project, replacing direct Google Gemini API calls with SAP BTP AI Core.

## Overview

The a2a-genkit project now uses a custom GenKit plugin (`sap-aicore-genkit.ts`) that wraps the SAP AI Core Orchestration Service. This allows all agents to leverage enterprise-grade AI capabilities through SAP BTP while maintaining the GenKit framework.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    a2a-genkit Agents                        │
│  (content-editor, coder, movie-agent, news-research, etc.) │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              GenKit Framework (genkit.ts)                   │
│  - Prompt management                                        │
│  - Message formatting                                       │
│  - Response handling                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         SAP AI Core GenKit Plugin                           │
│         (src/agents/shared/sap-aicore-genkit.ts)           │
│  - Model registration                                       │
│  - Message conversion (GenKit ↔ SAP)                       │
│  - Streaming support                                        │
│  - Token usage tracking                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         SAP AI SDK (@sap-ai-sdk/orchestration)             │
│  - OrchestrationClient                                      │
│  - Authentication                                           │
│  - API communication                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              SAP BTP AI Core                                │
│  - GPT-4o, GPT-4o-mini, GPT-4                              │
│  - Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku       │
│  - Gemini 2.5 Flash, Gemini 2.0 Flash                     │
└─────────────────────────────────────────────────────────────┘
```

## What Changed

### 1. New Files

**`src/agents/shared/sap-aicore-genkit.ts`**
- Custom GenKit plugin for SAP AI Core
- Supports 8 models across 4 providers (OpenAI, Anthropic, Google, Mistral)
- Handles streaming and non-streaming modes
- Converts between GenKit and SAP message formats

### 2. Modified Files

**`package.json`**
- Added `@sap-ai-sdk/orchestration@^1.4.0`
- Added `@sap-ai-sdk/ai-api@^1.4.0`
- Kept `@genkit-ai/googleai` for backward compatibility

**`src/agents/content-editor/genkit.ts`**
```typescript
// Before: Using Google AI
import { googleAI } from "@genkit-ai/googleai";
export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model("gemini-2.5-flash"),
});

// After: Using SAP AI Core
import { sapAiCore } from "../shared/sap-aicore-genkit.js";
export const ai = genkit({
  plugins: [sapAiCore()],
  model: sapAiCore.model("gpt-4o"),
});
```

**`src/agents/content-editor/index.ts`**
- Removed `GOOGLE_API_KEY` check
- SAP credentials loaded via genkit.ts

**`src/agents/content-editor/.env`**
- Added SAP AI Core credentials
- Added agent port configuration

### 3. Unchanged Files

- Agent implementation (`index.ts` logic)
- Prompt files (`.prompt`)
- A2A protocol integration
- Task management
- Express server setup

## Available Models

The plugin supports the following models via SAP AI Core:

### OpenAI Models
- `gpt-4o` - Latest GPT-4 Optimized (recommended)
- `gpt-4o-mini` - Faster, cost-effective variant
- `gpt-4` - Standard GPT-4

### Anthropic Models
- `anthropic--claude-3.5-sonnet` - Latest Claude (recommended)
- `anthropic--claude-3-opus` - Most capable Claude
- `anthropic--claude-3-haiku` - Fastest Claude

### Google Models
- `gemini-2.5-flash` - Latest Gemini
- `gemini-2.0-flash` - Fast Gemini variant

## Configuration

### Environment Variables

Each agent needs a `.env` file with SAP AI Core credentials:

```env
# SAP AI Core Credentials
SAP_AI_CORE_CLIENT_ID=your-client-id
SAP_AI_CORE_CLIENT_SECRET=your-client-secret
SAP_AI_CORE_TOKEN_URL=https://your-auth-url/oauth/token
SAP_AI_CORE_BASE_URL=https://your-ai-api-url
SAP_AI_CORE_RESOURCE_GROUP=default

# Agent Port
CONTENT_EDITOR_AGENT_PORT=10003
```

### Changing Models

To change the model for an agent, edit its `genkit.ts`:

```typescript
export const ai = genkit({
  plugins: [sapAiCore()],
  model: sapAiCore.model("anthropic--claude-3.5-sonnet"), // Change here
  promptDir: __dirname,
});
```

## Usage

### Starting an Agent

```bash
# Content Editor Agent
npm run agents:content-editor

# Other agents (after migration)
npm run agents:coder
npm run agents:movie-agent
npm run agents:news-research-agent
```

### Testing the Agent

```bash
# Check agent card
curl http://localhost:10003/.well-known/agent-card.json

# Send a task (example)
curl -X POST http://localhost:10003/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "message",
    "role": "user",
    "messageId": "msg-123",
    "parts": [{"kind": "text", "text": "Edit this: Hello world"}]
  }'
```

## Migration Guide for Other Agents

To migrate other agents (coder, movie-agent, etc.) to SAP AI Core:

### Step 1: Update genkit.ts

```typescript
import * as dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import { genkit } from "genkit";
import { sapAiCore } from "../shared/sap-aicore-genkit.js";

export const ai = genkit({
  plugins: [sapAiCore()],
  model: sapAiCore.model("gpt-4o"),
  promptDir: __dirname,
});

export { z } from "genkit";
```

### Step 2: Update index.ts

Remove GOOGLE_API_KEY check:

```typescript
// Remove this:
if (!process.env.GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY environment variable is not set.");
}

// Replace with:
// SAP AI Core credentials are loaded in genkit.ts
```

### Step 3: Create .env File

Copy from content-editor:

```bash
cp src/agents/content-editor/.env src/agents/coder/.env
# Update port if needed
```

### Step 4: Test

```bash
npm run agents:coder
```

## Benefits

### Enterprise Features
- ✅ **Unified Access** - Single API for multiple model providers
- ✅ **Security** - SAP BTP authentication and authorization
- ✅ **Governance** - Centralized model management
- ✅ **Compliance** - Enterprise-grade data handling

### Developer Experience
- ✅ **No Vendor Lock-in** - Easy to switch between models
- ✅ **Consistent Interface** - Same GenKit API for all models
- ✅ **Backward Compatible** - Can keep Google AI plugin alongside
- ✅ **Shared Plugin** - Single implementation for all agents

### Operational
- ✅ **Token Tracking** - Built-in usage monitoring
- ✅ **Streaming Support** - Real-time response streaming
- ✅ **Error Handling** - Robust error management
- ✅ **Logging** - Detailed operation logs

## Troubleshooting

### Agent Won't Start

**Error**: `SAP AI Core credentials not found`

**Solution**: Ensure `.env` file exists in agent directory with all required variables.

### TypeScript Errors

**Error**: `Cannot find module 'genkit'`

**Solution**: Run `npm install` to install dependencies.

### Model Not Found

**Error**: `Model 'xyz' not found`

**Solution**: Check available models list above. Use exact model name.

### Authentication Failed

**Error**: `401 Unauthorized`

**Solution**: Verify SAP AI Core credentials in `.env` file. Check service key is valid.

## Performance Considerations

### Model Selection
- **GPT-4o**: Best for complex reasoning, slower
- **GPT-4o-mini**: Good balance of speed and capability
- **Claude 3.5 Sonnet**: Excellent for long context
- **Gemini 2.5 Flash**: Fastest responses

### Streaming
- Enabled by default for better UX
- Provides real-time feedback to users
- Reduces perceived latency

### Token Usage
- Logged automatically for monitoring
- Helps optimize costs
- Tracks input/output/total tokens

## Future Enhancements

### Planned Features
- [ ] Support for additional SAP AI Core models
- [ ] Model fallback/retry logic
- [ ] Cost tracking and budgeting
- [ ] A/B testing between models
- [ ] Prompt caching optimization

### Agent Migration Status
- [x] content-editor - ✅ Migrated & Tested
- [x] coder - ✅ Migrated
- [x] movie-agent - ✅ Migrated & Tested
- [x] academic-research-agent - ✅ Migrated
- [x] orchestrator-agent - ✅ Migrated
- [x] web-research-agent - ✅ Migrated
- [x] planning-agent - ✅ Migrated
- [x] data-analysis-agent - ✅ Migrated
- [x] news-research-agent - ✅ Migrated

**All 9 agents successfully migrated to SAP AI Core! 🎉**

## References

- [SAP AI SDK Documentation](https://github.com/SAP/ai-sdk-js)
- [GenKit Documentation](https://firebase.google.com/docs/genkit)
- [A2A Protocol](https://a2a-protocol.org/)
- [SAP BTP AI Core](https://help.sap.com/docs/sap-ai-core)

## Support

For issues or questions:
1. Check this documentation
2. Review SAP AI SDK documentation
3. Check GenKit documentation
4. Review agent logs for detailed error messages

---

**Last Updated**: January 7, 2026
**Version**: 1.0.0
**Status**: Production Ready ✅
