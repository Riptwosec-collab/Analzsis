import { analyzeCli } from "@/parsers";

self.onmessage = (event: MessageEvent<{ text: string }>) => {
  const result = analyzeCli(event.data.text);
  self.postMessage(result);
};
