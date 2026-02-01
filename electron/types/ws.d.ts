declare module "ws" {
  type WebSocketReadyState = 0 | 1 | 2 | 3;

  class WebSocket {
    static OPEN: WebSocketReadyState;
    readyState: WebSocketReadyState;
    constructor(url: string, options?: { headers?: Record<string, string> });
    on(event: "open" | "message" | "error" | "close", listener: (...args: any[]) => void): void;
    send(data: string): void;
    close(): void;
  }

  export default WebSocket;
}
