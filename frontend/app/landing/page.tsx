"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Mode = "portfolio" | "knowledge";

const SKILLS = [
  "TypeScript", "Python", "React", "Next.js", "FastAPI",
  "RAG / LLM systems", "PostgreSQL", "Docker", "System design", "Node.js",
];

const HIGHLIGHTS = [
  {
    tag: "FULL-STACK PRODUCT",
    title: "Built and shipped Stark",
    body: "Designed and implemented a full RAG platform from scratch — FastAPI backend, Next.js 15 frontend, Pinecone vector store, Groq inference. This page is the live demo.",
  },
  {
    tag: "AI ENGINEERING",
    title: "End-to-end LLM pipelines",
    body: "Retrieval-augmented generation, multi-format ingestion (PDF, audio, images, markdown), hybrid BM25 + vector search, and citation-grounded responses.",
  },
  {
    tag: "ENGINEERING CULTURE",
    title: "Production-quality defaults",
    body: "Type-safe throughout, CI/CD on GitHub Actions, Dockerised, deployed on Vercel + Render. Not a side project — a system I'd be comfortable handing to another engineer.",
  },
];

const SUGGESTED_QUESTIONS = [
  "What programming languages and frameworks does Ricardo work with?",
  "Tell me about a project where Ricardo owned the full stack.",
  "What's Ricardo's experience with AI and machine learning?",
  "How does Ricardo approach system design and architecture?",
  "What makes Ricardo a strong engineering hire?",
  "Has Ricardo worked in a startup environment?",
  "What's the most complex technical challenge Ricardo has solved?",
  "What kind of teams has Ricardo worked in?",
];

const STACK = [
  "FastAPI", "Next.js 15", "Python 3.11", "Groq", "Pinecone",
  "SQLite", "TypeScript", "Tailwind CSS", "faster-whisper", "LiteLLM",
];

const s = {
  label: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "#5b5bd6",
    marginBottom: 16,
  },
  h2: {
    fontSize: "clamp(22px, 3.5vw, 36px)" as string | number,
    fontWeight: 600,
    color: "#ededea",
    letterSpacing: "-0.02em",
    marginBottom: 16,
    lineHeight: 1.2,
  },
  muted: { fontSize: 14, color: "#8b8882", lineHeight: 1.65 },
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mode, setMode] = useState<Mode>("portfolio");
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: "#0e0e0d", color: "#c9c8c2", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(20px, 5vw, 80px)", height: 60,
        borderBottom: scrolled ? "1px solid #222220" : "1px solid transparent",
        background: scrolled ? "rgba(14,14,13,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        transition: "background 200ms ease, border-color 200ms ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #5b5bd6 0%, #7c7cf0 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>S</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#ededea", letterSpacing: "-0.01em" }}>Stark</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Mode toggle pill */}
          <div style={{ display: "flex", alignItems: "center", background: "#161614", border: "1px solid #2e2d2a", borderRadius: 8, padding: 3, gap: 2 }}>
            {(["portfolio", "knowledge"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                  background: mode === m ? "#5b5bd6" : "transparent",
                  color: mode === m ? "#fff" : "#6b6863",
                  transition: "background 150ms, color 150ms",
                }}
              >
                {m === "portfolio" ? "Portfolio" : "Knowledge Base"}
              </button>
            ))}
          </div>

          <Link
            href="/chat"
            style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 16px", borderRadius: 6, background: "#5b5bd6", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em", textTransform: "uppercase", transition: "background 150ms", whiteSpace: "nowrap" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#4747c2")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#5b5bd6")}
          >
            Ask me anything →
          </Link>
        </div>
      </nav>

      {/* ── Hero (shared) ── */}
      <section ref={heroRef} style={{ padding: "clamp(80px, 12vw, 140px) clamp(20px, 5vw, 80px) clamp(40px, 6vw, 80px)", maxWidth: 960, margin: "0 auto" }}>
        <p style={s.label}>
          {mode === "portfolio" ? "Portfolio · Full-stack AI engineering" : "Interactive knowledge base · Ask anything"}
        </p>
        <h1 style={{ fontSize: "clamp(38px, 6vw, 72px)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.03em", color: "#ededea", margin: "0 0 24px", maxWidth: 760 }}>
          {mode === "portfolio"
            ? <>Don&apos;t read my CV.{" "}<span style={{ color: "#7c7cf0" }}>Talk to it.</span></>
            : <>Ask me anything.{" "}<span style={{ color: "#7c7cf0" }}>Get sourced answers.</span></>}
        </h1>
        <p style={{ fontSize: "clamp(15px, 2vw, 18px)", lineHeight: 1.65, color: "#8b8882", maxWidth: 540, margin: "0 0 40px" }}>
          {mode === "portfolio"
            ? "I'm Ricardo Madeira — a full-stack engineer specialising in AI systems and product engineering. This assistant is trained on my actual work. Every answer cites the source."
            : "Type any question about my background, skills, or projects. Or pick one below to start. Every response links to the exact document it came from."}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link
            href="/chat"
            style={{ display: "inline-flex", alignItems: "center", height: 44, padding: "0 24px", borderRadius: 6, background: "#5b5bd6", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em", textTransform: "uppercase", transition: "background 150ms" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#4747c2")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#5b5bd6")}
          >
            {mode === "portfolio" ? "Ask me anything" : "Open the assistant"}
          </Link>
          <button
            type="button"
            onClick={() => setMode(mode === "portfolio" ? "knowledge" : "portfolio")}
            style={{ display: "inline-flex", alignItems: "center", height: 44, padding: "0 24px", borderRadius: 6, border: "1px solid #2e2d2a", color: "#8b8882", fontSize: 13, fontWeight: 500, background: "transparent", cursor: "pointer", letterSpacing: "0.02em", textTransform: "uppercase", transition: "border-color 150ms, color 150ms" }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#5b5bd6"; e.currentTarget.style.color = "#ededea"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "#2e2d2a"; e.currentTarget.style.color = "#8b8882"; }}
          >
            {mode === "portfolio" ? "Explore knowledge base →" : "View portfolio overview →"}
          </button>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          PORTFOLIO MODE
      ════════════════════════════════════════════ */}
      {mode === "portfolio" && (
        <>
          {/* About */}
          <section style={{ borderTop: "1px solid #1a1a18", padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)", maxWidth: 960, margin: "0 auto" }}>
            <p style={s.label}>Who I am</p>
            <h2 style={s.h2}>Ricardo Madeira</h2>
            <p style={{ ...s.muted, maxWidth: 600, marginBottom: 32 }}>
              Full-stack engineer with a focus on AI-powered product development. I design and build end-to-end systems — from LLM pipelines and vector search to production-grade frontends — and I care deeply about code that other engineers can actually work with.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SKILLS.map((skill) => (
                <span key={skill} style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, border: "1px solid #2e2d2a", fontSize: 12, color: "#8b8882" }}>{skill}</span>
              ))}
            </div>
          </section>

          {/* Highlights */}
          <section style={{ borderTop: "1px solid #1a1a18", background: "#111110", padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)" }}>
            <div style={{ maxWidth: 960, margin: "0 auto" }}>
              <p style={s.label}>What I&apos;ve built</p>
              <h2 style={s.h2}>Recent work, in plain language.</h2>
              <p style={{ ...s.muted, maxWidth: 540, marginBottom: 48 }}>Selected examples from the knowledge base. Ask the assistant for the full story.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 1, background: "#1a1a18", borderRadius: 8, overflow: "hidden" }}>
                {HIGHLIGHTS.map((h) => (
                  <div key={h.title} style={{ background: "#111110", padding: "28px 24px" }}>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5b5bd6", marginBottom: 12 }}>{h.tag}</p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#ededea", marginBottom: 10 }}>{h.title}</p>
                    <p style={{ fontSize: 13, color: "#8b8882", lineHeight: 1.7 }}>{h.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Why this beats a resume */}
          <section style={{ borderTop: "1px solid #1a1a18", padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)", maxWidth: 960, margin: "0 auto" }}>
            <p style={s.label}>Why this format</p>
            <h2 style={s.h2}>A resume tells you what I did.<br />This lets you ask what you need to know.</h2>
            <p style={{ ...s.muted, maxWidth: 560, marginBottom: 40 }}>
              Every claim in this assistant is grounded in a document I wrote or a project I shipped. It can&apos;t hallucinate credentials I don&apos;t have. Ask it anything — it will either answer with a source, or tell you it doesn&apos;t know.
            </p>
            <button
              type="button"
              onClick={() => setMode("knowledge")}
              style={{ display: "inline-flex", alignItems: "center", height: 44, padding: "0 24px", borderRadius: 6, background: "#5b5bd6", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", letterSpacing: "0.02em", textTransform: "uppercase", transition: "background 150ms" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#4747c2")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#5b5bd6")}
            >
              Switch to knowledge base →
            </button>
          </section>

          {/* Ask me — also available in Portfolio mode */}
          <section style={{ borderTop: "1px solid #1a1a18", background: "#111110", padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)" }}>
            <div style={{ maxWidth: 960, margin: "0 auto" }}>
              <p style={s.label}>Ask me anything</p>
              <h2 style={s.h2}>Have a specific question? Ask it directly.</h2>
              <p style={{ ...s.muted, marginBottom: 40 }}>
                Click any prompt below — the assistant opens with that question ready to go. Every answer cites the source document.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginBottom: 32 }}>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Link
                    key={q}
                    href={`/chat?q=${encodeURIComponent(q)}`}
                    style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px", borderRadius: 8, border: "1px solid #222220", background: "#0e0e0d", textDecoration: "none", transition: "border-color 150ms, background 150ms" }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = "#5b5bd6"; e.currentTarget.style.background = "#0f0f1e"; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = "#222220"; e.currentTarget.style.background = "#0e0e0d"; }}
                  >
                    <span style={{ color: "#5b5bd6", fontSize: 14, flexShrink: 0, marginTop: 1 }}>→</span>
                    <span style={{ fontSize: 13, color: "#c9c8c2", lineHeight: 1.55 }}>{q}</span>
                  </Link>
                ))}
              </div>
              <Link
                href="/chat"
                style={{ display: "inline-flex", alignItems: "center", height: 40, padding: "0 20px", borderRadius: 6, border: "1px solid #2e2d2a", color: "#8b8882", fontSize: 12, fontWeight: 500, textDecoration: "none", letterSpacing: "0.02em", textTransform: "uppercase", transition: "border-color 150ms, color 150ms" }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "#5b5bd6"; e.currentTarget.style.color = "#ededea"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "#2e2d2a"; e.currentTarget.style.color = "#8b8882"; }}
              >
                Or ask your own question →
              </Link>
            </div>
          </section>
        </>
      )}


      {/* ════════════════════════════════════════════
          KNOWLEDGE BASE MODE
      ════════════════════════════════════════════ */}
      {mode === "knowledge" && (
        <>
          {/* Question grid */}
          <section style={{ borderTop: "1px solid #1a1a18", background: "#111110", padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)" }}>
            <div style={{ maxWidth: 960, margin: "0 auto" }}>
              <p style={s.label}>Start with a question</p>
              <h2 style={s.h2}>Not sure what to ask? Pick one.</h2>
              <p style={{ ...s.muted, marginBottom: 40 }}>
                Each card opens the assistant with that question pre-filled. Every answer cites the source document.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Link
                    key={q}
                    href={`/chat?q=${encodeURIComponent(q)}`}
                    style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px", borderRadius: 8, border: "1px solid #222220", background: "#0e0e0d", textDecoration: "none", transition: "border-color 150ms, background 150ms" }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = "#5b5bd6"; e.currentTarget.style.background = "#0f0f1e"; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = "#222220"; e.currentTarget.style.background = "#0e0e0d"; }}
                  >
                    <span style={{ color: "#5b5bd6", fontSize: 14, flexShrink: 0, marginTop: 1 }}>→</span>
                    <span style={{ fontSize: 13, color: "#c9c8c2", lineHeight: 1.55 }}>{q}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" style={{ borderTop: "1px solid #1a1a18", padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)", maxWidth: 960, margin: "0 auto" }}>
            <p style={s.label}>How it works</p>
            <h2 style={s.h2}>Takes 30 seconds.</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginTop: 40 }}>
              {[
                { n: "01", title: "I uploaded my experience", body: "CV, project write-ups, case studies, technical notes — all indexed and ready." },
                { n: "02", title: "You ask in plain language", body: "No keywords or boolean operators. Just ask what you actually want to know." },
                { n: "03", title: "Get cited answers", body: "Every response links to the exact document. Verify any claim instantly." },
              ].map((step) => (
                <div key={step.n} style={{ background: "#111110", border: "1px solid #1a1a18", borderRadius: 8, padding: "24px 20px" }}>
                  <p style={{ fontSize: 12, color: "#3d3c38", fontWeight: 600, marginBottom: 16 }}>{step.n}</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#ededea", marginBottom: 10 }}>{step.title}</p>
                  <p style={{ fontSize: 13, color: "#8b8882", lineHeight: 1.7 }}>{step.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Trust */}
          <section style={{ borderTop: "1px solid #1a1a18", background: "#111110", padding: "clamp(40px, 6vw, 64px) clamp(20px, 5vw, 80px)" }}>
            <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
              {[
                { value: "1", label: "Person indexed", sub: "Only my work. No filler." },
                { value: "<2s", label: "Response time", sub: "Groq LPU inference." },
                { value: "100%", label: "Source-cited", sub: "Every answer has a reference." },
              ].map((stat) => (
                <div key={stat.value} style={{ background: "#161614", padding: "28px 24px", borderRadius: 4 }}>
                  <p style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700, color: "#7c7cf0", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 8 }}>{stat.value}</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#ededea", marginBottom: 4 }}>{stat.label}</p>
                  <p style={{ fontSize: 12, color: "#8b8882" }}>{stat.sub}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── Footer / Stack (shared) ── */}
      <footer id="stack" style={{ borderTop: "1px solid #1a1a18", padding: "28px clamp(20px, 5vw, 80px)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 28px" }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3d3c38", whiteSpace: "nowrap" }}>Built with</span>
        {STACK.map((tech) => (
          <span key={tech} style={{ fontSize: 12, color: "#6b6863", whiteSpace: "nowrap", cursor: "default", transition: "color 150ms" }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#ededea")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#6b6863")}
          >{tech}</span>
        ))}
      </footer>

      {/* ── Final CTA (shared) ── */}
      <section style={{ borderTop: "1px solid #1a1a18", padding: "clamp(60px, 8vw, 100px) clamp(20px, 5vw, 80px)", textAlign: "center" }}>
        <p style={{ ...s.label, textAlign: "center" }}>Ready?</p>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 44px)", fontWeight: 700, color: "#ededea", letterSpacing: "-0.02em", marginBottom: 16, lineHeight: 1.15 }}>
          Skip the CV.<br />Ask me anything.
        </h2>
        <p style={{ fontSize: 14, color: "#8b8882", maxWidth: 380, margin: "0 auto 36px", lineHeight: 1.7 }}>
          Every project, role, and technology — indexed and ready. Start a conversation and see how I think.
        </p>
        <Link
          href="/chat"
          style={{ display: "inline-flex", alignItems: "center", height: 48, padding: "0 32px", borderRadius: 6, background: "#5b5bd6", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em", textTransform: "uppercase", transition: "background 150ms" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#4747c2")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#5b5bd6")}
        >
          Start a conversation
        </Link>
      </section>
    </div>
  );
}
