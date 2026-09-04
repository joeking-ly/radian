import { useEffect, useMemo, useRef, useState } from "react";
import { createJob, decideApproval, fetchHealth } from "./lib/api";
import { RealtimeClient } from "./lib/realtime";
import type { Approval, JobEvent, WallCard, WallState } from "./types";

const samplePrompts = [
  "Research three competitors and present the differences",
  "Open OpenAI's website and tell me what changed",
  "Create a concise launch plan for a new ecommerce brand"
];

export function App() {
  const [state, setState] = useState<WallState>("idle");
  const [jobId, setJobId] = useState<string>();
  const [message, setMessage] = useState("Ready when you are");
  const [transcript, setTranscript] = useState("");
  const [card, setCard] = useState<WallCard>();
  const [approval, setApproval] = useState<Approval>();
  const [screenshot, setScreenshot] = useState<string>();
  const [prompt, setPrompt] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("disconnected");
  const [listening, setListening] = useState(false);
  const eventSource = useRef<EventSource | undefined>(undefined);
  const realtime = useRef<RealtimeClient | undefined>(undefined);

  const startTask = async (taskPrompt: string) => {
    if (!taskPrompt.trim()) return "No task was supplied.";
    eventSource.current?.close();
    setPrompt("");
    setTranscript(taskPrompt);
    setCard(undefined);
    setApproval(undefined);
    setScreenshot(undefined);
    setState("planning");
    setMessage("Understanding the request");
    const job = await createJob(taskPrompt);
    setJobId(job.id);
    subscribe(job.id);
    return `Task ${job.id} has started. I will show the work on the wall.`;
  };

  const subscribe = (id: string) => {
    const source = new EventSource(`/api/jobs/${id}/events`);
    eventSource.current = source;
    source.onmessage = ({ data }) => applyEvent(JSON.parse(data));
    source.onerror = () => {
      source.close();
      setState((current) => current === "presenting" ? current : "error");
    };
  };

  const applyEvent = (event: JobEvent) => {
    if (event.state) setState(event.state);
    if (event.message) setMessage(event.message);
    if (event.type === "card" && event.card) setCard(event.card);
    if (event.type === "browser" && event.screenshotUrl) setScreenshot(event.screenshotUrl);
    if (event.type === "approval" && event.approval) setApproval(event.approval);
    if (event.type === "complete" || event.type === "error") eventSource.current?.close();
  };

  useEffect(() => {
    fetchHealth().then((health) => setMockMode(health.mockMode)).catch(() => setState("error"));
    const client = new RealtimeClient({
      onState: setVoiceStatus,
      onTranscript: (delta) => setTranscript((value) => value + delta),
      onTask: startTask,
      onError: (error) => { setMessage(error); setState("error"); }
    });
    realtime.current = client;
    return () => { client.disconnect(); eventSource.current?.close(); };
  }, []);

  const clock = useClock();
  const activityLabel = useMemo(() => state === "idle" ? "RADIAN" : state.toUpperCase(), [state]);

  const toggleListening = async () => {
    if (voiceStatus === "disconnected" || voiceStatus === "error") await realtime.current?.connect();
    const next = !listening;
    setListening(next);
    realtime.current?.setListening(next);
    setState(next ? "listening" : "idle");
    setMessage(next ? "Listening" : "Ready when you are");
    if (next) setTranscript("");
  };

  const resolveApproval = async (approved: boolean) => {
    if (!jobId) return;
    await decideApproval(jobId, approved);
    setApproval(undefined);
  };

  return (
    <main className={`wall state-${state}`}>
      <div className="aurora aurora-one" /><div className="aurora aurora-two" />
      <header>
        <div className="brand"><span className="brand-mark" />{activityLabel}</div>
        <div className="system-status">
          {mockMode && <span className="mode-pill">DEMO MODE</span>}
          <span className={`dot ${voiceStatus}`} /> {voiceStatus === "connected" ? "VOICE ONLINE" : "VOICE OFFLINE"}
        </div>
        <time>{clock}</time>
      </header>

      <section className="stage">
        {screenshot && <div className="browser-frame"><img src={screenshot} alt="Astra-controlled browser" /></div>}
        {card && <article className="result-card">
          <span>{card.eyebrow ?? "ASTRA RESULT"}</span>
          <h1>{card.title}</h1>
          <p>{card.body}</p>
          {card.bullets && <ul>{card.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
          {card.sourceUrl && <small>{card.sourceUrl}</small>}
        </article>}
        {!card && !screenshot && <div className="focus">
          <div className={`orb ${listening ? "active" : ""}`}><div /><div /><div /></div>
          <h1>{message}</h1>
          {transcript && <p className="transcript">“{transcript}”</p>}
        </div>}
      </section>

      {approval && <div className="approval-backdrop"><section className="approval-card">
        <span className={`risk risk-${approval.risk}`}>{approval.risk} action</span>
        <h2>{approval.title}</h2><p>{approval.description}</p>
        <div><button className="secondary" onClick={() => resolveApproval(false)}>Cancel</button>
        <button className="primary" onClick={() => resolveApproval(true)}>Approve</button></div>
      </section></div>}

      <footer>
        <form onSubmit={(event) => { event.preventDefault(); startTask(prompt).catch((e) => { setMessage(e.message); setState("error"); }); }}>
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask Astra to do something…" />
          <button className="send" aria-label="Submit">↗</button>
        </form>
        <button className={`mic ${listening ? "active" : ""}`} onClick={toggleListening} aria-label="Toggle microphone">
          <span className="mic-icon">●</span><span>{listening ? "Release to stop" : "Talk to Astra"}</span>
        </button>
        <div className="suggestions">{samplePrompts.map((item) => <button key={item} onClick={() => startTask(item)}>{item}</button>)}</div>
      </footer>
    </main>
  );
}

function useClock() {
  const format = () => new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit" }).format(new Date());
  const [value, setValue] = useState(format);
  useEffect(() => { const timer = window.setInterval(() => setValue(format()), 10_000); return () => clearInterval(timer); }, []);
  return value;
}
