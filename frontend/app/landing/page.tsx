"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const STACK = [
  { name: "FastAPI", desc: "High-performance Python backend" },
  { name: "Next.js 15", desc: "Modern React framework" },
  { name: "Groq", desc: "Ultra-fast LLM inference" },
  { name: "Pinecone", desc: "Serverless vector database" },
  { name: "Whisper", desc: "AI-powered audio transcription" },
  { name: "TypeScript", desc: "Type-safe frontend logic" },
];

const FEATURES = [
  {
    title: "Multi-Format Ingestion",
    desc: "Seamlessly process PDFs, Markdown, Word docs, and even Voice Recordings via OpenAI Whisper integration.",
    icon: "📂",
  },
  {
    title: "Contextual Retrieval",
    desc: "Hybrid search combining vector embeddings (multilingual-e5-large) with BM25 keyword matching for maximum relevance.",
    icon: "🔍",
  },
  {
    title: "Verifiable Accuracy",
    desc: "Every response is grounded in retrieved context with strict citation mapping. No hallucinations, just data-driven answers.",
    icon: "🔗",
  },
  {
    title: "Instant Inference",
    desc: "Powered by Groq LPUs for sub-second response times, delivering a near-instantaneous chat experience.",
    icon: "⚡",
  },
];

const SUGGESTED_QUESTIONS = [
  "What is the core architecture of Stark?",
  "How does Ricardo implement the RAG pipeline?",
  "Tell me about Ricardo's experience with full-stack development.",
  "What are the most complex projects indexed in this system?",
  "How does this tool handle audio and image data?",
  "What technologies is Ricardo most proficient in?",
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
    <div style={{ background: "#0e0e0d", color: "#c9c8c2", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      
      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(20px, 5vw, 80px)", height: 64,
        borderBottom: scrolled ? "1px solid #222220" : "1px solid transparent",
        background: scrolled ? "rgba(14,14,13,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        transition: "background 200ms ease, border-color 200ms ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #5b5bd6 0%, #7c7cf0 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>S</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#ededea", letterSpacing: "-0.02em" }}>Stark</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", gap: 24, fontSize: 13, fontWeight: 500, color: "#8b8882" }}>
            <a href="#engine" style={{ textDecoration: "none", color: "inherit" }}>The Engine</a>
            <a href="#demo" style={{ textDecoration: "none", color: "inherit" }}>Live Demo</a>
            <a href="#stack" style={{ textDecoration: "none", color: "inherit" }}>Stack</a>
          </div>
          <Link
            href="/chat"
            style={{ display: "inline-flex", alignItems: "center", height: 36, padding: "0 16px", borderRadius: 6, background: "#5b5bd6", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "background 150ms" }}
          >
            Launch App
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: "clamp(100px, 15vw, 180px) clamp(20px, 5vw, 80px) 100px", maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 20, background: "rgba(91, 91, 214, 0.1)", border: "1px solid rgba(91, 91, 214, 0.2)", marginBottom: 24 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5b5bd6" }}></span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#7c7cf0", letterSpacing: "0.05em", textTransform: "uppercase" }}>Open Source RAG Engine</span>
        </div>
        
        <h1 style={{ fontSize: "clamp(40px, 7vw, 84px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em", color: "#ededea", margin: "0 auto 32px", maxWidth: 900 }}>
          Talk to your data with <span style={{ background: "linear-gradient(to right, #7c7cf0, #5b5bd6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>surgical precision.</span>
        </h1>
        
        <p style={{ fontSize: "clamp(16px, 2.5vw, 20px)", lineHeight: 1.6, color: "#8b8882", maxWidth: 640, margin: "0 auto 48px" }}>
          Stark is a high-performance Retrieval-Augmented Generation (RAG) platform designed to turn private documentation into actionable intelligence.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          <Link
            href="/chat"
            style={{ display: "inline-flex", alignItems: "center", height: 52, padding: "0 32px", borderRadius: 8, background: "#5b5bd6", color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none", transition: "transform 200ms" }}
          >
            Try the Demo
          </Link>
          <a
            href="#engine"
            style={{ display: "inline-flex", alignItems: "center", height: 52, padding: "0 32px", borderRadius: 8, border: "1px solid #2e2d2a", color: "#ededea", fontSize: 15, fontWeight: 600, textDecoration: "none" }}
          >
            How it Works
          </a>
        </div>
      </section>

      {/* ── The Engine (RAG Visualization) ── */}
      <section id="engine" style={{ borderTop: "1px solid #1a1a18", background: "#111110", padding: "100px clamp(20px, 5vw, 80px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <h2 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, color: "#ededea", marginBottom: 20 }}>Built for Accuracy.</h2>
            <p style={{ fontSize: 18, color: "#8b8882", maxWidth: 600, margin: "0 auto" }}>
              Most AI assistants guess. Stark retrieves. Our engine follows a strict multi-stage pipeline to ensure every answer is grounded in truth.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 40, marginBottom: 100 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: "#0e0e0d", padding: "32px", borderRadius: 12, border: "1px solid #1a1a18", transition: "transform 200ms", cursor: "default" }} onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-5px)"} onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                <div style={{ fontSize: 32, marginBottom: 20 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ededea", marginBottom: 12 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "#8b8882", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* ── Visual Pipeline ── */}
          <div style={{ padding: "40px", borderRadius: 20, background: "rgba(91, 91, 214, 0.03)", border: "1px solid rgba(91, 91, 214, 0.1)" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#5b5bd6", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: "center", marginBottom: 40 }}>The RAG Pipeline</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "20px" }}>
              {[
                { label: "Data Source", sub: "PDF / Audio / MD", icon: "📄" },
                { label: "Embedding", sub: "E5-Large V3", icon: "🧬" },
                { label: "Vector Store", sub: "Pinecone / Indexing", icon: "📦" },
                { label: "Retrieval", sub: "Context Fetching", icon: "🎯" },
                { label: "LLM Response", sub: "Groq LPU / Citations", icon: "💬" },
              ].map((step, i, arr) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  <div style={{ textAlign: "center", width: "140px" }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: "#1a1a18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 12px", border: "1px solid #222220" }}>{step.icon}</div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#ededea", marginBottom: 4 }}>{step.label}</p>
                    <p style={{ fontSize: 11, color: "#6b6863" }}>{step.sub}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ color: "#222220", fontSize: 20, fontWeight: 300, display: "flex", alignItems: "center" }}>→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The Demo (Knowledge Base Showcase) ── */}
      <section id="demo" style={{ borderTop: "1px solid #1a1a18", padding: "100px clamp(20px, 5vw, 80px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 64, alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 40, fontWeight: 700, color: "#ededea", marginBottom: 24 }}>The Live Demo.</h2>
            <p style={{ fontSize: 16, color: "#8b8882", lineHeight: 1.7, marginBottom: 32 }}>
              To demonstrate Stark&apos;s capabilities, we&apos;ve indexed a curated knowledge base consisting of <strong>Ricardo Madeira&apos;s</strong> professional background, technical projects, and engineering philosophy.
            </p>
            <div style={{ spaceY: 16 }}>
              {["12 Documents Indexed", "4 Audio Transcriptions", "Full Technical Case Studies"].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, color: "#ededea", fontSize: 15, marginBottom: 12 }}>
                  <span style={{ color: "#5b5bd6" }}>✓</span> {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#111110", padding: "32px", borderRadius: 16, border: "1px solid #1a1a18" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#5b5bd6", textTransform: "uppercase", marginBottom: 16 }}>Suggested Queries</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <Link
                  key={i}
                  href={`/chat?q=${encodeURIComponent(q)}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", background: "#0e0e0d", border: "1px solid #222220", borderRadius: 8, textDecoration: "none", color: "#ededea", fontSize: 13, transition: "border-color 200ms" }}
                >
                  <span style={{ color: "#5b5bd6" }}>→</span> {q}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Technical Stack ── */}
      <section id="stack" style={{ borderTop: "1px solid #1a1a18", background: "#111110", padding: "100px clamp(20px, 5vw, 80px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: "#ededea", marginBottom: 48 }}>Engine Specs.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
            {STACK.map((s, i) => (
              <div key={i} style={{ padding: "24px", textAlign: "center" }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#ededea", marginBottom: 8 }}>{s.name}</p>
                <p style={{ fontSize: 12, color: "#8b8882" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ borderTop: "1px solid #1a1a18", padding: "120px 20px", textAlign: "center" }}>
        <h2 style={{ fontSize: 48, fontWeight: 800, color: "#ededea", marginBottom: 24 }}>Ready to see it in action?</h2>
        <p style={{ fontSize: 18, color: "#8b8882", maxWidth: 500, margin: "0 auto 40px" }}>
          Launch the assistant and ask anything about the system or the data it contains.
        </p>
        <Link
          href="/chat"
          style={{ display: "inline-flex", alignItems: "center", height: 56, padding: "0 40px", borderRadius: 8, background: "#5b5bd6", color: "#fff", fontSize: 16, fontWeight: 600, textDecoration: "none" }}
        >
          Open Assistant
        </Link>
      </section>

      <footer style={{ padding: "40px 20px", textAlign: "center", borderTop: "1px solid #1a1a18", color: "#3d3c38", fontSize: 12, letterSpacing: "0.05em" }}>
        STARK ENGINE // BUILT BY RICARDO MADEIRA
      </footer>
    </div>
  );
}
