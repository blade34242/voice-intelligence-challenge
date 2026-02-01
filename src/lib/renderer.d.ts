export {};

declare global {
  interface Window {
    everlast: {
      invoke: (channel: string, payload?: any) => Promise<any>;
      on: (channel: string, callback: (data: any) => void) => () => void;
    };
  }
}
