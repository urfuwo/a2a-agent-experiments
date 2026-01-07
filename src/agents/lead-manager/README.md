# Sales Lead Manager Agent

An AI-powered agent for managing sales leads with structured JSON input and output. Supports intelligent lead scoring using SAP AI Core and efficient lead search operations.

## Overview

The Sales Lead Manager agent provides two core capabilities:

1. **Lead Scoring** - AI-powered analysis of lead quality based on company profile and engagement metrics
2. **Lead Search** - Query and filter leads from the database using various criteria

## Features

- **Dual Skills**: Supports both AI-powered scoring and data-driven search
- **JSON I/O**: Structured JSON input and output for easy integration
- **Mock Database**: 10 sample leads for testing and demonstration
- **SAP AI Core**: Uses GPT-4o model via SAP BTP AI Core Orchestration Service
- **A2A Protocol**: Full compliance with Agent-to-Agent protocol v1.0
- **Fallback Logic**: Graceful degradation if AI service is unavailable

## Configuration

### Environment Variables

Create a `.env` file in this directory with the following variables:

```env
# SAP AI Core Configuration
SAP_AI_CORE_CLIENT_ID=your-client-id
SAP_AI_CORE_CLIENT_SECRET=your-client-secret
SAP_AI_CORE_TOKEN_URL=https://your-auth-url/oauth/token
SAP_AI_CORE_BASE_URL=https://your-ai-api-url
SAP_AI_CORE_RESOURCE_GROUP=default

# Agent Configuration
LEAD_MANAGER_AGENT_PORT=41245
```

See `.env.example` for a template.

## Usage

### Starting the Agent

```bash
# From project root
npm run agents:lead-manager

# Or directly
npx tsx src/agents/lead-manager/index.ts
```

The agent will start on port 41245 (or custom port from `.env`).

### Agent Card

Access the agent card at:
```
http://localhost:41245/.well-known/agent-card.json
```

## Skills

### 1. Lead Scoring (`score-lead`)

Analyzes a lead and provides a comprehensive scoring assessment.

**Input Schema:**
```json
{
  "skill": "score-lead",
  "company": "string (required)",
  "industry": "string (optional)",
  "employees": "number (optional)",
  "engagement": "low|medium|high (optional)",
  "revenue": "number (optional)"
}
```

**Output Schema:**
```json
{
  "score": "number (0-100)",
  "grade": "A|B|C|D",
  "qualified": "boolean",
  "recommendations": ["string", "string", ...]
}
```

**Example Request:**
```json
{
  "skill": "score-lead",
  "company": "SAP",
  "industry": "Software",
  "employees": 105000,
  "engagement": "high"
}
```

**Example Response:**
```json
{
  "score": 95,
  "grade": "A",
  "qualified": true,
  "recommendations": [
    "Schedule executive-level demo",
    "Prepare custom enterprise solution proposal",
    "Assign senior account executive"
  ]
}
```

### 2. Lead Search (`search-leads`)

Searches the lead database using filters.

**Input Schema:**
```json
{
  "skill": "search-leads",
  "company": "string (optional)",
  "industry": "string (optional)",
  "min_score": "number (optional)"
}
```

**Output Schema:**
```json
{
  "leads": [
    {
      "id": "string",
      "company": "string",
      "industry": "string",
      "score": "number",
      "grade": "string",
      "qualified": "boolean",
      "employees": "number",
      "engagement": "string"
    }
  ],
  "total": "number",
  "filters": "object"
}
```

**Example Request:**
```json
{
  "skill": "search-leads",
  "industry": "Software",
  "min_score": 70
}
```

**Example Response:**
```json
{
  "leads": [
    {
      "id": "lead-002",
      "company": "Microsoft",
      "industry": "Software",
      "score": 98,
      "grade": "A",
      "qualified": true,
      "employees": 220000,
      "engagement": "high"
    },
    {
      "id": "lead-001",
      "company": "SAP",
      "industry": "Software",
      "score": 95,
      "grade": "A",
      "qualified": true,
      "employees": 105000,
      "engagement": "high"
    },
    {
      "id": "lead-003",
      "company": "TechStart Inc",
      "industry": "Software",
      "score": 72,
      "grade": "B",
      "qualified": true,
      "employees": 50,
      "engagement": "medium"
    }
  ],
  "total": 3,
  "filters": {
    "industry": "Software",
    "min_score": 70
  }
}
```

## Scoring Criteria

The AI uses the following criteria to score leads:

### 1. Company Size (0-30 points)
- 10,000+ employees: 30 points
- 1,000-9,999 employees: 25 points
- 100-999 employees: 20 points
- 10-99 employees: 10 points
- <10 employees: 5 points

### 2. Engagement Level (0-30 points)
- High engagement: 30 points
- Medium engagement: 20 points
- Low engagement: 10 points

### 3. Industry Fit (0-20 points)
- Software/Technology: 20 points
- Financial Services: 18 points
- Healthcare: 16 points
- Manufacturing: 14 points
- Professional Services: 12 points
- Retail: 10 points

### 4. Revenue Potential (0-20 points)
- $1B+: 20 points
- $100M-$999M: 16 points
- $10M-$99M: 12 points
- $1M-$9M: 8 points

### Grading Scale
- **A (90-100)**: Excellent lead, high priority
- **B (70-89)**: Good lead, medium-high priority
- **C (50-69)**: Fair lead, medium priority
- **D (0-49)**: Poor lead, low priority

### Qualification Threshold
- **Qualified**: Score >= 60 AND (employees >= 50 OR engagement = "high")
- **Not Qualified**: Otherwise

## Mock Data

The agent includes 10 sample leads for testing:

1. **SAP** - Software, 105K employees, High engagement, Score: 95 (A)
2. **Microsoft** - Software, 220K employees, High engagement, Score: 98 (A)
3. **TechStart Inc** - Software, 50 employees, Medium engagement, Score: 72 (B)
4. **Global Manufacturing Co** - Manufacturing, 15K employees, Medium engagement, Score: 68 (C)
5. **Retail Solutions Ltd** - Retail, 5K employees, Low engagement, Score: 55 (C)
6. **Small Shop** - Retail, 5 employees, Low engagement, Score: 25 (D)
7. **FinTech Innovations** - Financial Services, 800 employees, High engagement, Score: 85 (A)
8. **Healthcare Systems Inc** - Healthcare, 12K employees, Medium engagement, Score: 78 (B)
9. **Consulting Partners** - Professional Services, 250 employees, Medium engagement, Score: 65 (C)
10. **Energy Solutions Corp** - Energy, 8K employees, Low engagement, Score: 48 (D)

## Testing

### Using the A2A CLI (Recommended)

The easiest way to test the agent is using the built-in A2A CLI:

**Step 1: Start the agent**
```bash
npm run agents:lead-manager
```

**Step 2: In a new terminal, connect with the CLI**
```bash
npm run a2a:cli http://localhost:41245
```

**Step 3: Send natural language or JSON requests**

**Natural Language Examples:**
```
> list software leads
> find companies with score above 80
> show me retail leads
> score Microsoft
> search for financial services companies
```

**JSON Examples:**
```
> {"skill":"score-lead","company":"SAP","industry":"Software","employees":105000,"engagement":"high"}
> {"skill":"search-leads","industry":"Software","min_score":70}
```

### Using curl

**Score a lead (Natural Language):**
```bash
curl -X POST http://localhost:41245/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "message",
    "role": "user",
    "messageId": "msg-001",
    "parts": [{
      "kind": "text",
      "text": "score Microsoft"
    }]
  }'
```

**Score a lead (JSON):**
```bash
curl -X POST http://localhost:41245/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "message",
    "role": "user",
    "messageId": "msg-002",
    "parts": [{
      "kind": "text",
      "text": "{\"skill\":\"score-lead\",\"company\":\"SAP\",\"industry\":\"Software\",\"employees\":105000,\"engagement\":\"high\"}"
    }]
  }'
```

**Search leads (Natural Language):**
```bash
curl -X POST http://localhost:41245/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "message",
    "role": "user",
    "messageId": "msg-003",
    "parts": [{
      "kind": "text",
      "text": "list software leads"
    }]
  }'
```

**Search leads (JSON):**
```bash
curl -X POST http://localhost:41245/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "message",
    "role": "user",
    "messageId": "msg-004",
    "parts": [{
      "kind": "text",
      "text": "{\"skill\":\"search-leads\",\"industry\":\"Software\",\"min_score\":70}"
    }]
  }'
```

## Quick Copy-Paste Examples for Chat

These single-line JSON examples can be directly pasted into chat clients, the A2A CLI, or API testing tools:

### Lead Scoring Examples

**Score SAP (full details):**
```
{"skill":"score-lead","company":"SAP","industry":"Software","employees":105000,"engagement":"high"}
```

**Score Microsoft (with revenue):**
```
{"skill":"score-lead","company":"Microsoft","industry":"Software","employees":220000,"engagement":"high","revenue":198000000000}
```

**Score a startup (minimal info):**
```
{"skill":"score-lead","company":"TechStart Inc","industry":"Software","employees":50,"engagement":"medium"}
```

**Score with just company name:**
```
{"skill":"score-lead","company":"Acme Corp"}
```

### Lead Search Examples

**Search software companies with high scores:**
```
{"skill":"search-leads","industry":"Software","min_score":70}
```

**Search all software companies:**
```
{"skill":"search-leads","industry":"Software"}
```

**Search high-scoring leads (any industry):**
```
{"skill":"search-leads","min_score":80}
```

**Search all leads:**
```
{"skill":"search-leads"}
```

**Search by company name:**
```
{"skill":"search-leads","company":"SAP"}
```

### Natural Language Alternatives

You can also use natural language instead of JSON:
```
list software leads
find companies with score above 80
score Microsoft
show me retail leads
```

## Architecture

```
┌─────────────────────────────────────────┐
│     Sales Lead Manager Agent            │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   LeadManagerAgentExecutor       │  │
│  │                                  │  │
│  │  • JSON Input Parsing            │  │
│  │  • Skill Routing                 │  │
│  │  • A2A Protocol Handling         │  │
│  └──────────────────────────────────┘  │
│           │              │              │
│           ▼              ▼              │
│  ┌─────────────┐  ┌──────────────┐    │
│  │ AI Scoring  │  │ Lead Search  │    │
│  │             │  │              │    │
│  │ • Genkit    │  │ • LeadStore  │    │
│  │ • GPT-4o    │  │ • Filters    │    │
│  │ • Fallback  │  │ • Sorting    │    │
│  └─────────────┘  └──────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

## Files

- `index.ts` - Main agent implementation with A2A protocol
- `genkit.ts` - SAP AI Core configuration
- `lead-manager.prompt` - AI prompt for lead scoring
- `lead-store.ts` - Mock database with 10 sample leads
- `.env` - SAP AI Core credentials (not in git)
- `.env.example` - Template for credentials
- `README.md` - This file

## Development

### Adding New Leads

Edit `lead-store.ts` and add entries to the `leads` array:

```typescript
{
  id: 'lead-011',
  company: 'New Company',
  industry: 'Industry',
  employees: 1000,
  engagement: 'medium',
  score: 70,
  grade: 'B',
  qualified: true,
  createdAt: new Date(),
  lastUpdated: new Date(),
}
```

### Modifying Scoring Logic

Edit `lead-manager.prompt` to adjust the AI scoring criteria, or modify the `fallbackScoring()` method in `index.ts`.

## Troubleshooting

### Agent won't start
- Check SAP AI Core credentials in `.env`
- Ensure port 41245 is not in use
- Verify all dependencies are installed: `npm install`

### AI scoring fails
- Check SAP AI Core service status
- Verify credentials are correct
- Agent will use fallback scoring automatically

### Search returns no results
- Check filter criteria (case-sensitive for industry)
- Verify mock data in `lead-store.ts`
- Check console logs for errors

## Future Enhancements

- [ ] Persistent database (PostgreSQL/SQLite)
- [ ] Real-time lead updates via webhooks
- [ ] Batch scoring operations
- [ ] Custom scoring models per industry
- [ ] Integration with CRM systems
- [ ] Lead enrichment from external APIs
- [ ] Advanced analytics and reporting

## License

Part of the a2a-genkit project.
