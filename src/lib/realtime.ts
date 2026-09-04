type RealtimeHandlers = {
  onState: (state: "connecting" | "connected" | "disconnected" | "error") => void;
  onTranscript: (text: string) => void;
  onTask: (prompt: string) => Promise<string>;
  onError: (message: string) => void;
};

export class RealtimeClient {
  private pc?: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private stream?: MediaStream;
  private audio?: HTMLAudioElement;
  private pendingArgs = new Map<string, string>();

  constructor(private handlers: RealtimeHandlers) {}

  async connect(): Promise<boolean> {
    this.handlers.onState("connecting");
    try {
      const pc = new RTCPeerConnection();
      const audio = document.createElement("audio");
      audio.autoplay = true;
      pc.ontrack = (event) => (audio.srcObject = event.streams[0]);

      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported in this browser. Open Radian in Chrome or Edge.");
      const stream = await withTimeout(navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      }), 15_000, "Microphone permission timed out. Allow microphone access in the browser, then try again.");
      const track = stream.getAudioTracks()[0];
      track.enabled = false;
      pc.addTrack(track, stream);

      const dc = pc.createDataChannel("oai-events");
      dc.onmessage = (event) => this.handleEvent(JSON.parse(event.data));
      dc.onopen = () => this.handlers.onState("connected");
      dc.onclose = () => this.handlers.onState("disconnected");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp
      });
      if (!response.ok) throw new Error(await response.text());
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });

      this.pc = pc;
      this.dc = dc;
      this.stream = stream;
      this.audio = audio;
      return true;
    } catch (error) {
      this.handlers.onState("error");
      this.handlers.onError(error instanceof Error ? error.message : "Realtime connection failed");
      this.disconnect();
      return false;
    }
  }

  setListening(listening: boolean): void {
    this.stream?.getAudioTracks().forEach((track) => (track.enabled = listening));
  }

  disconnect(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.dc?.close();
    this.pc?.close();
    this.audio?.remove();
    this.handlers.onState("disconnected");
  }

  private async handleEvent(event: Record<string, any>): Promise<void> {
    if (event.type === "conversation.item.input_audio_transcription.delta" && event.delta) {
      this.handlers.onTranscript(event.delta);
    }

    if (event.type === "response.function_call_arguments.delta") {
      const key = event.call_id as string;
      this.pendingArgs.set(key, (this.pendingArgs.get(key) ?? "") + (event.delta ?? ""));
    }

    if (event.type === "response.function_call_arguments.done" && event.name === "submit_wall_task") {
      const callId = event.call_id as string;
      try {
        const args = JSON.parse(this.pendingArgs.get(callId) ?? event.arguments ?? "{}");
        const result = await this.handlers.onTask(args.prompt);
        this.send({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: callId, output: result }
        });
        this.send({ type: "response.create" });
      } catch (error) {
        this.handlers.onError(error instanceof Error ? error.message : "Could not submit task");
      } finally {
        this.pendingArgs.delete(callId);
      }
    }

    if (event.type === "error") {
      this.handlers.onError(event.error?.message ?? "Realtime API error");
    }
  }

  private send(event: object): void {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(event));
  }
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
    promise.then((value) => { window.clearTimeout(timer); resolve(value); }, (error) => { window.clearTimeout(timer); reject(error); });
  });
}
