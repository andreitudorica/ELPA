import type { INestApplication, Type } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { AdministratorGuard } from './administrator-guard';

type RouteHandler = (...args: unknown[]) => unknown;

/**
 * Walks every registered route after Nest bootstrap and asserts:
 *   1. Every route whose path starts with `admin/` is guarded by
 *      `AdministratorGuard`.
 *   2. No route outside `admin/*` carries `AdministratorGuard`.
 *
 * A violation raises before `app.listen()` — the API refuses to start
 * rather than shipping an unguarded admin endpoint (Q5 Bundle C,
 * ADR 0020). This is the "fix from core" property that prevents
 * "forgot the decorator" from becoming a security incident.
 */
export function verifyAdminRouteBoundary(app: INestApplication): void {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);

  const violations: string[] = [];

  for (const wrapper of discovery.getControllers()) {
    const instance: unknown = wrapper.instance;
    if (instance === undefined || instance === null || typeof instance !== 'object') {
      continue;
    }

    const controllerClass = (instance as { constructor: Type }).constructor;
    const basePath = readClassPath(controllerClass);
    const classGuards = readClassGuards(controllerClass);

    const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
    const methodNames = scanner.getAllMethodNames(prototype);

    for (const methodName of methodNames) {
      const method = prototype[methodName];
      if (typeof method !== 'function') continue;

      const handler = method as RouteHandler;
      const methodPath = readHandlerPath(handler);
      if (methodPath === undefined) continue;

      const methodGuards = readHandlerGuards(handler);
      const fullPath = joinPath(basePath, methodPath);
      const guards = [...classGuards, ...methodGuards];

      const isAdminPath = fullPath === 'admin' || fullPath.startsWith('admin/');
      const hasAdminGuard = guards.some((g) => g === AdministratorGuard);

      if (isAdminPath && !hasAdminGuard) {
        violations.push(`admin route "/api/${fullPath}" is missing AdministratorGuard`);
      }
      if (!isAdminPath && hasAdminGuard) {
        violations.push(`non-admin route "/api/${fullPath}" carries AdministratorGuard`);
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      [
        'Admin route boundary violations detected — refusing to start:',
        ...violations.map((v) => `  - ${v}`),
        '',
        'Use @AdminController(path) for /api/admin/* routes (composes @Controller + @UseGuards(AdministratorGuard)).',
      ].join('\n'),
    );
  }
}

function readClassPath(target: Type): string {
  const value: unknown = Reflect.getMetadata(PATH_METADATA, target);
  return typeof value === 'string' ? value : '';
}

function readClassGuards(target: Type): unknown[] {
  const value: unknown = Reflect.getMetadata(GUARDS_METADATA, target);
  return Array.isArray(value) ? value : [];
}

function readHandlerPath(handler: RouteHandler): string | undefined {
  const value: unknown = Reflect.getMetadata(PATH_METADATA, handler);
  return typeof value === 'string' ? value : undefined;
}

function readHandlerGuards(handler: RouteHandler): unknown[] {
  const value: unknown = Reflect.getMetadata(GUARDS_METADATA, handler);
  return Array.isArray(value) ? value : [];
}

function joinPath(base: string, method: string): string {
  const parts = [base, method].map((p) => p.replace(/^\/+|\/+$/g, '')).filter((p) => p.length > 0);
  return parts.join('/');
}
