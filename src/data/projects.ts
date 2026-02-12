export interface ProjectEntry {
  slug: string;
  title: string;
  summary: string;
  category: string;
  stack: string[];
  infra: string[];
  highlights: string[];
  contextPath: string;
}

export const projects: ProjectEntry[] = [
  {
    slug: "ai-tutor-tools",
    title: "AI Tutor Tools",
    summary: "Education-focused AI utilities including EU AI Act risk assessment workflows.",
    category: "Product Experiment",
    stack: ["Next.js 14", "TypeScript", "NextUI", "Tailwind CSS"],
    infra: ["Vercel/Node runtime patterns", "API-route-first architecture"],
    highlights: [
      "Structured page generation conventions for rapid prototyping",
      "Accessibility + mobile-first discipline",
      "Brand-aligned component system for consistent tool rollout",
    ],
    contextPath: "AI Tutor Tools/",
  },
  {
    slug: "ai-tutor-admin-dashboard",
    title: "AI Tutor Admin Dashboard",
    summary: "Privacy-first admin UI for white-label AI tutoring analytics and governance.",
    category: "Frontend System",
    stack: ["Astro", "Vanilla JS", "CSS Design Tokens"],
    infra: ["Static shell + componentized pages", "Mock-data MVP architecture"],
    highlights: [
      "Dashboard IA for students, cohorts, governance and alerts",
      "Token/query usage observability model",
      "Privacy-safe analytics lens (no transcript exposure)",
    ],
    contextPath: "Admin dashboard AI Tutor/",
  },
  {
    slug: "ai-visibility-analysis",
    title: "AI Visibility Analysis",
    summary: "Pipelines to monitor LLM visibility and AI crawler behavior in one analytics layer.",
    category: "Data & Analytics",
    stack: ["Python", "OpenAI APIs", "Cloudflare API", "BigQuery"],
    infra: ["Cloud Scheduler/Functions-ready jobs", "BigQuery warehouse model"],
    highlights: [
      "LLM mention scoring (prominence/sentiment/recommendation)",
      "Cloudflare crawler extraction with category splits",
      "Joined analysis foundation for referral/visibility intelligence",
    ],
    contextPath: "AI Visibility Analysis/",
  },
  {
    slug: "portfolio-report-pipeline",
    title: "Portfolio Report Pipeline",
    summary: "Revenue/subscription ETL from Stripe, Apple, Sheets and RevenueCat into BigQuery.",
    category: "Data Engineering",
    stack: ["Python", "Stripe API", "App Store Connect", "BigQuery"],
    infra: ["Scheduled extraction", "Historical backfill + monthly update modes"],
    highlights: [
      "Cross-platform financial normalization",
      "Exchange-rate table for consistent reporting",
      "Execution logging and repeat-safe extraction flow",
    ],
    contextPath: "Portfolio report pipeline/",
  },
  {
    slug: "speech-therapy-toolbox",
    title: "Speech Therapy Toolbox",
    summary: "AI-assisted therapy tools for transcription, image generation and voice exercises.",
    category: "Applied AI Product",
    stack: ["React", "TypeScript", "Vite", "Tailwind CSS"],
    infra: ["Web Audio API", "Deepgram", "Replicate/Flux"],
    highlights: [
      "Real-time speech transcription app with usage limits",
      "Therapy-focused interaction design and accessibility",
      "Privacy-first demo mode architecture",
    ],
    contextPath: "Speech-therapy.site/speech-language-therapy/",
  },
  {
    slug: "notion-knowledge-management",
    title: "Notion Knowledge Management OS",
    summary: "Operational routing system for company context, proposals, CRM and comms workflows.",
    category: "Knowledge Ops",
    stack: ["Notion API", "MCP workflows", "Local instruction routers"],
    infra: ["Task-type routing protocol", "Context-minimization rules"],
    highlights: [
      "Domain-specific guides for CRM/proposals",
      "Actionable context loading framework",
      "Reusable operating system for AI collaborators",
    ],
    contextPath: "Notion Knowledge Management/",
  },
  {
    slug: "google-analytics-mcp",
    title: "Google Analytics MCP",
    summary: "Experimental MCP server integration for GA Admin/Data API analytics workflows.",
    category: "MCP Integration",
    stack: ["Python", "Google Analytics APIs", "MCP"],
    infra: ["Local tool server", "ADC auth model"],
    highlights: [
      "LLM-assisted GA reporting and discovery",
      "Realtime + historical reporting endpoints",
      "Composable analytics tooling surface",
    ],
    contextPath: "Analytics/google-analytics-mcp/",
  },
  {
    slug: "inspection-workflow-automation",
    title: "Inspection Workflow Automation",
    summary: "Document-driven inspection prep framework for subsidy verification projects.",
    category: "Process Automation",
    stack: ["Markdown playbooks", "Python helpers (selective)", "Pattern libraries"],
    infra: ["Flexible workflow-first design", "Continuous learnings loop"],
    highlights: [
      "Robust file-discovery and checklist generation flow",
      "Project learnings capture and pattern evolution",
      "High-ambiguity workflow support without brittle automation",
    ],
    contextPath: "Inspeccións tragsa/",
  },
];

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug);
}
