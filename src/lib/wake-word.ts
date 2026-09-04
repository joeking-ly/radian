type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  start: () => void;
  abort: () => void;
};

export function containsWakeWord(text: string): boolean {
  return /\bradian\b/i.test(text);
}

export class WakeWordListener {
  private recognition?: Recognition;
  private wanted = false;
  private running = false;

  constructor(private onWake: (phrase: string) => void, private onStatus: (status: "ready" | "unsupported" | "error") => void) {}

  get supported(): boolean {
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  start(): void {
    this.wanted = true;
    if (!this.supported) { this.onStatus("unsupported"); return; }
    if (this.running) return;
    const RecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition: Recognition = new RecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const phrase = event.results[index][0]?.transcript ?? "";
        if (containsWakeWord(phrase)) {
          this.wanted = false;
          recognition.abort();
          this.onWake(phrase.trim());
          return;
        }
      }
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") this.onStatus("error");
    };
    recognition.onend = () => {
      this.running = false;
      if (this.wanted) window.setTimeout(() => this.start(), 350);
    };
    this.recognition = recognition;
    try { recognition.start(); this.running = true; this.onStatus("ready"); }
    catch { this.running = false; this.onStatus("error"); }
  }

  stop(): void {
    this.wanted = false;
    this.recognition?.abort();
    this.recognition = undefined;
    this.running = false;
  }
}
