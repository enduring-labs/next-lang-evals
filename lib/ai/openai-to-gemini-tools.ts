/**
 * Converts OpenAI function tool definitions to Gemini's native tool format.
 * This allows us to use the same tool definitions for both OpenAI and Gemini evals.
 */

import { OpenAITool } from '@/lib/ai/schema-registry';
import { FunctionDeclaration, Schema, Tool, Type } from '@google/genai';

/**
 * Convert an array of OpenAI tools to a Gemini Tool object with function declarations
 */
export function openaiToolsToGeminiTools(openaiTools: OpenAITool[]): Tool[] {
  const functionDeclarations: FunctionDeclaration[] = openaiTools.map(
    (tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: convertOpenAIParamsToGeminiSchema(tool.function.parameters),
    }),
  );

  return [{ functionDeclarations }];
}

/**
 * Convert OpenAI function parameters to Gemini Schema format
 */
function convertOpenAIParamsToGeminiSchema(params: {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}): Schema {
  const properties: Record<string, Schema> = {};

  for (const [key, value] of Object.entries(params.properties)) {
    properties[key] = convertOpenAIPropertyToGeminiSchema(
      value as OpenAIProperty,
    );
  }

  return {
    type: Type.OBJECT,
    properties,
    required: params.required,
  };
}

// Type for OpenAI property definitions
interface OpenAIProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: OpenAIProperty;
  properties?: Record<string, OpenAIProperty>;
  required?: string[];
}

/**
 * Convert a single OpenAI property definition to Gemini Schema
 */
function convertOpenAIPropertyToGeminiSchema(property: OpenAIProperty): Schema {
  const base: Schema = { type: Type.STRING };

  switch (property.type) {
    case 'string':
      if (property.enum) {
        return {
          type: Type.STRING,
          enum: property.enum,
          description: property.description,
        };
      }
      return {
        type: Type.STRING,
        description: property.description,
      };

    case 'number':
      return {
        type: Type.NUMBER,
        description: property.description,
      };

    case 'boolean':
      return {
        type: Type.BOOLEAN,
        description: property.description,
      };

    case 'array':
      if (property.items) {
        return {
          type: Type.ARRAY,
          items: convertOpenAIPropertyToGeminiSchema(property.items),
          description: property.description,
        };
      }
      return {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: property.description,
      };

    case 'object':
      if (property.properties) {
        const nestedProperties: Record<string, Schema> = {};
        for (const [key, value] of Object.entries(property.properties)) {
          nestedProperties[key] = convertOpenAIPropertyToGeminiSchema(value);
        }
        return {
          type: Type.OBJECT,
          properties: nestedProperties,
          required: property.required,
          description: property.description,
        };
      }
      return {
        type: Type.OBJECT,
        description: property.description,
      };

    default:
      console.warn(
        `[openaiToGeminiTools] Unknown property type: ${property.type}, defaulting to STRING`,
      );
      return base;
  }
}
