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

declare module '*/voice-activity' {
  export function createVoiceMonitor(stream: MediaStream): any;
  export function createVoiceActivityDetector(start?: number, options?: any): any;
}

declare module '*/zen-flow' {
  export function createZenCompletion(options: any): any;
}
