// How each skill looks in the catalog, from the HotFix Figma frame (7:10962): the filter dot, and the
// tag's text and background. Skills the frame does not show get its neutral grey tag.
interface SkillStyle {
  label: string;
  dot: string;
  text: string;
  background: string;
}

const NEUTRAL = { dot: "#859397", text: "#bbc9cd", background: "#2a2a2b" };

const STYLES: Record<string, SkillStyle> = {
  linux: { label: "Linux", dot: "#ffc640", text: "#ffc640", background: "#ffc6401a" },
  docker: { label: "Docker", dot: "#22d3ee", text: "#8aebff", background: "#22d3ee1a" },
  kubernetes: { label: "Kubernetes", dot: "#8aebff", text: "#8aebff", background: "#8aebff1a" },
  aws: { label: "AWS", dot: "#ffdf9f", text: "#ffdf9f", background: "#ffdf9f1a" },
  azure: { label: "Azure", dot: "#2fd9f4", text: "#2fd9f4", background: "#2fd9f41a" },
  ci_cd: { label: "CI/CD", dot: "#64f88a", text: "#64f88a", background: "#64f88a1a" },
  nginx: { label: "nginx", dot: "#43db71", text: "#64f88a", background: "#64f88a1a" },
  networking: { label: "Networking", dot: "#a2eeff", text: "#8aebff", background: "#a2eeff33" },
  systemd: { label: "systemd", ...NEUTRAL },
  terraform: { label: "Terraform", dot: "#a2eeff", text: "#a2eeff", background: "#a2eeff1a" },
};

const NAMES: Record<string, string> = { postgresql: "PostgreSQL", redis: "Redis", php: "PHP", tls: "TLS" };

export function skillStyle(skill: string): SkillStyle {
  return STYLES[skill] ?? { label: NAMES[skill] ?? skill, ...NEUTRAL };
}
