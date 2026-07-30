import { Injectable, Logger } from '@nestjs/common';
import type {
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  RequestBodyObject,
  ResponseObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

import { MCP_EXCLUDE_EXTENSION } from './mcp-exclude.decorator';
import type { JsonSchema, McpHttpOperation } from './mcp-route.models';

@Injectable()
export class McpRouteCatalogService {
  private readonly logger = new Logger(McpRouteCatalogService.name);
  private operations?: McpHttpOperation[];
  private documentation?: string;

  initialize(document: OpenAPIObject): void {
    const operations: McpHttpOperation[] = [];
    const toolNames = new Set<string>();

    for (const [path, pathItem] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!this.isOperation(operation)) {
          continue;
        }
        if (
          this.isExcluded(operation) ||
          !this.isBearerSecured(operation, document)
        ) {
          continue;
        }

        const toolName = this.toToolName(operation.operationId);
        if (toolNames.has(toolName)) {
          throw new Error(`Generated duplicate MCP tool name: ${toolName}`);
        }
        toolNames.add(toolName);

        operations.push(
          this.toMcpOperation(
            path,
            method.toUpperCase(),
            pathItem,
            operation,
            toolName,
            document,
          ),
        );
      }
    }

    operations.sort((left, right) =>
      left.toolName.localeCompare(right.toolName),
    );
    this.operations = operations;
    this.documentation = this.buildDocumentation(document, operations);
    this.logger.log(
      `Generated ${operations.length} MCP tools from the live OpenAPI document`,
    );
  }

  getOperations(): McpHttpOperation[] {
    if (!this.operations) {
      throw new Error('MCP route catalog has not been initialized');
    }
    return this.operations;
  }

  getDocumentation(): string {
    if (!this.documentation) {
      throw new Error('MCP route catalog has not been initialized');
    }
    return this.documentation;
  }

  private buildDocumentation(
    document: OpenAPIObject,
    operations: McpHttpOperation[],
  ): string {
    const sections = operations.map(
      (operation) => `## ${operation.title}

- MCP tool: \`${operation.toolName}\`
- REST operation: \`${operation.method} ${operation.path}\`
- Purpose: ${operation.description.replace(/\.\s+Calls the existing authenticated REST operation.*$/, '')}

### Input schema

\`\`\`json
${JSON.stringify(operation.inputSchema, null, 2)}
\`\`\`

### Successful response schema

\`\`\`json
${JSON.stringify(operation.outputSchema, null, 2)}
\`\`\``,
    );

    return `# ${document.info.title} API

Version ${document.info.version}. This reference is generated from the live NestJS OpenAPI document, so it stays aligned with the controllers and DTOs.

Use the matching MCP tool for live application data. Present results in concise, human-friendly Markdown. Prefer meaningful fields over internal identifiers unless the user asks for an ID or it is required for a follow-up operation.

${sections.join('\n\n')}`;
  }

  private isOperation(
    value: unknown,
  ): value is OperationObject & { operationId: string } {
    return (
      this.isObject(value) &&
      typeof value.operationId === 'string' &&
      this.isObject(value.responses)
    );
  }

  private isExcluded(operation: OperationObject): boolean {
    return (
      (operation as OperationObject & Record<string, unknown>)[
        MCP_EXCLUDE_EXTENSION
      ] === true
    );
  }

  private isBearerSecured(
    operation: OperationObject,
    document: OpenAPIObject,
  ): boolean {
    const requirements = operation.security ?? document.security ?? [];
    return requirements.some((requirement) =>
      Object.keys(requirement).some((name) =>
        name.toLowerCase().includes('bearer'),
      ),
    );
  }

  private toMcpOperation(
    path: string,
    method: McpHttpOperation['method'],
    pathItem: PathItemObject,
    operation: OperationObject,
    toolName: string,
    document: OpenAPIObject,
  ): McpHttpOperation {
    const summary = operation.summary ?? operation.description ?? toolName;
    const isReadOnly = method === 'GET';
    const isDelete = method === 'DELETE';

    return {
      toolName,
      title: summary,
      description: `${summary}. Calls the existing authenticated REST operation ${method} ${path}.`,
      operationId: operation.operationId ?? toolName,
      method,
      path,
      inputSchema: this.buildInputSchema(pathItem, operation, document),
      outputSchema: this.buildOutputSchema(operation, document),
      annotations: {
        title: summary,
        readOnlyHint: isReadOnly,
        destructiveHint: isDelete,
        idempotentHint: isReadOnly || isDelete,
        openWorldHint: false,
      },
    };
  }

  private buildInputSchema(
    pathItem: PathItemObject,
    operation: OperationObject,
    document: OpenAPIObject,
  ): JsonSchema {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    const parameters = [
      ...(pathItem.parameters ?? []),
      ...(operation.parameters ?? []),
    ]
      .map((parameter) => this.dereference(parameter, document))
      .filter(
        (parameter): parameter is ParameterObject =>
          this.isObject(parameter) &&
          typeof parameter.name === 'string' &&
          typeof parameter.in === 'string',
      );

    for (const location of ['path', 'query'] as const) {
      const matching = parameters.filter(
        (parameter) => parameter.in === location,
      );
      if (!matching.length) {
        continue;
      }

      const locationProperties: Record<string, unknown> = {};
      const locationRequired: string[] = [];
      for (const parameter of matching) {
        locationProperties[parameter.name] = this.dereference(
          parameter.schema ?? {},
          document,
        );
        if (parameter.required) {
          locationRequired.push(parameter.name);
        }
      }

      properties[location] = {
        type: 'object',
        properties: locationProperties,
        ...(locationRequired.length ? { required: locationRequired } : {}),
        additionalProperties: false,
      };
      if (locationRequired.length) {
        required.push(location);
      }
    }

    const requestBody = this.dereference(operation.requestBody, document) as
      | RequestBodyObject
      | undefined;
    const bodySchema =
      requestBody?.content?.['application/json']?.schema ??
      Object.values(requestBody?.content ?? {})[0]?.schema;
    if (bodySchema) {
      properties.body = this.dereference(bodySchema, document);
      if (requestBody?.required) {
        required.push('body');
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    };
  }

  private buildOutputSchema(
    operation: OperationObject,
    document: OpenAPIObject,
  ): JsonSchema {
    const successEntry = Object.entries(operation.responses)
      .filter(([status]) => /^2\d\d$/.test(status))
      .sort(([left], [right]) => left.localeCompare(right))[0];
    const response = this.dereference(successEntry?.[1], document) as
      | ResponseObject
      | undefined;
    const responseSchema =
      response?.content?.['application/json']?.schema ??
      Object.values(response?.content ?? {})[0]?.schema;

    return {
      type: 'object',
      properties: {
        status: { type: 'integer', minimum: 200, maximum: 299 },
        data: responseSchema ? this.dereference(responseSchema, document) : {},
      },
      required: ['status', 'data'],
      additionalProperties: false,
    };
  }

  private toToolName(operationId: string): string {
    const match = operationId.match(/^(.+?Controller)_(.+)$/);
    if (!match) {
      return this.toSnakeCase(operationId);
    }
    return `${this.toSnakeCase(match[1].replace(/Controller$/, ''))}_${this.toSnakeCase(match[2])}`;
  }

  private toSnakeCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  private dereference(
    value: unknown,
    document: OpenAPIObject,
    references = new Set<string>(),
  ): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.dereference(item, document, references));
    }
    if (!this.isObject(value)) {
      return value;
    }

    const reference = value.$ref;
    if (typeof reference === 'string' && reference.startsWith('#/')) {
      if (references.has(reference)) {
        return {};
      }
      const target = reference
        .slice(2)
        .split('/')
        .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
        .reduce<unknown>(
          (current, part) =>
            this.isObject(current) ? current[part] : undefined,
          document,
        );
      if (target === undefined) {
        throw new Error(
          `OpenAPI reference could not be resolved: ${reference}`,
        );
      }
      const nextReferences = new Set(references).add(reference);
      const siblings = Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== '$ref'),
      );
      return {
        ...(this.dereference(target, document, nextReferences) as Record<
          string,
          unknown
        >),
        ...(this.dereference(siblings, document, nextReferences) as Record<
          string,
          unknown
        >),
      };
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        this.dereference(child, document, references),
      ]),
    );
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
