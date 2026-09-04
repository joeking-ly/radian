export type WallState = "idle" | "listening" | "planning" | "working" | "approval" | "presenting" | "error";

export type WallCard = {
  title: string;
  eyebrow?: string;
  body: string;
  bullets?: string[];
  sourceUrl?: string;
};

export type Approval = {
  id: string;
  title: string;
  description: string;
  risk: "modify" | "communicate" | "financial" | "destructive";
};

export type JobEvent = {
  id: string;
  jobId: string;
  type: "status" | "transcript" | "card" | "browser" | "approval" | "complete" | "error";
  state?: WallState;
  message?: string;
  card?: WallCard;
  approval?: Approval;
  screenshotUrl?: string;
  createdAt: string;
};

export type Job = {
  id: string;
  prompt: string;
  state: WallState;
  events: JobEvent[];
  listeners: Set<(event: JobEvent) => void>;
  approval?: Approval;
  approvalResolver?: (approved: boolean) => void;
};
