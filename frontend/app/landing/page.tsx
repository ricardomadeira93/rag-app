"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Stack", href: "#stack" },
];

const STATS = [
  {
    value: "1",
    label: "Person. Every detail.",
    sub: "This assistant knows one person's work — mine. Every answer comes from documents I personally uploaded about my experience, projects, and background.",
  },
  {
    value: "<2s",
    label: "Average response time",
    sub: "Powered by Groq LPUs — the fastest LLM inference hardware available. Ask anything, get an answer instantly.",
  },
  {
    value: "10+",
    label: "File formats indexed",
    sub: "PDFs, Word docs, voice recordings, images, markdown — every format I use to document my work is fully supported.",
  },
];

const FEATURES = [
  {
    icon: "🧠",
    title: "Trained on my actual work",
    tag: "WHY THIS IS DIFFERENT",
    body: "I uploaded my CV, project write-ups, case studies, and technical notes. The assistant answers from those documents — not from general knowledge about 'typical engineers'.",
  },
  {
    icon: "🔗",
    title: "Every answer shows its source",
    tag: "TRUST & VERIFICATION",
    body: "Each response links to the exact document and section it came from. You can verify any claim instantly — no hallucinations hidden behind confident language.",
  },
  {
    icon: "🎙️",
    title: "Audio & image support",
    tag: "BEYOND A PDF RESUME",
    body: "Voice recordings of talks, screenshots of dashboards I built, scanned design notes — all indexed and queryable. A static resume can't do that.",
  },
  {
    icon: "⚡",
    title: "Ask anything, in plain language",
    tag: "NO KEYWORD SEARCHING",
    body: "\"Has he worked with distributed systems?\" \"What's the biggest team he's led?\" \"Show me a project where he owned the full stack.\" — just ask.",
  },
];

const STEPS = [
  {
    number: "01",
    icon: "📂",
    title: "I uploaded my experience",
    body: "My CV, project documentation, case studies, technical write-ups, and more — all indexed and ready to answer your questions.",
    cta: "See the documents →",
    href: "/documents",
  },
  {
    number: "02",
    icon: "💬",
    title: "You ask what you need to know",
    body: "Type any question about my background, skills, or projects in plain language. No keywords, no boolean operators — just ask.",
    cta: "Start a conversation →",
    href: "/chat",
  },
  {
    number: "03",
    icon: "📌",
    title: "Get answers with sources",
    body: "Every response cites the exact document it came from. Verify any claim, drill into the original, and build a complete picture.",
    cta: "Open the app →",
    href: "/dashboard",
  },
];

const STACK = [
  "FastAPI",
  "Next.js 15",
  "Python 3.11",
  "Groq",
  "Pinecone",
  "SQLite",
  "TypeScript",
  "Tailwind CSS",
  "faster-whisper",
  "LiteLLM",
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{
        background: "#0e0e0d",
        color: "#c9c8c2",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 clamp(20px, 5vw, 80px)",
          height: 60,
          borderBottom: scrolled ? "1px solid #222220" : "1px solid transparent",
          background: scrolled ? "rgba(14,14,13,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          transition: "background 200ms ease, border-color 200ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #5b5bd6 0%, #7c7cf0 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            S
          </div>
          <span
            style={{ fontSize: 15, fontWeight: 600, color: "#ededea", letterSpacing: "-0.01em" }}
          >
            Stark
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", gap: 28, fontSize: 13, color: "#8b8882" }}>
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  transition: "color 150ms",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  fontSize: 11,
                  fontWeight: 500,
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#ededea")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#8b8882")}
              >
                {link.label}
              </a>
            ))}
          </div>

          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 16px",
              borderRadius: 6,
              background: "#5b5bd6",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              transition: "background 150ms",
              whiteSpace: "nowrap",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#4747c2")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#5b5bd6")}
          >
            Ask me anything →
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        style={{
          padding: "clamp(80px, 12vw, 140px) clamp(20px, 5vw, 80px) clamp(60px, 8vw, 100px)",
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#5b5bd6",
            marginBottom: 24,
          }}
        >
          Portfolio project · Full-stack AI engineering
        </p>

        <h1
          style={{
            fontSize: "clamp(38px, 6vw, 72px)",
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "#ededea",
            margin: "0 0 28px",
            maxWidth: 760,
          }}
        >
          Don&apos;t read my CV.{" "}
          <span style={{ color: "#7c7cf0" }}>Talk to it.</span>
        </h1>

        <p
          style={{
            fontSize: "clamp(15px, 2vw, 18px)",
            lineHeight: 1.65,
            color: "#8b8882",
            maxWidth: 540,
            margin: "0 0 48px",
          }}
        >
          Stark is my personal AI assistant, trained on my own experience.
          Ask it about projects I&apos;ve shipped, technologies I&apos;ve used, teams I&apos;ve
          led — and it will answer with citations from the actual source documents.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link
            href="/chat"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 44,
              padding: "0 24px",
              borderRadius: 6,
              background: "#5b5bd6",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              transition: "background 150ms",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#4747c2")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#5b5bd6")}
          >
            Ask me anything
          </Link>
          <a
            href="#how-it-works"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 44,
              padding: "0 24px",
              borderRadius: 6,
              border: "1px solid #2e2d2a",
              color: "#8b8882",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              transition: "border-color 150ms, color 150ms",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#5b5bd6";
              e.currentTarget.style.color = "#ededea";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#2e2d2a";
              e.currentTarget.style.color = "#8b8882";
            }}
          >
            See how it works
          </a>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────── */}
      <section
        style={{
          borderTop: "1px solid #1a1a18",
          borderBottom: "1px solid #1a1a18",
          background: "#111110",
          padding: "clamp(40px, 6vw, 80px) clamp(20px, 5vw, 80px)",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#5b5bd6",
              marginBottom: 32,
            }}
          >
            Why this beats a resume
          </p>
          <h2
            style={{
              fontSize: "clamp(22px, 3.5vw, 36px)",
              fontWeight: 600,
              color: "#ededea",
              letterSpacing: "-0.02em",
              marginBottom: 48,
              lineHeight: 1.2,
            }}
          >
            A resume tells you what I did.
            <br />
            This lets you ask what you actually need to know.
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 2,
            }}
          >
            {STATS.map((stat) => (
              <div
                key={stat.value}
                style={{ background: "#161614", padding: "32px 28px", borderRadius: 4 }}
              >
                <p
                  style={{
                    fontSize: "clamp(32px, 4vw, 48px)",
                    fontWeight: 700,
                    color: "#7c7cf0",
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    marginBottom: 12,
                  }}
                >
                  {stat.value}
                </p>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#ededea",
                    marginBottom: 10,
                  }}
                >
                  {stat.label}
                </p>
                <p style={{ fontSize: 13, color: "#8b8882", lineHeight: 1.6 }}>{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section
        id="features"
        style={{
          padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)",
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#5b5bd6",
            marginBottom: 16,
          }}
        >
          Under the hood
        </p>
        <h2
          style={{
            fontSize: "clamp(22px, 3.5vw, 36px)",
            fontWeight: 600,
            color: "#ededea",
            letterSpacing: "-0.02em",
            marginBottom: 12,
          }}
        >
          Not a chatbot. An AI that knows my work.
        </h2>
        <p
          style={{ fontSize: 14, color: "#8b8882", marginBottom: 56, lineHeight: 1.6 }}
        >
          Every answer comes from documents I wrote, projects I shipped, or recordings I made.
          It can&apos;t hallucinate credentials I don&apos;t have.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 1,
            background: "#1a1a18",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{ background: "#0e0e0d", padding: "32px 28px", borderBottom: "1px solid #1a1a18" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 20,
                  paddingBottom: 20,
                  borderBottom: "1px solid #1a1a18",
                }}
              >
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#ededea" }}>{f.title}</p>
              </div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#5b5bd6",
                  marginBottom: 12,
                }}
              >
                {f.tag}
              </p>
              <p style={{ fontSize: 13, color: "#8b8882", lineHeight: 1.7 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{
          borderTop: "1px solid #1a1a18",
          background: "#111110",
          padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#5b5bd6",
              marginBottom: 16,
            }}
          >
            How it works
          </p>
          <h2
            style={{
              fontSize: "clamp(22px, 3.5vw, 36px)",
              fontWeight: 600,
              color: "#ededea",
              letterSpacing: "-0.02em",
              marginBottom: 56,
            }}
          >
            How to use it. Takes 30 seconds.
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 24,
            }}
          >
            {STEPS.map((step) => (
              <div
                key={step.number}
                style={{
                  background: "#0e0e0d",
                  border: "1px solid #1a1a18",
                  borderRadius: 8,
                  padding: "28px 24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 24,
                  }}
                >
                  <span style={{ fontSize: 13, color: "#3d3c38", fontWeight: 600 }}>
                    {step.number}
                  </span>
                  <span style={{ fontSize: 22 }}>{step.icon}</span>
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: "#ededea",
                    marginBottom: 12,
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "#8b8882",
                    lineHeight: 1.7,
                    marginBottom: 24,
                  }}
                >
                  {step.body}
                </p>
                <Link
                  href={step.href as string & {}}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#7c7cf0",
                    textDecoration: "none",
                    letterSpacing: "0.02em",
                    transition: "color 150ms",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#a5a5f8")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#7c7cf0")}
                >
                  {step.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Desenvolvido com ────────────────────────────────── */}
      <footer
        id="stack"
        style={{
          borderTop: "1px solid #1a1a18",
          padding: "28px clamp(20px, 5vw, 80px)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px 32px",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#3d3c38",
            whiteSpace: "nowrap",
          }}
        >
          Desenvolvido com
        </span>
        {STACK.map((tech) => (
          <span
            key={tech}
            style={{
              fontSize: 13,
              color: "#6b6863",
              whiteSpace: "nowrap",
              transition: "color 150ms",
              cursor: "default",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#ededea")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#6b6863")}
          >
            {tech}
          </span>
        ))}
      </footer>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section
        style={{
          borderTop: "1px solid #1a1a18",
          padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#5b5bd6",
            marginBottom: 16,
          }}
        >
          Ready to have a conversation?
        </p>
        <h2
          style={{
            fontSize: "clamp(24px, 4vw, 44px)",
            fontWeight: 700,
            color: "#ededea",
            letterSpacing: "-0.02em",
            marginBottom: 16,
            lineHeight: 1.15,
          }}
        >
          Skip the CV.
          <br />
          Ask me anything.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#8b8882",
            maxWidth: 420,
            margin: "0 auto 40px",
            lineHeight: 1.7,
          }}
        >
          Every project, every role, every technology — indexed and ready.
          Start a conversation and see how I think.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <Link
            href="/chat"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 44,
              padding: "0 24px",
              borderRadius: 6,
              background: "#5b5bd6",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              transition: "background 150ms",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#4747c2")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#5b5bd6")}
          >
            Start a conversation
          </Link>
          <a
            href="#how-it-works"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 44,
              padding: "0 24px",
              borderRadius: 6,
              border: "1px solid #2e2d2a",
              color: "#8b8882",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              transition: "border-color 150ms, color 150ms",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#5b5bd6";
              e.currentTarget.style.color = "#ededea";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#2e2d2a";
              e.currentTarget.style.color = "#8b8882";
            }}
          >
            See how it works
          </a>
        </div>
      </section>
    </div>
  );
}
