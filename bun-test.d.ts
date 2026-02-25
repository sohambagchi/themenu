declare module "bun:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export const expect: any;
  export const mock: {
    module(path: string, factory: () => Record<string, unknown>): void;
  };
}
