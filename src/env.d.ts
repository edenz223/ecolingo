/* eslint-disable */
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
    VUE_ROUTER_BASE: string | undefined;
  }
}

declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'jschardet' {
  export interface IDetectResult {
    encoding: string;
    confidence: number;
  }
  export function detect(buffer: Buffer | Uint8Array, options?: any): IDetectResult;
}

declare module 'quasar/wrappers' {
  export function route<T>(fn: T): T;
}
