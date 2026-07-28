import { Injectable } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

@Injectable()
export class ApiDocumentationService {
  private document?: OpenAPIObject;

  setDocument(document: OpenAPIObject): void {
    this.document = document;
  }

  getDocument(): OpenAPIObject {
    return (
      this.document ?? {
        openapi: '3.0.0',
        info: {
          title: 'Books MCP API',
          version: '1.0.0',
          description: 'Swagger initializes during application bootstrap.',
        },
        paths: {},
      }
    );
  }
}
