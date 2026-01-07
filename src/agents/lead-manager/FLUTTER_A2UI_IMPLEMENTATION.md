# Flutter and A2UI Implementation Guide for Lead Manager Agent

**Version:** 2.0 (Revised)  
**Date:** January 7, 2026  
**Status:** Implementation Ready  
**Protocol Version:** A2UI v0.8 (Stable) via A2A Extension

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Official A2A/A2UI Integration](#official-a2aa2ui-integration)
4. [Backend Implementation](#backend-implementation)
5. [Flutter App Implementation](#flutter-app-implementation)
6. [Testing Strategy](#testing-strategy)
7. [References](#references)

---

## Executive Summary

This document provides the **official, standards-compliant** implementation guide for adding Flutter mobile UI support to the Lead Manager Agent using the A2UI protocol v0.8 **as an A2A extension**.

### Key Differences from v1.0

**CRITICAL CHANGE**: This revision follows the **official A2A/A2UI integration pattern** where:
- ✅ A2UI data is sent as `DataPart` objects within A2A messages
- ✅ Uses existing A2A `/tasks` endpoint (NOT a separate SSE endpoint)
- ✅ Client uses `A2uiContentGenerator` from Flutter's `genui_a2ui` package
- ✅ Follows the pattern from Google's official A2UI Python extension

**Previous v1.0 approach (INCORRECT):**
- ❌ Separate `/a2ui/stream` SSE endpoint
- ❌ Direct JSONL streaming
- ❌ Custom protocol handling

### Current State

The Lead Manager Agent currently implements:
- A2A Protocol v1.0 for agent-to-agent communication
- Two skills: `score-lead` and `search-leads`
- AI-powered lead scoring using SAP AI Core (GPT-4o)
- Express.js server on port 41245 with `/tasks` endpoint

### Target State

After implementation:
- A2UI Protocol v0.8 **as an A2A extension**
- A2UI data returned as `DataPart` objects in A2A responses
- Flutter app using official `genui_a2ui` package
- Standards-compliant integration

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Flutter Mobile App                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GenUI Framework (genui_a2ui package)                  │ │
│  │  - A2uiContentGenerator (A2A client)                   │ │
│  │  - A2uiMessageProcessor (Widget Catalog)               │ │
│  │  - GenUiConversation (Orchestrator)                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                    ↕ (A2A Messages with A2UI DataParts)
┌─────────────────────────────────────────────────────────────┐
│              Lead Manager Agent Server (Node.js)             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  A2A Protocol Handler (/tasks endpoint)                │ │
│  │  - Checks for A2UI extension in requests               │ │
│  │  - Returns A2UI data as DataParts                      │ │
│  │  - Advertises A2UI support in Agent Card               │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  A2UI Extension Module                                  │ │
│  │  - createA2uiPart() helper                             │ │
│  │  - Widget Catalog Definition                           │ │
│  │  - Extension Configuration                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    SAP AI Core (GPT-4o)                      │
└─────────────────────────────────────────────────────────────┘
```

### Communication Flow

```
┌─────────┐                                    ┌─────────┐
│ Flutter │                                    │  Agent  │
│   App   │                                    │ Server  │
└────┬────┘                                    └────┬────┘
     │                                              │
     │ 1. POST /tasks (A2A Message)                │
     │    metadata.requestedExtensions:            │
     │    ["https://a2ui.org/a2a-extension/a2ui/v0.8"]
     ├─────────────────────────────────────────────>│
     │                                              │
     │ 2. Agent checks for A2UI extension          │
     │                                              │
     │ 3. Response with A2UI DataParts             │
     │<─────────────────────────────────────────────┤
     │    parts: [{                                 │
     │      kind: 'data',                           │
     │      data: { surfaceUpdate: {...} },        │
     │      metadata: {                             │
     │        mimeType: 'application/json+a2ui'    │
     │      }                                       │
     │    }]                                        │
     │                                              │
     │ 4. GenUI renders UI from DataParts          │
     │                                              │
     │ 5. User interacts with UI                   │
     │                                              │
     │ 6. POST /tasks (userAction)                 │
     ├─────────────────────────────────────────────>│
     │                                              │
     │ 7. New A2UI DataParts in response           │
     │<─────────────────────────────────────────────┤
     │                                              │
```

---

## Official A2A/A2UI Integration

### Protocol Specification

**Official Specifications:**
- A2UI Protocol: https://a2ui.org/specification/v0.8-a2ui/
- A2A Extension: https://a2ui.org/specification/v0.8-a2a-extension/
- Python Reference: https://github.com/google/A2UI/tree/main/a2a_agents/python/a2ui_extension

### Key Concepts

**1. A2UI as A2A Extension**
- A2UI is implemented as an **extension** to the A2A protocol
- Extension URI: `https://a2ui.org/a2a-extension/a2ui/v0.8`
- A2UI data is sent as `DataPart` objects with special MIME type

**2. DataPart Format**
```typescript
{
  kind: 'data',
  data: {
    // A2UI messages: surfaceUpdate, dataModelUpdate, beginRendering, etc.
  },
  metadata: {
    mimeType: 'application/json+a2ui'
  }
}
```

**3. Extension Negotiation**
- **Server advertises** A2UI support in Agent Card
- **Client requests** A2UI extension in message metadata
- **Server activates** extension and returns A2UI DataParts

---

## Backend Implementation

### Phase 1: Create A2UI Extension Module

**File:** `src/agents/lead-manager/a2ui-extension.ts`

```typescript
import { Part, AgentExtension } from '@a2a-js/sdk';

// Constants from official A2UI specification
export const A2UI_EXTENSION_URI = 'https://a2ui.org/a2a-extension/a2ui/v0.8';
export const A2UI_MIME_TYPE = 'application/json+a2ui';
export const STANDARD_CATALOG_ID = 'https://github.com/google/A2UI/blob/main/specification/0.8/json/standard_catalog_definition.json';
export const LEAD_CATALOG_ID = 'https://your-domain.com/a2ui/lead-catalog/v1';

/**
 * Creates an A2A Part containing A2UI data.
 * This follows the official pattern from the Python A2UI extension.
 * 
 * @param a2uiData - The A2UI message (surfaceUpdate, dataModelUpdate, etc.)
 * @returns An A2A Part with A2UI data
 */
export function createA2uiPart(a2uiData: any): Part {
  return {
    kind: 'data',
    data: a2uiData,
    metadata: {
      mimeType: A2UI_MIME_TYPE
    }
  };
}

/**
 * Checks if an A2A Part contains A2UI data.
 */
export function isA2uiPart(part: Part): boolean {
  return (
    part.kind === 'data' &&
    part.metadata?.mimeType === A2UI_MIME_TYPE
  );
}

/**
 * Creates the A2UI AgentExtension configuration.
 * This is advertised in the Agent Card.
 * 
 * @param acceptsInlineCatalogs - Whether agent accepts inline custom catalogs
 * @param supportedCatalogIds - Pre-defined catalogs the agent supports
 */
export function getA2uiAgentExtension(
  acceptsInlineCatalogs: boolean = false,
  supportedCatalogIds: string[] = [STANDARD_CATALOG_ID, LEAD_CATALOG_ID]
): AgentExtension {
  const params: any = {};
  
  // Only set if not default value
  if (acceptsInlineCatalogs) {
    params.acceptsInlineCatalogs = true;
  }
  
  if (supportedCatalogIds.length > 0) {
    params.supportedCatalogIds = supportedCatalogIds;
  }
  
  return {
    uri: A2UI_EXTENSION_URI,
    description: 'Provides agent driven UI using the A2UI JSON format.',
    params: Object.keys(params).length > 0 ? params : undefined
  };
}

/**
 * Checks if A2UI extension is requested in the incoming message.
 */
export function isA2uiExtensionRequested(
  requestedExtensions?: string[]
): boolean {
  return requestedExtensions?.includes(A2UI_EXTENSION_URI) ?? false;
}

/**
 * Helper to create A2UI component definitions
 */
export function createA2uiComponent(
  id: string,
  type: string,
  props: Record<string, any>
): any {
  return {
    id,
    component: {
      [type]: props
    }
  };
}

/**
 * Helper to create literal values for A2UI
 */
export function literal(value: string | number | boolean): Record<string, any> {
  if (typeof value === 'string') {
    return { literalString: value };
  } else if (typeof value === 'number') {
    return { literalNumber: value };
  } else {
    return { literalBoolean: value };
  }
}
```

### Phase 2: Define Widget Catalog

**File:** `src/agents/lead-manager/catalog.ts`

```typescript
import { LEAD_CATALOG_ID } from './a2ui-extension.js';

/**
 * Lead Management Widget Catalog
 * Defines custom widgets for displaying lead data
 */
export const leadCatalog = {
  catalogId: LEAD_CATALOG_ID,
  version: '1.0.0',
  components: {
    // Standard A2UI components (subset)
    Column: {
      type: 'object',
      properties: {
        alignment: {
          type: 'string',
          enum: ['start', 'center', 'end']
        },
        children: {
          type: 'object',
          properties: {
            explicitList: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    },
    
    Row: {
      type: 'object',
      properties: {
        alignment: {
          type: 'string',
          enum: ['start', 'center', 'end', 'spaceBetween']
        },
        children: {
          type: 'object',
          properties: {
            explicitList: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    },
    
    Text: {
      type: 'object',
      properties: {
        text: {
          oneOf: [
            { type: 'object', properties: { literalString: { type: 'string' } } },
            { type: 'object', properties: { dataBinding: { type: 'string' } } }
          ]
        },
        usageHint: {
          type: 'string',
          enum: ['h1', 'h2', 'h3', 'body', 'caption']
        }
      },
      required: ['text']
    },
    
    Card: {
      type: 'object',
      properties: {
        child: { type: 'string' }
      }
    },
    
    // Custom lead management components
    LeadScoreCard: {
      type: 'object',
      description: 'Displays a lead score with company info, grade, and recommendations',
      properties: {
        company: {
          oneOf: [
            { type: 'object', properties: { literalString: { type: 'string' } } },
            { type: 'object', properties: { dataBinding: { type: 'string' } } }
          ],
          description: 'Company name'
        },
        score: {
          oneOf: [
            { type: 'object', properties: { literalNumber: { type: 'number' } } },
            { type: 'object', properties: { dataBinding: { type: 'string' } } }
          ],
          description: 'Lead score (0-100)'
        },
        grade: {
          oneOf: [
            { type: 'object', properties: { literalString: { type: 'string' } } },
            { type: 'object', properties: { dataBinding: { type: 'string' } } }
          ],
          description: 'Lead grade (A, B, C, D)'
        },
        qualified: {
          oneOf: [
            { type: 'object', properties: { literalBoolean: { type: 'boolean' } } },
            { type: 'object', properties: { dataBinding: { type: 'string' } } }
          ],
          description: 'Whether lead is qualified'
        },
        recommendations: {
          type: 'object',
          properties: {
            dataBinding: { type: 'string' }
          },
          description: 'Array of recommendation strings'
        }
      },
      required: ['company', 'score', 'grade']
    },
    
    LeadListItem: {
      type: 'object',
      description: 'Compact lead list item for search results',
      properties: {
        company: {
          oneOf: [
            { type: 'object', properties: { literalString: { type: 'string' } } },
            { type: 'object', properties: { dataBinding: { type: 'string' } } }
          ]
        },
        industry: {
          oneOf: [
            { type: 'object', properties: { literalString: { type: 'string' } } },
            { type: 'object', properties: { dataBinding: { type: 'string' } } }
          ]
        },
        score: {
          oneOf: [
            { type: 'object', properties: { literalNumber: { type: 'number' } } },
            { type: 'object', properties: { dataBinding: { type: 'string' } } }
          ]
        },
        grade: {
          oneOf: [
            { type: 'object', properties: { literalString: { type: 'string' } } },
            { type: 'object', properties: { dataBinding: { type: 'string' } } }
          ]
        }
      },
      required: ['company', 'score', 'grade']
    }
  },
  styles: {}
};
```

### Phase 3: Modify LeadManagerAgentExecutor

**File:** `src/agents/lead-manager/index.ts` (modifications)

```typescript
import {
  createA2uiPart,
  isA2uiExtensionRequested,
  createA2uiComponent,
  literal,
  LEAD_CATALOG_ID
} from './a2ui-extension.js';

class LeadManagerAgentExecutor implements AgentExecutor {
  // ... existing code ...

  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;
    
    // Check if A2UI extension is requested
    const useA2ui = isA2uiExtensionRequested(
      userMessage.metadata?.requestedExtensions
    );

    const taskId = existingTask?.id || uuidv4();
    const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

    console.log(`[LeadManagerAgentExecutor] Processing message ${userMessage.messageId}`);
    console.log(`[LeadManagerAgentExecutor] A2UI extension requested: ${useA2ui}`);

    // Publish initial task if new
    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId: contextId,
        status: {
          state: 'submitted',
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata,
      };
      eventBus.publish(initialTask);
    }

    try {
      // Extract input and process (existing logic)
      const inputText = userMessage.parts
        .filter((p): p is TextPart => p.kind === 'text')
        .map((p) => p.text)
        .join(' ')
        .trim();

      // Process lead scoring or search (existing logic)
      const result = await this.processLeadRequest(inputText);

      // Create response based on whether A2UI is requested
      if (useA2ui) {
        // Return A2UI data as DataParts
        const a2uiParts = this.createA2uiResponse(result, taskId, contextId);
        
        const agentMessage: Message = {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: a2uiParts, // A2UI DataParts
          taskId: taskId,
          contextId: contextId,
        };

        const finalUpdate: TaskStatusUpdateEvent = {
          kind: 'status-update',
          taskId: taskId,
          contextId: contextId,
          status: {
            state: 'completed',
            message: agentMessage,
            timestamp: new Date().toISOString(),
          },
          final: true,
        };
        eventBus.publish(finalUpdate);
      } else {
        // Return regular JSON response (existing behavior)
        const agentMessage: Message = {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: JSON.stringify(result, null, 2) }],
          taskId: taskId,
          contextId: contextId,
        };

        const finalUpdate: TaskStatusUpdateEvent = {
          kind: 'status-update',
          taskId: taskId,
          contextId: contextId,
          status: {
            state: 'completed',
            message: agentMessage,
            timestamp: new Date().toISOString(),
          },
          final: true,
        };
        eventBus.publish(finalUpdate);
      }

      console.log(`[LeadManagerAgentExecutor] Task ${taskId} completed successfully`);
    } catch (error: unknown) {
      console.error(`[LeadManagerAgentExecutor] Error processing task ${taskId}:`, error);
      // Error handling...
    }
  }

  /**
   * Creates A2UI response parts from lead data
   */
  private createA2uiResponse(result: any, taskId: string, contextId: string): Part[] {
    const surfaceId = `lead-result-${taskId}`;
    const parts: Part[] = [];

    // 1. surfaceUpdate with components
    const components = [];
    
    if (result.score !== undefined) {
      // Lead scoring result - create LeadScoreCard
      components.push(
        createA2uiComponent('root', 'Column', {
          children: { explicitList: ['lead_card'] }
        }),
        createA2uiComponent('lead_card', 'LeadScoreCard', {
          company: literal(result.company || 'Unknown'),
          score: literal(result.score),
          grade: literal(result.grade),
          qualified: literal(result.qualified),
          recommendations: { dataBinding: 'recommendations' }
        })
      );
    } else if (result.leads) {
      // Search results - create list of LeadListItem
      components.push(
        createA2uiComponent('root', 'Column', {
          children: { explicitList: result.leads.map((_: any, i: number) => `lead_${i}`) }
        })
      );
      
      result.leads.forEach((lead: any, i: number) => {
        components.push(
          createA2uiComponent(`lead_${i}`, 'LeadListItem', {
            company: literal(lead.company),
            industry: literal(lead.industry),
            score: literal(lead.score),
            grade: literal(lead.grade)
          })
        );
      });
    }

    parts.push(createA2uiPart({
      surfaceUpdate: {
        surfaceId,
        components
      }
    }));

    // 2. dataModelUpdate with data
    parts.push(createA2uiPart({
      dataModelUpdate: {
        surfaceId,
        contents: {
          recommendations: result.recommendations || []
        }
      }
    }));

    // 3. beginRendering to trigger render
    parts.push(createA2uiPart({
      beginRendering: {
        surfaceId,
        root: 'root',
        catalogId: LEAD_CATALOG_ID
      }
    }));

    return parts;
  }

  // ... rest of existing methods ...
}
```

### Phase 4: Update Agent Card

**File:** `src/agents/lead-manager/index.ts` (modifications)

```typescript
import { getA2uiAgentExtension, LEAD_CATALOG_ID, STANDARD_CATALOG_ID } from './a2ui-extension.js';

const leadManagerAgentCard: AgentCard = {
  name: "Sales Lead Manager",
  description: "An AI agent for managing sales leads with A2UI support for Flutter mobile apps.",
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
    // Add A2UI extension
    extensions: [
      getA2uiAgentExtension(true, [STANDARD_CATALOG_ID, LEAD_CATALOG_ID])
    ]
  },
  defaultInputModes: ["application/json"],
  defaultOutputModes: ["application/json"],
  skills: [
    // ... existing skills ...
  ],
  supportsAuthenticatedExtendedCard: false,
};
```

---

## Flutter App Implementation

### Phase 1: Create Flutter Project

```bash
flutter create lead_manager_flutter
cd lead_manager_flutter
```

### Phase 2: Add Dependencies

**File:** `pubspec.yaml`

```yaml
name: lead_manager_flutter
description: Lead Manager mobile app with official A2UI support
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  
  # Official GenUI and A2UI packages
  genui: ^0.1.0
  genui_a2ui: ^0.1.0  # Official A2UI client
  a2a: ^0.3.0
  json_schema_builder: ^1.0.0
  
  # HTTP
  http: ^1.1.0
  
  # UI
  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
```

### Phase 3: Define Custom Lead Widgets

**File:** `lib/widgets/lead_widgets.dart`

```dart
import 'package:flutter/material.dart';
import 'package:genui/genui.dart';
import 'package:json_schema_builder/json_schema_builder.dart';

/// LeadScoreCard widget for displaying lead scoring results
final leadScoreCardItem = CatalogItem(
  name: 'LeadScoreCard',
  dataSchema: S.object(
    properties: {
      'company': S.string(description: 'Company name'),
      'score': S.integer(description: 'Lead score (0-100)'),
      'grade': S.string(description: 'Lead grade (A, B, C, D)'),
      'qualified': S.boolean(description: 'Whether lead is qualified'),
      'recommendations': S.array(
        items: S.string(),
        description: 'Array of recommendation strings'
      ),
    },
    required: ['company', 'score', 'grade'],
  ),
  builder: (context, data) {
    final company = data['company'] as String;
    final score = data['score'] as int;
    final grade = data['grade'] as String;
    final qualified = data['qualified'] as bool? ?? false;
    final recommendations = data['recommendations'] as List?;
    
    return Card(
      elevation: 4,
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Company name and grade
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    company,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Chip(
                  label: Text(
                    'Grade $grade',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  backgroundColor: _getGradeColor(grade),
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            // Score progress
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Score', style: Theme.of(context).textTheme.titleMedium),
                Text(
                  '$score/100',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: _getScoreColor(score),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: score / 100,
              backgroundColor: Colors.grey[300],
              valueColor: AlwaysStoppedAnimation(_getScoreColor(score)),
              minHeight: 8,
            ),
            
            const SizedBox(height: 16),
            
            // Qualification status
            Row(
              children: [
                Icon(
                  qualified ? Icons.check_circle : Icons.cancel,
                  color: qualified ? Colors.green : Colors.red,
                ),
                const SizedBox(width: 8),
                Text(
                  qualified ? 'Qualified Lead' : 'Not Qualified',
                  style: TextStyle(
                    color: qualified ? Colors.green : Colors.red,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            
            // Recommendations
            if (recommendations != null && recommendations.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 8),
              Text(
                'Recommendations',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              ...recommendations.map((rec) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.arrow_right, color: Colors.blue),
                    const SizedBox(width: 4),
                    Expanded(child: Text(rec as String)),
                  ],
                ),
              )),
            ],
          ],
        ),
      ),
    );
  },
);

/// LeadListItem widget for search results
final leadListItemItem = CatalogItem(
  name: 'LeadListItem',
  dataSchema: S.object(
    properties: {
      'company': S.string(),
      'industry': S.string(),
      'score': S.integer(),
      'grade': S.string(),
    },
    required: ['company', 'score', 'grade'],
  ),
  builder: (context, data) {
    final company = data['company'] as String;
    final industry = data['industry'] as String?;
    final score = data['score'] as int;
    final grade = data['grade'] as String;
    
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: _getGradeColor(grade),
        child: Text(
          grade,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      title: Text(company, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: industry != null ? Text(industry) : null,
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: _getScoreColor(score).withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          '$score',
          style: TextStyle(
            color: _getScoreColor(score),
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  },
);

Color _getGradeColor(String grade) {
  switch (grade.toUpperCase()) {
    case 'A': return Colors.green;
    case 'B': return Colors.blue;
    case 'C': return Colors.orange;
    default: return Colors.red;
  }
}

Color _getScoreColor(int score) {
  if (score >= 90) return Colors.green
;
  if (score >= 70) return Colors.blue;
  if (score >= 50) return Colors.orange;
  return Colors.red;
}
```

### Phase 4: Create Chat Screen with A2uiContentGenerator

**File:** `lib/screens/chat_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:genui/genui.dart';
import 'package:genui_a2ui/genui_a2ui.dart';
import '../widgets/lead_widgets.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _textController = TextEditingController();
  late final A2uiMessageProcessor _processor;
  late final A2uiContentGenerator _contentGenerator;
  late final GenUiConversation _conversation;
  final List<String> _surfaceIds = [];

  @override
  void initState() {
    super.initState();
    
    // Create catalog with standard + custom lead widgets
    final catalog = Catalog(components: [
      ...CoreCatalogItems.asCatalog().components,
      leadScoreCardItem,
      leadListItemItem,
    ]);
    
    _processor = A2uiMessageProcessor(catalogs: [catalog]);
    
    // IMPORTANT: Use A2uiContentGenerator, NOT SSE endpoint
    // This connects to the A2A /tasks endpoint
    _contentGenerator = A2uiContentGenerator(
      serverUrl: Uri.parse('http://localhost:41245'), // A2A endpoint
    );
    
    _conversation = GenUiConversation(
      contentGenerator: _contentGenerator,
      a2uiMessageProcessor: _processor,
      onSurfaceAdded: (update) {
        setState(() => _surfaceIds.add(update.surfaceId));
      },
      onSurfaceDeleted: (update) {
        setState(() => _surfaceIds.remove(update.surfaceId));
      },
    );
  }

  @override
  void dispose() {
    _textController.dispose();
    _conversation.dispose();
    _processor.dispose();
    _contentGenerator.dispose();
    super.dispose();
  }

  void _sendMessage(String text) {
    if (text.trim().isEmpty) return;
    
    // A2uiContentGenerator automatically includes A2UI extension request
    _conversation.sendRequest(UserMessage.text(text));
    _textController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lead Manager'),
        backgroundColor: Colors.blue,
      ),
      body: Column(
        children: [
          // AI-generated UI surfaces
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: _surfaceIds.length,
              itemBuilder: (context, index) {
                return GenUiSurface(
                  host: _processor,
                  surfaceId: _surfaceIds[index],
                );
              },
            ),
          ),
          
          // Input field
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.3),
                  spreadRadius: 1,
                  blurRadius: 3,
                ),
              ],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      decoration: InputDecoration(
                        hintText: 'Ask about leads...',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                      ),
                      onSubmitted: _sendMessage,
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.send),
                    onPressed: () => _sendMessage(_textController.text),
                    color: Colors.blue,
                    iconSize: 28,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

### Phase 5: Main App Entry Point

**File:** `lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'screens/chat_screen.dart';

void main() {
  runApp(const LeadManagerApp());
}

class LeadManagerApp extends StatelessWidget {
  const LeadManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lead Manager',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const ChatScreen(),
    );
  }
}
```

---

## Testing Strategy

### Unit Tests

**Backend:**
1. Test `createA2uiPart()` creates correct DataPart format
2. Test `isA2uiExtensionRequested()` detects extension correctly
3. Test `createA2uiResponse()` generates valid A2UI messages

**Flutter:**
1. Test LeadScoreCard renders with valid data
2. Test LeadListItem renders with valid data
3. Test catalog item schemas validate correctly

### Integration Tests

1. **A2A Message Flow**
   - Send A2A message with A2UI extension request
   - Verify agent returns DataParts with correct MIME type
   - Verify A2UI data structure is valid

2. **End-to-End Flow**
   - User sends "Score lead for SAP"
   - Agent returns A2UI DataParts
   - Flutter renders LeadScoreCard
   - User sees lead score UI

### Manual Testing Scenarios

1. **Lead Scoring**: "Score lead for SAP"
2. **Lead Search**: "Search for software companies with score above 70"
3. **Natural Language**: "Find qualified leads in manufacturing"

---

## References

### Official Documentation

- **A2UI Protocol v0.8**: https://a2ui.org/specification/v0.8-a2ui/
- **A2A Extension**: https://a2ui.org/specification/v0.8-a2a-extension/
- **Flutter GenUI**: https://docs.flutter.dev/ai/genui/get-started
- **Python A2UI Extension**: https://github.com/google/A2UI/tree/main/a2a_agents/python/a2ui_extension
- **Flutter GenUI Examples**: https://github.com/flutter/genui/tree/main/examples
- **A2A Protocol**: https://a2a-protocol.org/

### Key Differences from v1.0

| Aspect | v1.0 (Incorrect) | v2.0 (Correct) |
|--------|------------------|----------------|
| **Server Endpoint** | `/a2ui/stream` (SSE) | `/tasks` (A2A) |
| **Protocol** | Custom JSONL/SSE | A2A with A2UI extension |
| **Data Format** | Raw JSONL | A2UI wrapped in DataParts |
| **Client Library** | Custom SSE client | `A2uiContentGenerator` |
| **Extension Activation** | N/A | Via `requestedExtensions` |
| **MIME Type** | N/A | `application/json+a2ui` |

---

## Next Steps

1. **Implement backend A2UI extension** (Phase 1-4)
2. **Create Flutter app** (Phase 1-5)
3. **Test integration** end-to-end
4. **Deploy to production** with proper security

For questions or issues, refer to the official A2UI and GenUI documentation.

---

**Document Version:** 2.0 (Revised)  
**Last Updated:** January 7, 2026  
**Status:** Ready for Implementation (Official A2A/A2UI Pattern)
