export type SttEvents = {
  onDelta: (delta: string) => void;
  onLive: (liveText: string) => void;
  onError: (message: string) => void;
};
