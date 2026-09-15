import { useState } from "react";

type Stage = "detect" | "prove" | "trace" | "fix";
type FindingStatus =
  | "DETECTED"
  | "VERIFICATION_PENDING"
  | "LIVE"
  | "INVALID"
  | "UNKNOWN"
  | "BLOCKED"
  | "REMEDIATION_AVAILABLE"
  | "REMEDIATED"
  | "RESOLVED";

interface Finding {
  id: string;
  type: string;
  provider: string;
  file: string;
  line: number;
  redacted: string;
  signalScore: number;
  status: FindingStatus;
  signals: { label: string; points: number }[];
  verificationResult: "LIVE" | "INVALID" | "UNKNOWN" | "NOT_SUPPORTED";
  blastRadius: {
    currentFiles: number;
    historicalCommits: number;
    affectedPaths: string[];
    firstSeen: string;
    lastSeen: string;
  };
  remediationLanguage: string;
  before: string;
  after: string;
}

const FINDINGS: Finding[] = [
  {
    id: "f1",
    type: "GitHub Personal Access Token",
    provider: "GitHub",
    file: "config/prod.env",
    line: 14,
    redacted: "ghp_****************************Xk9R",
    signalScore: 96,
    status: "LIVE",
    signals: [
      { label: "Pattern match (ghp_ prefix)", points: 25 },
      { label: "Known credential format", points: 30 },
      { label: "High entropy (4.82 bits/char)", points: 20 },
      { label: "Production context (prod.env)", points: 15 },
      { label: "Sensitive filename", points: 10 },
      { label: 'Contains "example" keyword', points: -4 },
    ],
    verificationResult: "LIVE",
    blastRadius: {
      currentFiles: 3,
      historicalCommits: 8,
      affectedPaths: [
        "config/prod.env",
        "backend/config.py",
        "deployment/secrets.yaml",
        "scripts/deploy.sh",
      ],
      firstSeen: "2024-09-03T11:22:00Z",
      lastSeen: "2024-11-14T09:05:00Z",
    },
    remediationLanguage: "Python",
    before: `GITHUB_TOKEN = "ghp_****************************Xk9R"`,
    after: `import os\nGITHUB_TOKEN = os.getenv("GITHUB_TOKEN")`,
  },
  {
    id: "f2",
    type: "AWS Access Key ID",
    provider: "AWS",
    file: "src/services/s3.ts",
    line: 7,
    redacted: "AKIA****EXAMPLE****FAKE",
    signalScore: 84,
    status: "UNKNOWN",
    signals: [
      { label: "Pattern match (AKIA prefix)", points: 25 },
      { label: "Known credential format", points: 30 },
      { label: "High entropy (4.61 bits/char)", points: 20 },
      { label: "Source code file (.ts)", points: 9 },
      { label: 'Contains "EXAMPLE" marker', points: -16 },
      { label: 'Variable name: accessKeyId', points: 16 },
    ],
    verificationResult: "UNKNOWN",
    blastRadius: {
      currentFiles: 1,
      historicalCommits: 2,
      affectedPaths: ["src/services/s3.ts"],
      firstSeen: "2024-10-18T14:30:00Z",
      lastSeen: "2024-11-12T08:45:00Z",
    },
    remediationLanguage: "TypeScript",
    before: `const client = new S3Client({\n  accessKeyId: "AKIA****EXAMPLE****FAKE",\n  secretAccessKey: process.env.AWS_SECRET\n});`,
    after: `const client = new S3Client({\n  accessKeyId: process.env.AWS_ACCESS_KEY_ID,\n  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY\n});`,
  },
  {
    id: "f3",
    type: "Stripe Secret Key",
    provider: "Stripe",
    file: "backend/payments/stripe_client.py",
    line: 3,
    redacted: "sk_live_**********************9mPq",
    signalScore: 72,
    status: "REMEDIATION_AVAILABLE",
    signals: [
      { label: "Pattern match (sk_live_ prefix)", points: 25 },
      { label: "Known credential format", points: 30 },
      { label: "High entropy (4.44 bits/char)", points: 17 },
      { label: "Production indicator (sk_live_)", points: 15 },
      { label: "Historical commit (deleted)", points: -15 },
    ],
    verificationResult: "NOT_SUPPORTED",
    blastRadius: {
      currentFiles: 0,
      historicalCommits: 5,
      affectedPaths: ["backend/payments/stripe_client.py"],
      firstSeen: "2024-07-22T10:00:00Z",
      lastSeen: "2024-10-30T16:20:00Z",
    },
    remediationLanguage: "Python",
    before: `import stripe\nstripe.api_key = "sk_live_**********************9mPq"`,
    after: `import stripe, os\nstripe.api_key = os.getenv("STRIPE_SECRET_KEY")`,
  },
  {
    id: "f4",
    type: "Generic API Key",
    provider: "Unknown",
    file: "tests/fixtures/mock_data.json",
    line: 22,
    redacted: "api_test_****dummy****placeholder",
    signalScore: 18,
    status: "DETECTED",
    signals: [
      { label: "Pattern match (api_ prefix)", points: 12 },
      { label: "Low entropy (2.1 bits/char)", points: 4 },
      { label: 'Contains "test" indicator', points: -10 },
      { label: 'Contains "dummy" indicator', points: -10 },
      { label: 'Contains "placeholder" indicator', points: -10 },
      { label: "Test fixture file path", points: -12 },
      { label: "Mock data context", points: -12 },
    ],
    verificationResult: "NOT_SUPPORTED",
    blastRadius: {
      currentFiles: 1,
      historicalCommits: 0,
      affectedPaths: ["tests/fixtures/mock_data.json"],
      firstSeen: "2024-11-01T09:00:00Z",
      lastSeen: "2024-11-01T09:00:00Z",
    },
    remediationLanguage: "JSON",
    before: `{ "api_key": "api_test_****dummy****placeholder" }`,
    after: `{ "api_key": "{{API_KEY_PLACEHOLDER}}" }`,
  },
];

const STATUS_META: Record<
  FindingStatus,
  { label: string; color: string; bg: string }
> = {
  DETECTED: { label: "DETECTED", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
  VERIFICATION_PENDING: { label: "VERIFYING…", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  LIVE: { label: "LIVE", color: "#ff3b5c", bg: "rgba(255,59,92,0.12)" },
  INVALID: { label: "INVALID", color: "#00ff88", bg: "rgba(0,255,136,0.08)" },
  UNKNOWN: { label: "UNKNOWN", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  BLOCKED: { label: "BLOCKED", color: "#818cf8", bg: "rgba(129,140,248,0.1)" },
  REMEDIATION_AVAILABLE: { label: "FIXABLE", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  REMEDIATED: { label: "REMEDIATED", color: "#00ff88", bg: "rgba(0,255,136,0.08)" },
  RESOLVED: { label: "RESOLVED", color: "#00ff88", bg: "rgba(0,255,136,0.08)" },
};

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color =
    score >= 80 ? "#ff3b5c" : score >= 50 ? "#f59e0b" : "#00ff88";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1e2035" strokeWidth="4" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={circ - fill}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="text-center" style={{ fontFamily: "var(--font-mono)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>SIGNAL</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: FindingStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.5,
        padding: "3px 8px",
        borderRadius: 2,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.color}22`,
      }}
    >
      {meta.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(13,32,39,0.9)",
        border: "1px solid #1c3b42",
        borderRadius: 6,
        padding: "18px 20px",
        boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
      }}
    >
      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 8 }}>
        {label}
      </div>
      <div
        className="mono"
        style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

function StageNav({
  current,
  onChange,
  finding,
}: {
  current: Stage;
  onChange: (s: Stage) => void;
  finding: Finding;
}) {
  const stages: { id: Stage; label: string; num: string }[] = [
    { id: "detect", label: "DETECT", num: "01" },
    { id: "prove", label: "PROVE", num: "02" },
    { id: "trace", label: "TRACE", num: "03" },
    { id: "fix", label: "FIX", num: "04" },
  ];

  const stageIndex = stages.findIndex((s) => s.id === current);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {stages.map((s, i) => {
        const active = s.id === current;
        const done = i < stageIndex;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={() => onChange(s.id)}
              className="mono"
              style={{
                background: active ? "#00ff88" : done ? "rgba(0,255,136,0.08)" : "#0f0f1a",
                color: active ? "#08080e" : done ? "#00ff88" : "#475569",
                border: `1px solid ${active ? "#00ff88" : done ? "rgba(0,255,136,0.3)" : "#1e2035"}`,
                borderRadius: 2,
                padding: "6px 14px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <span style={{ opacity: 0.5, marginRight: 6 }}>{s.num}</span>
              {s.label}
            </button>
            {i < stages.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 1,
                  background: done ? "#00ff88" : "#1e2035",
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetectPanel({ finding }: { finding: Finding }) {
  const positive = finding.signals.filter((s) => s.points > 0);
  const negative = finding.signals.filter((s) => s.points < 0);
  const total = finding.signals.reduce((sum, s) => sum + s.points, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
            EVIDENCE — POSITIVE SIGNALS
          </div>
          {positive.map((sig) => (
            <div key={sig.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{sig.label}</span>
              <span className="mono" style={{ fontSize: 12, color: "#00ff88", fontWeight: 700 }}>+{sig.points}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
            EVIDENCE — DEDUCTIONS
          </div>
          {negative.length === 0 ? (
            <div style={{ fontSize: 12, color: "#475569" }}>No deductions applied.</div>
          ) : (
            negative.map((sig) => (
              <div key={sig.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{sig.label}</span>
                <span className="mono" style={{ fontSize: 12, color: "#ff3b5c", fontWeight: 700 }}>{sig.points}</span>
              </div>
            ))
          )}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e2035", display: "flex", justifyContent: "space-between" }}>
            <span className="mono" style={{ fontSize: 10, color: "#475569" }}>NET SCORE</span>
            <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: total >= 80 ? "#ff3b5c" : total >= 50 ? "#f59e0b" : "#00ff88" }}>
              {total}/100
            </span>
          </div>
        </div>
      </div>

      <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
          CANDIDATE LOCATION
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "#475569" }}>FILE</div>
            <div className="mono" style={{ fontSize: 13, color: "#e2e8f0", marginTop: 2 }}>{finding.file}</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "#475569" }}>LINE</div>
            <div className="mono" style={{ fontSize: 13, color: "#e2e8f0", marginTop: 2 }}>{finding.line}</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "#475569" }}>REDACTED VALUE</div>
            <div className="mono" style={{ fontSize: 13, color: "#f59e0b", marginTop: 2 }}>{finding.redacted}</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "#475569" }}>TYPE</div>
            <div className="mono" style={{ fontSize: 13, color: "#e2e8f0", marginTop: 2 }}>{finding.type}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProvePanel({ finding }: { finding: Finding }) {
  const vr = finding.verificationResult;
  const vrColor =
    vr === "LIVE" ? "#ff3b5c" : vr === "INVALID" ? "#00ff88" : vr === "UNKNOWN" ? "#f59e0b" : "#475569";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#0a0a14", border: `1px solid ${vrColor}33`, borderRadius: 4, padding: 24, display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: `${vrColor}18`,
            border: `2px solid ${vrColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 22 }}>
            {vr === "LIVE" ? "⚠" : vr === "INVALID" ? "✓" : vr === "UNKNOWN" ? "?" : "—"}
          </span>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 6 }}>
            VERIFICATION RESULT — {finding.provider.toUpperCase()} VERIFIER
          </div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: vrColor }}>{vr}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
            {vr === "LIVE" && "Provider API confirmed this credential is active and has scope."}
            {vr === "INVALID" && "Provider API rejected this credential. Likely rotated or expired."}
            {vr === "UNKNOWN" && "No provider verifier available. Credential could not be validated."}
            {vr === "NOT_SUPPORTED" && "This provider has no automated verifier. Manual review required."}
          </div>
        </div>
      </div>

      <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
          VERIFIER ARCHITECTURE
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["GitHub Verifier", "AWS Verifier", "Generic / Unknown Verifier"].map((v) => {
            const active =
              (v.startsWith("GitHub") && finding.provider === "GitHub") ||
              (v.startsWith("AWS") && finding.provider === "AWS") ||
              (v.startsWith("Generic") && !["GitHub", "AWS"].includes(finding.provider));
            return (
              <div
                key={v}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: active ? "rgba(0,255,136,0.05)" : "transparent",
                  border: `1px solid ${active ? "rgba(0,255,136,0.2)" : "#1e2035"}`,
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: active ? "#00ff88" : "#1e2035",
                  }}
                />
                <span className="mono" style={{ fontSize: 12, color: active ? "#e2e8f0" : "#475569" }}>
                  {v}
                </span>
                {active && (
                  <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "#00ff88" }}>
                    ACTIVE
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 8 }}>
          SAFETY NOTES
        </div>
        <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <li style={{ fontSize: 12, color: "#64748b" }}>Verification is opt-in and runs only on high-confidence candidates (score ≥ 70).</li>
          <li style={{ fontSize: 12, color: "#64748b" }}>Raw credential values are never stored — only a fingerprint.</li>
          <li style={{ fontSize: 12, color: "#64748b" }}>The scanner operates fully without external API access.</li>
        </ul>
      </div>
    </div>
  );
}

function TracePanel({ finding }: { finding: Finding }) {
  const br = finding.blastRadius;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: "#0a0a14",
          border: "1px solid #ff3b5c44",
          borderRadius: 4,
          padding: 20,
        }}
      >
        <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 16 }}>
          BLAST RADIUS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
          {[
            { label: "CURRENT FILES", value: br.currentFiles, color: "#ff3b5c" },
            { label: "HISTORICAL COMMITS", value: br.historicalCommits, color: "#f59e0b" },
            { label: "AFFECTED PATHS", value: br.affectedPaths.length, color: "#818cf8" },
          ].map((m) => (
            <div key={m.label} style={{ textAlign: "center" }}>
              <div
                className="mono"
                style={{ fontSize: 36, fontWeight: 700, color: m.color, lineHeight: 1 }}
              >
                {m.value}
              </div>
              <div className="mono" style={{ fontSize: 9, color: "#475569", letterSpacing: 1.5, marginTop: 6 }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid #1e2035", paddingTop: 16 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 10 }}>
            CURRENT OCCURRENCES
          </div>
          {br.affectedPaths.slice(0, br.currentFiles).map((p) => (
            <div
              key={p}
              className="mono"
              style={{
                fontSize: 12,
                color: "#ff3b5c",
                padding: "4px 8px",
                background: "rgba(255,59,92,0.05)",
                marginBottom: 4,
                borderRadius: 2,
                border: "1px solid rgba(255,59,92,0.12)",
              }}
            >
              {p}
            </div>
          ))}
          {br.currentFiles === 0 && (
            <div style={{ fontSize: 12, color: "#475569" }}>No current file occurrences (historical only).</div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #1e2035", paddingTop: 16, marginTop: 12 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 10 }}>
            HISTORICAL EXPOSURE
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            <div>
              <div className="mono" style={{ fontSize: 10, color: "#475569" }}>FIRST SEEN</div>
              <div className="mono" style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>
                {new Date(br.firstSeen).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 10, color: "#475569" }}>LAST SEEN</div>
              <div className="mono" style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>
                {new Date(br.lastSeen).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 10, color: "#475569" }}>COMMITS EXPOSED</div>
              <div className="mono" style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>{br.historicalCommits} commits</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 8 }}>
          SEARCH SCOPE
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["Current repository files", "Staged files (pre-commit)", "Full git history", "Deleted / previous versions"].map((scope) => (
            <div key={scope} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#00ff88", fontSize: 12 }}>✓</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>{scope}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FixPanel({ finding, onRemediate }: { finding: Finding; onRemediate: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    "View Evidence",
    "View Blast Radius",
    "Choose Fix",
    "Apply Safe Fix",
    "Generate .env.example",
    "Suggest .gitignore",
    "Recommend Rotation",
    "Rescan",
    "Resolved",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, alignItems: "start" }}>
        <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
            REMEDIATION WORKFLOW
          </div>
          {steps.map((s, i) => (
            <div
              key={s}
              onClick={() => setStep(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                cursor: "pointer",
                background: step === i ? "rgba(0,255,136,0.05)" : "transparent",
                borderRadius: 2,
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: `1px solid ${i < step ? "#00ff88" : i === step ? "#00ff88" : "#1e2035"}`,
                  background: i < step ? "#00ff88" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {i < step && <span style={{ fontSize: 9, color: "#08080e", fontWeight: 700 }}>✓</span>}
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: i === step ? "#e2e8f0" : i < step ? "#00ff88" : "#475569",
                }}
              >
                {s}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {step === 2 || step === 3 ? (
            <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
                BEFORE
              </div>
              <pre
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "#ff3b5c",
                  background: "rgba(255,59,92,0.05)",
                  border: "1px solid rgba(255,59,92,0.15)",
                  borderRadius: 2,
                  padding: 12,
                  margin: "0 0 12px",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {finding.before}
              </pre>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 8 }}>
                AFTER ({finding.remediationLanguage})
              </div>
              <pre
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "#00ff88",
                  background: "rgba(0,255,136,0.05)",
                  border: "1px solid rgba(0,255,136,0.15)",
                  borderRadius: 2,
                  padding: 12,
                  margin: 0,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {finding.after}
              </pre>
            </div>
          ) : step === 4 ? (
            <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
                GENERATED .env.example
              </div>
              <pre
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "#94a3b8",
                  background: "#0f0f1a",
                  border: "1px solid #1e2035",
                  borderRadius: 2,
                  padding: 12,
                  margin: 0,
                }}
              >
                {`# Secret Scanner — generated .env.example\n# Do NOT commit real values\n\n${finding.type
                  .toUpperCase()
                  .replace(/\s+/g, "_")}=your_${finding.provider.toLowerCase()}_key_here`}
              </pre>
            </div>
          ) : step === 5 ? (
            <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
                .gitignore SUGGESTION
              </div>
              <pre
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "#94a3b8",
                  background: "#0f0f1a",
                  border: "1px solid #1e2035",
                  borderRadius: 2,
                  padding: 12,
                  margin: 0,
                }}
              >
                {`# Secrets — add these patterns\n.env\n.env.local\n.env.production\n*.secret\n*.pem\nconfig/prod.env`}
              </pre>
            </div>
          ) : step === 6 ? (
            <div style={{ background: "#0a0a14", border: "1px solid #ff3b5c33", borderRadius: 4, padding: 16 }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
                ROTATION RECOMMENDATION
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: "#ff3b5c" }}>⚠</span>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>
                    Rotate this credential immediately — treat it as compromised.
                  </span>
                </div>
                {finding.provider !== "Unknown" && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#00ff88" }}>→</span>
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>
                      Visit {finding.provider} console → Settings → API Keys → Revoke & regenerate.
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: "#00ff88" }}>→</span>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>
                    Audit {finding.provider} audit log for unauthorized access since{" "}
                    {new Date(finding.blastRadius.firstSeen).toLocaleDateString()}.
                  </span>
                </div>
              </div>
            </div>
          ) : step === 7 ? (
            <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16, textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 16 }}>
                RESCAN
              </div>
              <button
                onClick={() => setStep(8)}
                style={{
                  background: "#00ff88",
                  color: "#08080e",
                  border: "none",
                  borderRadius: 2,
                  padding: "10px 24px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1,
                  cursor: "pointer",
                }}
              >
                RUN RESCAN
              </button>
            </div>
          ) : step === 8 ? (
            <div
              style={{
                background: "rgba(0,255,136,0.05)",
                border: "1px solid rgba(0,255,136,0.3)",
                borderRadius: 4,
                padding: 24,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: "#00ff88", marginBottom: 8 }}>
                RESOLVED
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>No occurrences found. Credential successfully remediated.</div>
              <button
                onClick={onRemediate}
                style={{
                  marginTop: 16,
                  background: "transparent",
                  color: "#00ff88",
                  border: "1px solid rgba(0,255,136,0.3)",
                  borderRadius: 2,
                  padding: "8px 20px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  cursor: "pointer",
                }}
              >
                MARK RESOLVED
              </button>
            </div>
          ) : (
            <div style={{ background: "#0a0a14", border: "1px solid #1e2035", borderRadius: 4, padding: 16 }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
                STEP {step + 1} — {steps[step].toUpperCase()}
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Review the finding evidence, blast radius, and verification status before proceeding.
              </div>
              <button
                onClick={() => setStep((s) => s + 1)}
                style={{
                  marginTop: 16,
                  background: "transparent",
                  color: "#00ff88",
                  border: "1px solid rgba(0,255,136,0.3)",
                  borderRadius: 2,
                  padding: "8px 20px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  cursor: "pointer",
                }}
              >
                NEXT →
              </button>
            </div>
          )}

          {step >= 2 && step <= 7 && (
            <button
              onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}
              style={{
                background: "transparent",
                color: "#475569",
                border: "1px solid #1e2035",
                borderRadius: 2,
                padding: "8px 16px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: 1,
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              NEXT STEP →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FindingDetail({
  finding,
  onBack,
  onStatusChange,
}: {
  finding: Finding;
  onBack: () => void;
  onStatusChange: (id: string, status: FindingStatus) => void;
}) {
  const [stage, setStage] = useState<Stage>("detect");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button
          onClick={onBack}
          className="mono"
          style={{
            background: "transparent",
            color: "#475569",
            border: "1px solid #1e2035",
            borderRadius: 2,
            padding: "6px 12px",
            fontSize: 10,
            cursor: "pointer",
            letterSpacing: 1,
          }}
        >
          ← BACK
        </button>
        <div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569" }}>FINDING</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#e2e8f0" }}>{finding.type}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <ScoreRing score={finding.signalScore} />
          <StatusBadge status={finding.status} />
        </div>
      </div>

      <StageNav current={stage} onChange={setStage} finding={finding} />

      <div>
        {stage === "detect" && <DetectPanel finding={finding} />}
        {stage === "prove" && <ProvePanel finding={finding} />}
        {stage === "trace" && <TracePanel finding={finding} />}
        {stage === "fix" && (
          <FixPanel
            finding={finding}
            onRemediate={() => onStatusChange(finding.id, "RESOLVED")}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [findings, setFindings] = useState<Finding[]>(FINDINGS);
  const [selected, setSelected] = useState<string | null>(null);

  const selectedFinding = findings.find((f) => f.id === selected) ?? null;

  const live = findings.filter((f) => f.verificationResult === "LIVE").length;
  const open = findings.filter((f) => !["RESOLVED", "REMEDIATED"].includes(f.status)).length;
  const resolved = findings.filter((f) => ["RESOLVED", "REMEDIATED"].includes(f.status)).length;
  const critical = findings.filter((f) => f.signalScore >= 80).length;

  const handleStatusChange = (id: string, status: FindingStatus) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
    setSelected(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "transparent",
        color: "#e2e8f0",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid #1e2035",
          padding: "0 32px",
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 24,
          position: "sticky",
          top: 0,
          background: "rgba(7,21,27,0.9)",
          backdropFilter: "blur(14px)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 2,
              background: "#ff8066",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 12 }}>⚡</span>
          </div>
          <span
            className="mono"
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "#f1faf7" }}
          >
            SECRETSCOPE
          </span>
        </div>

        <div style={{ width: 1, height: 20, background: "#1e2035" }} />

        <nav style={{ display: "flex", gap: 0 }}>
          {["Dashboard", "Pre-commit Hook", "History", "Settings"].map((item, i) => (
            <button
              key={item}
              className="mono"
              style={{
                background: "transparent",
                color: i === 0 ? "#f1faf7" : "#6b8b91",
                border: "none",
                padding: "0 14px",
                fontSize: 11,
                letterSpacing: 1,
                cursor: "pointer",
                height: 56,
                borderBottom: i === 0 ? "2px solid #79e6c0" : "2px solid transparent",
              }}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88" }} />
            <span className="mono" style={{ fontSize: 10, color: "#475569", letterSpacing: 1 }}>
              DEMO MODE
            </span>
          </div>
        </div>
      </header>

      <main style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>
        {selectedFinding ? (
          <FindingDetail
            finding={selectedFinding}
            onBack={() => setSelected(null)}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <>
            {/* Page title */}
            <div style={{ marginBottom: 28 }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 3, color: "#79a7a3", marginBottom: 6 }}>
                SECRET SCANNER — DETECT → PROVE → TRACE → FIX
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#f1faf7",
                  letterSpacing: -0.5,
                }}
              >
                Exposure Dashboard
              </h1>
            </div>

            {/* Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 28,
              }}
            >
              <StatCard label="SECRETS AT RISK" value={open} color="#ff8066" sub="Unresolved findings" />
              <StatCard label="CONFIRMED LIVE" value={live} color="#ff8066" sub="Provider-verified" />
              <StatCard label="BLOCKED COMMITS" value={2} color="#818cf8" sub="Pre-commit hook" />
              <StatCard label="OPEN EXPOSURES" value={open} color="#f59e0b" sub="Across all branches" />
              <StatCard label="REMEDIATED" value={resolved} color="#79e6c0" sub="Closed findings" />
              <StatCard label="COMPLIANCE" value={resolved === 0 ? "FAIL" : "PASS"} color={resolved > 0 ? "#79e6c0" : "#ff8066"} sub="Policy gate" />
            </div>

            {/* Critical exposure callout */}
            {findings.some((f) => f.status === "LIVE") && (
              <div
                style={{
                  background: "rgba(255,59,92,0.06)",
                  border: "1px solid rgba(255,59,92,0.3)",
                  borderRadius: 4,
                  padding: "16px 20px",
                  marginBottom: 24,
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#ff3b5c",
                    flexShrink: 0,
                    boxShadow: "0 0 0 4px rgba(255,59,92,0.2)",
                    animation: "pulse-ring 1.5s ease-out infinite",
                  }}
                />
                <div>
                  <div className="mono" style={{ fontSize: 10, color: "#ff3b5c", letterSpacing: 1.5, marginBottom: 2 }}>
                    CRITICAL EXPOSURE
                  </div>
                  <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 500 }}>
                    {findings.find((f) => f.status === "LIVE")?.type} — Signal Score{" "}
                    <span className="mono" style={{ color: "#ff3b5c" }}>
                      {findings.find((f) => f.status === "LIVE")?.signalScore}/100
                    </span>
                    {" · "}
                    <span className="mono" style={{ color: "#ff3b5c", fontSize: 11 }}>LIVE</span>
                    {" · "}
                    Current Files:{" "}
                    <span className="mono" style={{ color: "#f59e0b" }}>
                      {findings.find((f) => f.status === "LIVE")?.blastRadius.currentFiles}
                    </span>
                    {" · "}
                    Historical Commits:{" "}
                    <span className="mono" style={{ color: "#f59e0b" }}>
                      {findings.find((f) => f.status === "LIVE")?.blastRadius.historicalCommits}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(findings.find((f) => f.status === "LIVE")?.id ?? null)}
                  className="mono"
                  style={{
                    marginLeft: "auto",
                    background: "#ff3b5c",
                    color: "#fff",
                    border: "none",
                    borderRadius: 2,
                    padding: "8px 16px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    cursor: "pointer",
                  }}
                >
                  INVESTIGATE →
                </button>
              </div>
            )}

            {/* Findings list */}
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: "#475569" }}>
                ALL FINDINGS — {findings.length} TOTAL
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: "#475569" }}>
                SORTED BY SIGNAL SCORE ↓
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...findings]
                .sort((a, b) => b.signalScore - a.signalScore)
                .map((f) => {
                  const meta = STATUS_META[f.status];
                  const isResolved = ["RESOLVED", "REMEDIATED"].includes(f.status);
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelected(f.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 20,
                        background: "#0f0f1a",
                        border: `1px solid ${f.status === "LIVE" ? "rgba(255,59,92,0.3)" : "#1e2035"}`,
                        borderRadius: 4,
                        padding: "16px 20px",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                        transition: "border-color 0.15s, background 0.15s",
                        opacity: isResolved ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "#12121f";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = f.status === "LIVE" ? "rgba(255,59,92,0.5)" : "#2a2a45";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "#0f0f1a";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = f.status === "LIVE" ? "rgba(255,59,92,0.3)" : "#1e2035";
                      }}
                    >
                      <ScoreRing score={f.signalScore} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{f.type}</span>
                          <StatusBadge status={f.status} />
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: "#f59e0b", marginBottom: 2 }}>
                          {f.redacted}
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: "#475569" }}>
                          {f.file}:{f.line}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 32, flexShrink: 0 }}>
                        <div style={{ textAlign: "center" }}>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "#ff3b5c", lineHeight: 1 }}>
                            {f.blastRadius.currentFiles}
                          </div>
                          <div className="mono" style={{ fontSize: 9, color: "#475569", letterSpacing: 1, marginTop: 2 }}>
                            FILES
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", lineHeight: 1 }}>
                            {f.blastRadius.historicalCommits}
                          </div>
                          <div className="mono" style={{ fontSize: 9, color: "#475569", letterSpacing: 1, marginTop: 2 }}>
                            COMMITS
                          </div>
                        </div>
                      </div>

                      <div className="mono" style={{ fontSize: 12, color: "#475569", flexShrink: 0 }}>
                        →
                      </div>
                    </button>
                  );
                })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
