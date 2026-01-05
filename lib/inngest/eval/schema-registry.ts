/**
 * Schema Registry for Eval Runs
 *
 * This registry has been refactored to be generic - schemas and tools are now extracted
 * from Langfuse observation metadata rather than being hardcoded imports.
 * 
 * When your production code logs structured output to Langfuse, it should include
 * the schema in the observation metadata under the 'schema' key, similar to how
 * promptVariables are stored.
 */

import { z } from 'zod';

// ============================================
// SCHEMA EXTRACTION & CONVERSION
// ============================================

/**
 * Extract schema from observation metadata.
 * 
 * Expected metadata structure:
 * {
 *   "schema": {
 *     "type": "object",
 *     "properties": { ... },
 *     "required": [ ... ]
 *   }
 * }
 * 
 * Or as part of responseFormat (OpenAI structured output format):
 * {
 *   "responseFormat": {
 *     "json_schema": {
 *       "schema": { ... }
 *     }
 *   }
 * }
 */
export function extractSchemaFromMetadata(metadata: any): any | undefined {
  if (!metadata) return undefined;
  
  // Check for JSON Schema format directly in metadata
  if (metadata.schema && typeof metadata.schema === 'object') {
    return metadata.schema;
  }
  
  // Check for responseFormat (OpenAI structured output format)
  if (metadata.responseFormat?.json_schema?.schema) {
    return metadata.responseFormat.json_schema.schema;
  }
  
  return undefined;
}

/**
 * Convert a JSON Schema to a simple Zod schema for validation.
 * This is a basic converter - it handles common types but may need extension.
 */
export function jsonSchemaToZod(jsonSchema: any): z.ZodSchema<any> {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.any();
  }

  // Handle object types
  if (jsonSchema.type === 'object' && jsonSchema.properties) {
    const shape: Record<string, z.ZodTypeAny> = {};
    const required = new Set(jsonSchema.required || []);

    for (const [key, propSchema] of Object.entries<any>(jsonSchema.properties)) {
      let zodType = jsonSchemaToZod(propSchema);
      
      // Make optional if not in required array
      if (!required.has(key)) {
        zodType = zodType.optional();
      }
      
      shape[key] = zodType;
    }

    return z.object(shape);
  }

  // Handle array types
  if (jsonSchema.type === 'array' && jsonSchema.items) {
    return z.array(jsonSchemaToZod(jsonSchema.items));
  }

  // Handle primitive types
  switch (jsonSchema.type) {
    case 'string':
      if (jsonSchema.enum) {
        return z.enum(jsonSchema.enum as [string, ...string[]]);
      }
      return z.string();
    case 'number':
      return z.number();
    case 'integer':
      return z.number().int();
    case 'boolean':
      return z.boolean();
    case 'null':
      return z.null();
    default:
      return z.any();
  }
}

/**
 * Get schema from observation metadata and convert to Zod.
 * Returns undefined if no schema found or conversion fails.
 */
export function getSchemaFromObservation(observation: any): z.ZodSchema<any> | undefined {
  const jsonSchema = extractSchemaFromMetadata(observation?.metadata);
  if (!jsonSchema) return undefined;
  
  try {
    return jsonSchemaToZod(jsonSchema);
  } catch (error) {
    console.warn('[SchemaRegistry] Failed to convert JSON schema to Zod:', error);
    return undefined;
  }
}

// ============================================
// TOOLS EXTRACTION
// ============================================

/**
 * Type for an OpenAI function tool definition
 */
export type OpenAITool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
    strict?: boolean;
  };
};

/**
 * Extract tools from observation metadata.
 * 
 * Expected metadata structure:
 * {
 *   "tools": [
 *     {
 *       "type": "function",
 *       "function": {
 *         "name": "myTool",
 *         "description": "...",
 *         "parameters": { ... }
 *       }
 *     }
 *   ]
 * }
 */
export function extractToolsFromMetadata(metadata: any): OpenAITool[] | undefined {
  if (!metadata) return undefined;
  
  // Check for tools array in metadata
  if (Array.isArray(metadata.tools) && metadata.tools.length > 0) {
    // Validate that tools have the expected structure
    const validTools = metadata.tools.filter(
      (tool: any) =>
        tool.type === 'function' &&
        tool.function?.name &&
        tool.function?.parameters
    );
    return validTools.length > 0 ? validTools : undefined;
  }
  
  return undefined;
}

/**
 * Get tools from an observation's metadata.
 * Returns undefined if no tools found.
 */
export function getToolsFromObservation(observation: any): OpenAITool[] | undefined {
  return extractToolsFromMetadata(observation?.metadata);
}

// ============================================
// LEGACY COMPATIBILITY STUBS
// ============================================
// These functions are kept for backward compatibility with existing code
// but now work with metadata-based schemas and tools

/**
 * @deprecated Use getSchemaFromObservation instead
 * This stub is kept for backward compatibility but always returns undefined
 * since we now extract schemas from observation metadata at runtime
 */
export function getEvalSchema(key: string): z.ZodSchema<any> | undefined {
  console.warn('[SchemaRegistry] getEvalSchema is deprecated - schemas are now extracted from observation metadata');
  return undefined;
}

/**
 * @deprecated Schema detection is now done from observation metadata
 * Returns undefined to indicate schemas should come from metadata
 */
export function detectSchemaFromPromptName(promptName: string): string | undefined {
  // No longer needed - schemas come from observation metadata
  return undefined;
}

/**
 * @deprecated Tools are now extracted from observation metadata
 * Returns undefined to indicate no tool group detected by name
 */
export function detectToolGroupFromPromptName(promptName: string): string | undefined {
  // No longer needed - tools come from observation metadata
  return undefined;
}

/**
 * @deprecated Tools are now extracted from observation metadata
 * Use getToolsFromObservation instead
 */
export function getToolsArray(key: string): OpenAITool[] | undefined {
  console.warn('[SchemaRegistry] getToolsArray is deprecated - tools are now extracted from observation metadata');
  return undefined;
}

// ============================================
// API ROUTE HELPERS (for /api/evals/schemas)
// ============================================

/**
 * Get available schema keys for the API route.
 * Since schemas are now in metadata, this returns an empty array with guidance.
 */
export const availableSchemaKeys: string[] = [];

/**
 * Schema descriptions for UI display.
 * Since schemas are now in metadata, this returns generic guidance.
 */
export const schemaDescriptions: Record<string, string> = {
  info: 'Schemas are now loaded from observation metadata. Ensure your production code logs the schema in observation metadata under the "schema" key.',
};
