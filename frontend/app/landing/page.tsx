"use client";

import {
  ArrowRight,
  Database,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Milestone,
  Search,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type Mode = "overview" | "explore";

const SKILLS = [
  "TypeScript", "Python", "React", "Next.js", "FastAPI",
  "RAG / LLM systems", "PostgreSQL", "Docker", "System design", "Node.js",
];

const FEATURES = [
  {
    Icon: Search,
    title: "Semantic retrieval, not keyword search",
    tag: "HOW IT WORKS",
    body: "Queries are embedded and matched against indexed document chunks using vector similarity, so \"has he worked with distributed systems?\" finds the right context even if those words don't appear verbatim.",
  },
  {
    Icon: ShieldCheck,
    title: "Every answer cites its source",
    tag: "TRUST & VERIFICATION",
    body: "Stark grounds every response in retrieved context. Each answer links to the exact document and chunk it came from. No fabrication, no guessing, just retrieval.",
  },
  {
    Icon: FileText,
    title: "Multi-format ingestion",
    tag: "BEYOND TEXT",
    body: "PDFs, Word docs, Markdown, audio recordings (via Whisper), and images are all parsed, chunked, embedded, and indexed. The engine doesn't care about format.",
  },
  {
    Icon: Zap,
    title: "Sub-second inference on Groq",
    tag: "PERFORMANCE",
    body: "LLM calls run on Groq LPUs, the fastest inference hardware available. Retrieval is near-instant on Pinecone serverless. The whole round-trip typically completes in under 2 seconds.",
  },
];

const PIPELINE = [
  { label: "Upload", sub: "PDF / Audio / MD", Icon: Upload },
  { label: "Embed", sub: "E5-Large multilingual", Icon: Database },
  { label: "Index", sub: "Pinecone serverless", Icon: Milestone },
  { label: "Retrieve", sub: "Semantic similarity", Icon: Search },
  { label: "Respond", sub: "Groq + citations", Icon: MessageSquare },
];

const STACK = [
  "FastAPI", "Next.js 15", "Python 3.11", "Groq", "Pinecone",
  "SQLite", "TypeScript", "faster-whisper", "LiteLLM", "multilingual-e5-large",
];

const SUGGESTED_QUESTIONS = [
  "What programming languages and frameworks does Ricardo work with?",
  "Tell me about a project where Ricardo owned the full stack.",
  "What's Ricardo's experience with AI and machine learning?",
  "How does Ricardo approach system design and architecture?",
  "What makes Ricardo a strong engineering hire?",
  "What's the most complex technical problem Ricardo has solved?",
  "Has Ricardo worked in early-stage startup environments?",
  "What kind of teams has Ricardo worked in?",
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mode, setMode] = useState<Mode>("overview");
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-root">

      {/* ── Nav ── */}
      <nav className={`landing-nav ${scrolled ? "landing-nav--scrolled" : ""}`}>
        <div className="landing-nav__brand">
          <div className="landing-brand-icon">S</div>
          <span className="landing-brand-name">Stark</span>
        </div>

        <div className="landing-nav__right">
          <div className="landing-nav__links">
            <Link href="/dashboard" className="landing-nav__link">
              <LayoutDashboard size={13} strokeWidth={1.75} />
              Dashboard
            </Link>
            <Link href="/documents" className="landing-nav__link">
              <FileText size={13} strokeWidth={1.75} />
              Documents
            </Link>
          </div>

          <div className="landing-nav__divider" />

          {/* Mode toggle */}
          <div className="landing-mode-switcher">
            {(["overview", "explore"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`landing-mode-btn ${mode === m ? "landing-mode-btn--active" : ""}`}
              >
                {m === "overview" ? "How it works" : "Try the demo"}
              </button>
            ))}
          </div>

          <ThemeToggle />

          <Link href="/chat" className="landing-cta-sm">
            Open assistant <ArrowRight size={12} strokeWidth={2} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        className="landing-section landing-hero"
      >
        <p className="landing-label">
          {mode === "overview" ? "RAG engine · Full-stack AI project" : "Live demo · Indexed knowledge base"}
        </p>
        <h1 className="landing-h1">
          {mode === "overview"
            ? <>Private data. Searchable.{" "}<span className="landing-accent">Trustworthy.</span></>
            : <>Ask anything.{" "}<span className="landing-accent">Get cited answers.</span></>
          }
        </h1>
        <p className="landing-hero__sub">
          {mode === "overview"
            ? "Stark is a retrieval-augmented generation engine. Upload your documents, ask questions in plain language, and get answers grounded in your actual content with citations."
            : "This instance is indexed with Ricardo Madeira's CV, project case studies, and technical notes. Ask anything about his background, and the engine retrieves and cites every answer from those documents."
          }
        </p>

        <div className="landing-cta-row">
          <Link href="/chat" className="landing-btn-primary">
            Talk to the AI
          </Link>
          <Link href="/dashboard" className="landing-btn-secondary">
            View backend dashboard <ArrowRight size={14} strokeWidth={1.75} />
          </Link>
        </div>
      </section>

      {/* ════════ HOW IT WORKS MODE ════════ */}
      {mode === "overview" && (
        <>
          {/* Features */}
          <section className="landing-section landing-section--alt">
            <div className="landing-container">
              <p className="landing-label">What the engine does</p>
              <h2 className="landing-h2">Retrieval, not generation.</h2>
              <p className="landing-body landing-body--wide">
                Unlike a general-purpose chatbot, Stark only answers from what you give it. No invented facts, no hallucinated credentials, just grounded retrieval from your indexed documents.
              </p>
              <div className="landing-feature-grid">
                {FEATURES.map((f) => (
                  <div key={f.title} className="landing-feature-card">
                    <p className="landing-feature-tag">{f.tag}</p>
                    <div className="landing-feature-title">
                      <f.Icon size={15} strokeWidth={1.75} className="landing-feature-icon" />
                      {f.title}
                    </div>
                    <p className="landing-feature-body">{f.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pipeline */}
          <section className="landing-section">
            <div className="landing-container">
              <p className="landing-label">The pipeline</p>
              <h2 className="landing-h2">From upload to answer in under 2 seconds.</h2>
              <p className="landing-body landing-body--wide">
                Each stage is independently optimised: multilingual embeddings, serverless vector storage, and Groq LPU inference.
              </p>
              <div className="landing-pipeline">
                {PIPELINE.map((step, i) => (
                  <div key={step.label} className="landing-pipeline__item">
                    <div className="landing-pipeline__step">
                      <div className="landing-pipeline__icon-wrap">
                        <step.Icon size={20} strokeWidth={1.5} />
                      </div>
                      <p className="landing-pipeline__label">{step.label}</p>
                      <p className="landing-pipeline__sub">{step.sub}</p>
                    </div>
                    {i < PIPELINE.length - 1 && (
                      <ArrowRight size={16} className="landing-pipeline__arrow" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Stack bar */}
          <section className="landing-section landing-section--alt landing-section--compact">
            <div className="landing-container landing-stack-bar">
              <span className="landing-stack-bar__label">Built with</span>
              {STACK.map((tech) => (
                <span key={tech} className="landing-stack-bar__tech">{tech}</span>
              ))}
            </div>
          </section>

          {/* CTA to demo */}
          <section className="landing-section">
            <div className="landing-container">
              <p className="landing-label">See it live</p>
              <h2 className="landing-h2">The demo is indexed with Ricardo&apos;s background.</h2>
              <p className="landing-body landing-body--wide">
                To demonstrate the engine with real data, this instance is loaded with Ricardo Madeira&apos;s CV, project write-ups, and technical notes. Ask it anything. It can only answer from what&apos;s in those documents.
              </p>
              <div className="landing-cta-row">
                <button
                  type="button"
                  onClick={() => setMode("explore")}
                  className="landing-btn-primary"
                >
                  Explore the demo <ArrowRight size={14} strokeWidth={1.75} />
                </button>
                <Link href="/documents" className="landing-btn-secondary">
                  See indexed documents <ArrowRight size={14} strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ════════ EXPLORE / DEMO MODE ════════ */}
      {mode === "explore" && (
        <>
          {/* Who is indexed */}
          <section className="landing-section">
            <div className="landing-container">
              <p className="landing-label">What&apos;s indexed</p>
              <h2 className="landing-h2">Ricardo Madeira, Engineer.</h2>
              <p className="landing-body landing-body--wide">
                Full-stack engineer focused on AI-powered product development. This knowledge base contains his CV, project case studies, technical write-ups, and engineering notes. The assistant can only answer from these documents and it can&apos;t invent credentials he doesn&apos;t have.
              </p>
              <div className="landing-skill-pills">
                {SKILLS.map((skill) => (
                  <span key={skill} className="landing-pill">{skill}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Suggested questions */}
          <section className="landing-section landing-section--alt">
            <div className="landing-container">
              <p className="landing-label">Start with a question</p>
              <h2 className="landing-h2">Not sure what to ask? Pick one.</h2>
              <p className="landing-body">
                Each card opens the assistant with that prompt pre-filled. Every response will cite the source document it retrieved from.
              </p>
              <div className="landing-question-grid">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Link
                    key={q}
                    href={`/chat?q=${encodeURIComponent(q)}`}
                    className="landing-question-card"
                  >
                    <ArrowRight size={14} className="landing-question-arrow" strokeWidth={2} />
                    <span className="landing-question-text">{q}</span>
                  </Link>
                ))}
              </div>
              <Link href="/chat" className="landing-btn-secondary">
                Or ask your own question <ArrowRight size={14} strokeWidth={1.75} />
              </Link>
            </div>
          </section>
        </>
      )}

      {/* ── Footer CTA ── */}
      <section className="landing-section landing-footer-cta">
        <p className="landing-label" style={{ textAlign: "center" }}>Ready?</p>
        <h2 className="landing-h2 landing-h2--center">
          Stop reading. Start asking.
        </h2>
        <p className="landing-footer-sub">
          The assistant is live. Ask anything: projects, stack, approach, experience. Every answer comes with a source.
        </p>
        <Link href="/chat" className="landing-btn-primary landing-btn-primary--lg">
          Start a conversation
        </Link>
      </section>
    </div>
  );
}
