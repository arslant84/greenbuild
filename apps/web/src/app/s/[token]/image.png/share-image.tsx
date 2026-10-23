import type { ReactNode } from "react";
import type { ShareView } from "../share-view";

// The app's colour tokens (globals.css); satori takes inline styles only, so they are spelled out here.
const COLOR = {
  canvas: "#0e0e0f",
  surface: "#1c1b1c",
  raised: "#201f20",
  control: "#2a2a2b",
  line: "#353436",
  border: "#3c494c",
  ink: "#e5e2e3",
  muted: "#bbc9cd",
  subtle: "#859397",
  accent: "#22d3ee",
  ok: "#64f88a",
  warn: "#ffc640",
  danger: "#ffb4ab",
};
const MONO = "JetBrains Mono";
const SANS = "Inter";
const LABEL = { fontFamily: MONO, fontSize: 13, letterSpacing: 2.5, textTransform: "uppercase" as const, color: COLOR.subtle };

// Stitch "Hotfix — Share Card Image (1200×630)" (task 51; owner, 2026-10-23: missing frames come from
// Stitch), drawn by next/og: the debrief's proof card as a link preview. Checks: passed first, then failed.
export function ShareImage({ view, passed, used }: { view: ShareView; passed: number; used: number }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", padding: 28, background: COLOR.canvas, fontFamily: SANS }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "30px 40px",
          borderRadius: 24,
          border: `1px solid ${COLOR.line}`,
          background: `radial-gradient(circle at 100% 0%, rgba(34,211,238,0.12), ${COLOR.surface} 45%)`,
        }}
      >
        <Header />
        <Player view={view} />
        <span style={{ ...LABEL, marginTop: 22 }}>Incident scenario</span>
        <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1.2, color: "#ffffff", marginTop: 4 }}>{view.title}</span>
        <div style={{ display: "flex", gap: 20, marginTop: 22 }}>
          <Metric label="Reward" value={view.xp} color={COLOR.warn} />
          <Metric label="Verification" value={view.checks} color={COLOR.ink} extra={<Squares passed={passed} used={used} />} />
          <Metric label="Streak" value={view.streak} color={COLOR.ink} />
        </div>
        <Footer skills={view.skills} />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 18, borderBottom: `1px solid ${COLOR.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO }}>
        <span style={{ fontSize: 20, fontWeight: 600, color: COLOR.accent }}>&gt;_ greenbuild</span>
        <span style={{ fontSize: 16, color: COLOR.subtle }}>/</span>
        <span style={{ ...LABEL, fontSize: 15, color: COLOR.muted }}>Proof of incident resolution</span>
      </div>
      <Pill color={COLOR.ok}>AUTHENTIC</Pill>
    </div>
  );
}

function Player({ view }: { view: ShareView }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 14, background: COLOR.control, border: `1px solid ${COLOR.border}`, fontFamily: MONO, fontSize: 22, fontWeight: 600, color: COLOR.accent }}>&gt;_</span>
        <span style={{ fontSize: 30, fontWeight: 600, color: "#ffffff" }}>{view.name}</span>
        {view.handle && <span style={{ fontFamily: MONO, fontSize: 18, color: COLOR.subtle }}>{view.handle}</span>}
      </div>
      <Pill color={COLOR.ok}>{view.solvedIn}</Pill>
    </div>
  );
}

function Metric({ label, value, color, extra }: { label: string; value: string; color: string; extra?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8, padding: "18px 22px", borderRadius: 14, background: COLOR.raised, border: `1px solid ${COLOR.line}` }}>
      <span style={LABEL}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, letterSpacing: -0.6, color }}>{value}</span>
      {extra}
    </div>
  );
}

function Squares({ passed, used }: { passed: number; used: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: used }, (_, check) => (
        <span key={check} style={{ width: 14, height: 14, borderRadius: 3, background: check < passed ? COLOR.ok : COLOR.danger }} />
      ))}
    </div>
  );
}

function Footer({ skills }: { skills: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${COLOR.line}` }}>
      <div style={{ display: "flex", gap: 10 }}>
        {skills.map((skill) => (
          <span key={skill} style={{ fontFamily: MONO, fontSize: 15, color: COLOR.muted, padding: "5px 12px", borderRadius: 8, background: COLOR.control, border: `1px solid ${COLOR.line}` }}>
            {skill}
          </span>
        ))}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 15, color: COLOR.subtle }}>greenbuild · verified in an isolated sandbox</span>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, border: `1px solid ${color}66`, background: `${color}14`, fontFamily: MONO, fontSize: 16, fontWeight: 600, color }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      {children}
    </span>
  );
}
