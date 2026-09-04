import { useEffect, useMemo, useRef, useState } from "react";
import { createJob, decideApproval, fetchApprovals, fetchHealth, resolveControllerApproval, type PendingApproval } from "./lib/api";
import { RealtimeClient } from "./lib/realtime";
import { WakeWordListener } from "./lib/wake-word";
import type { Approval, JobEvent, WallCard, WallState } from "./types";

const samplePrompts = [
  { label: "Prepare today’s production board", prompt: "Prepare today’s production board", icon: "board", tone: "orange" },
  { label: "Render the latest Blender scene", prompt: "Render the latest Blender scene", icon: "render", tone: "violet" },
  { label: "Turn notes into a presentation", prompt: "Turn the concept notes into a presentation", icon: "slides", tone: "green" }
];

export function App() {
  if (window.location.pathname === "/controller") return <Controller />;
  const [state, setState] = useState<WallState>("idle");
  const [jobId, setJobId] = useState<string>();
  const [message, setMessage] = useState("Think out loud.");
  const [transcript, setTranscript] = useState("");
  const [card, setCard] = useState<WallCard>();
  const [approval, setApproval] = useState<Approval>();
  const [screenshot, setScreenshot] = useState<string>();
  const [prompt, setPrompt] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("disconnected");
  const [listening, setListening] = useState(false);
  const [showType, setShowType] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(() => localStorage.getItem("radian-wake-word") === "true");
  const [wakeStatus, setWakeStatus] = useState<"off" | "ready" | "unsupported" | "error">("off");
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("radian-theme") as "dark" | "light") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  const eventSource = useRef<EventSource | undefined>(undefined);
  const realtime = useRef<RealtimeClient | undefined>(undefined);
  const wakeWord = useRef<WakeWordListener | undefined>(undefined);
  const beginListeningRef = useRef<() => Promise<void>>(async () => {});

  const startTask = async (taskPrompt: string) => {
    if (!taskPrompt.trim()) return "No task was supplied.";
    eventSource.current?.close();
    setPrompt("");
    setTranscript(taskPrompt);
    setCard(undefined);
    setApproval(undefined);
    setScreenshot(undefined);
    setState("planning");
    setMessage("Getting things ready");
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
    if (event.message) setMessage(event.type === "error" ? friendlyError(event.message) : event.message);
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
      onError: (error) => { console.error(error); setMessage(friendlyError(error)); setState("error"); }
    });
    realtime.current = client;
    const wake = new WakeWordListener(
      () => beginListeningRef.current(),
      setWakeStatus
    );
    wakeWord.current = wake;
    return () => { wake.stop(); client.disconnect(); eventSource.current?.close(); };
  }, []);

  useEffect(() => {
    localStorage.setItem("radian-wake-word", String(wakeEnabled));
    if (wakeEnabled && !listening) wakeWord.current?.start();
    else { wakeWord.current?.stop(); setWakeStatus(wakeEnabled ? "off" : "off"); }
  }, [wakeEnabled, listening]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("radian-theme", theme);
  }, [theme]);

  const clock = useClock();
  const activityLabel = useMemo(() => state === "idle" ? "RADIAN" : state.toUpperCase(), [state]);

  const beginListening = async () => {
    wakeWord.current?.stop();
    setState("listening");
    setMessage("Opening the microphone…");
    if (voiceStatus === "disconnected" || voiceStatus === "error") {
      const connected = await realtime.current?.connect();
      if (!connected) { setListening(false); return; }
    }
    setListening(true);
    realtime.current?.setListening(true);
    setState("listening");
    setMessage("I’m listening");
    setTranscript("");
  };
  beginListeningRef.current = beginListening;

  const toggleListening = async () => {
    if (!listening) return beginListening();
    setListening(false);
    realtime.current?.setListening(false);
    setState("idle");
    setMessage("Think out loud.");
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
        <div className="brand"><span className="brand-mark" />{activityLabel}<span className="studio-name">PRODUCTION STUDIO</span></div>
        <div className="system-status">
          {mockMode && <span className="mode-pill">PREVIEW</span>}
          <span className={`dot ${wakeStatus === "ready" ? "connected" : wakeStatus === "error" || wakeStatus === "unsupported" ? "error" : voiceStatus}`} /> {wakeStatus === "ready" ? "Say “Hello Radian”" : wakeStatus === "unsupported" ? "Wake word needs Chrome or Edge" : wakeStatus === "error" ? "Microphone permission needed" : voiceStatus === "connected" ? "Listening is available" : "Studio is ready"}
        </div>
        <div className="header-actions"><button className={`theme-toggle wake-toggle ${wakeEnabled ? "active" : ""} ${wakeStatus === "error" || wakeStatus === "unsupported" ? "error" : ""}`} onClick={() => setWakeEnabled((value) => !value)} aria-pressed={wakeEnabled} aria-label={wakeEnabled ? "Disable Hello Radian wake word" : "Enable Hello Radian wake word"} title={wakeStatus === "unsupported" ? "Wake word is not supported by this browser" : wakeStatus === "error" ? "Check microphone permission" : wakeEnabled ? "Wake word on" : "Enable wake word (microphone permission required)"}><StudioIcon name="waves" /></button><button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Use ${theme === "dark" ? "light" : "dark"} mode`}><StudioIcon name={theme === "dark" ? "sun" : "moon"} /></button><time>{clock}</time></div>
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
          <p className="presence">YOUR STUDIO, IN ONE PLACE</p>
          <h1>{message}</h1>
          {transcript && <p className="transcript">“{transcript}”</p>}
          {!transcript && state === "idle" && <p className="quiet-copy">Speak naturally, or start with a thought below.</p>}
        </div>}
      </section>

      {approval && <div className="approval-backdrop"><section className="approval-card">
        <span className={`risk risk-${approval.risk}`}>{approval.risk} action</span>
        <h2>{approval.title}</h2><p>{approval.description}</p>
        <div><button className="secondary" onClick={() => resolveApproval(false)}>Cancel</button>
        <button className="primary" onClick={() => resolveApproval(true)}>Approve</button></div>
      </section></div>}

      <footer>
        <div className="voice-row">
        <button className={`mic ${listening ? "active" : ""}`} onClick={toggleListening} aria-label="Toggle microphone">
          <span className="voice-icon"><StudioIcon name="mic" /></span><span><strong>{listening ? "I’m listening" : "Speak"}</strong><small>{listening ? "Tap when you’re finished" : "Start with your voice"}</small></span>
        </button>
        <button className={`type-toggle ${showType ? "active" : ""}`} onClick={() => setShowType((value) => !value)} aria-expanded={showType} aria-label="Type instead"><StudioIcon name="keyboard" /><span>Type instead</span></button>
        </div>
        {showType && <form className="type-form" onSubmit={(event) => { event.preventDefault(); startTask(prompt).catch((e) => { setMessage(e.message); setState("error"); }); }}>
          <input autoFocus value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe what you’d like to make…" />
          <button className="send" aria-label="Submit">↗</button>
        </form>}
        <div className="suggestions">{samplePrompts.map((item) => <button className={`suggestion tone-${item.tone}`} key={item.label} onClick={() => startTask(item.prompt)}><StudioIcon name={item.icon} /><span>{item.label}</span><span className="suggestion-arrow">↗</span></button>)}</div>
      </footer>
    </main>
  );
}

function friendlyError(message: string): string {
  if (/invalid schema|invalid_function_parameters/i.test(message)) return "A studio tool needs an update.";
  if (/microphone|permission|notallowederror/i.test(message)) return "Microphone access is needed. Check your browser permissions and try again.";
  if (/model|access|permission/i.test(message)) return "This OpenAI project may not have access to the selected voice or workspace model.";
  return "Something needs attention. Check the server log for details.";
}

function StudioIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    board: <><path d="M4 5.5h16v11H4z"/><path d="M8 20h8M12 16.5V20M7 9h4M7 12.5h7"/></>,
    render: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12.1V21"/></>,
    slides: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 8h6M7 11h10"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
    moon: <path d="M20 15.4A8 8 0 0 1 8.6 4a8 8 0 1 0 11.4 11.4Z"/>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></>,
    keyboard: <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M7 13.5h.01M10.5 13.5h.01M14 13.5h3.5M8 16h8"/></>,
    waves: <><path d="M8.5 8.5a5 5 0 0 0 0 7M5.5 5.5a9.2 9.2 0 0 0 0 13M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.2 9.2 0 0 1 0 13"/><circle cx="12" cy="12" r="2"/></>
  };
  return <svg className="studio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Controller() {
  const [token, setToken] = useState(() => sessionStorage.getItem("radian-controller-token") ?? "");
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [error, setError] = useState("");
  const refresh = async () => {
    if (!token) return;
    try { setItems(await fetchApprovals(token)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Controller unavailable"); }
  };
  useEffect(() => {
    if (!token) return;
    sessionStorage.setItem("radian-controller-token", token);
    refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => window.clearInterval(timer);
  }, [token]);
  const decide = async (item: PendingApproval, approved: boolean) => {
    await resolveControllerApproval(token, item, approved);
    await refresh();
  };
  return <main className="controller">
    <header><div className="brand"><span className="brand-mark" />RADIAN CONTROLLER</div></header>
    <section>
      {!token && <form onSubmit={(event) => { event.preventDefault(); setToken(new FormData(event.currentTarget).get("token") as string); }}>
        <input name="token" type="password" minLength={24} placeholder="Controller token" required />
        <button className="primary">Connect</button>
      </form>}
      {error && <p className="controller-error">{error}</p>}
      {token && !items.length && !error && <div className="controller-empty"><h1>No pending approvals</h1><p>Keep this page open. New studio actions will appear here.</p></div>}
      {items.map((item) => <article className="approval-card" key={item.approval.id}>
        <span className={`risk risk-${item.approval.risk}`}>{item.approval.risk} action</span>
        <h2>{item.approval.title}</h2><p>{item.approval.description}</p><small>Task: {item.prompt}</small>
        <div><button className="secondary" onClick={() => decide(item, false)}>Reject</button><button className="primary" onClick={() => decide(item, true)}>Approve</button></div>
      </article>)}
    </section>
  </main>;
}

function useClock() {
  const format = () => new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit" }).format(new Date());
  const [value, setValue] = useState(format);
  useEffect(() => { const timer = window.setInterval(() => setValue(format()), 10_000); return () => clearInterval(timer); }, []);
  return value;
}
