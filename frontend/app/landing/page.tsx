"use client";

import {
  ArrowRight,
  Database,
  FileCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  Layers3,
  MessageSquare,
  Search,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  {
    Icon: Search,
    title: "Semantic retrieval, not keyword search",
    tag: "HOW IT WORKS",
    body: "Queries are embedded and matched against indexed document chunks using vector similarity, finding context even without exact keyword matches.",
  },
  {
    Icon: FileCheck,
    title: "Every answer cites its source",
    tag: "TRUST & VERIFICATION",
    body: "Stark grounds every response in retrieved context. Each answer links to the exact document and chunk it came from to prevent hallucinations.",
  },
  {
    Icon: FileText,
    title: "Multi-format ingestion",
    tag: "BEYOND TEXT",
    body: "PDFs, Word docs, Markdown, and images are all parsed, chunked, embedded, and indexed. The engine handles the heavy lifting of extraction.",
  },
  {
    Icon: Gauge,
    title: "Sub-second inference",
    tag: "PERFORMANCE",
    body: "LLM calls run on high-performance infrastructure. Retrieval is near-instant, ensuring the round-trip typically completes in under 2 seconds.",
  },
];

const PIPELINE = [
  { label: "Upload", sub: "PDF / Word / MD", Icon: Upload },
  { label: "Embed", sub: "Multilingual vectors", Icon: Database },
  { label: "Index", sub: "Pinecone serverless", Icon: Layers3 },
  { label: "Retrieve", sub: "Semantic similarity", Icon: Search },
  { label: "Respond", sub: "LLM + citations", Icon: MessageSquare },
];

const STACK = [
  "FastAPI", "Next.js 15", "Python 3.11", "Groq", "Pinecone",
  "SQLite", "TypeScript", "faster-whisper", "LiteLLM", "multilingual-e5-large",
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

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

          <ThemeToggle />

          <Link href="/dashboard" className="landing-cta-sm">
            Open assistant <ArrowRight size={12} strokeWidth={2} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-section landing-hero">
        <p className="landing-label">RAG engine · Knowledge Retrieval</p>
        <h1 className="landing-h1">
          Private data. Searchable. <span className="landing-accent">Trustworthy.</span>
        </h1>
        <p className="landing-hero__sub">
          Stark is a high-performance retrieval-augmented generation engine. 
          Upload your documents, ask questions in plain language, and get answers grounded 
          exclusively in your content with verifiable citations.
        </p>

        <div className="landing-cta-row">
          <Link href="/dashboard" className="landing-btn-primary">
            Start chatting
          </Link>
          <Link href="/dashboard" className="landing-btn-secondary">
            View dashboard <ArrowRight size={14} strokeWidth={1.75} />
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section landing-section--alt">
        <div className="landing-container">
          <p className="landing-label">Capabilities</p>
          <h2 className="landing-h2">Retrieval, not generation.</h2>
          <p className="landing-body landing-body--wide">
            Unlike general-purpose AI, Stark only answers using the data you provide. 
            No invented facts, no hallucinations—just grounded retrieval.
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

      {/* ── Pipeline ── */}
      <section className="landing-section">
        <div className="landing-container">
          <p className="landing-label">The pipeline</p>
          <h2 className="landing-h2">From upload to answer in seconds.</h2>
          <p className="landing-body landing-body--wide">
            Each stage is optimized for speed and accuracy: multilingual embeddings, 
            serverless vector storage, and lightning-fast inference.
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

      {/* ── Stack ── */}
      <section className="landing-section landing-section--alt landing-section--compact">
        <div className="landing-container landing-stack-bar">
          <span className="landing-stack-bar__label">Technology stack</span>
          {STACK.map((tech) => (
            <span key={tech} className="landing-stack-bar__tech">{tech}</span>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="landing-section landing-footer-cta">
        <div className="landing-container" style={{ textAlign: "center" }}>
          <p className="landing-label">Get started</p>
          <h2 className="landing-h2 landing-h2--center">
            Stop searching. Start asking.
          </h2>
          <p className="landing-footer-sub">
            The assistant is ready to index your documents. 
            Every answer comes with a verifiable source.
          </p>
          <Link href="/dashboard" className="landing-btn-primary landing-btn-primary--lg">
            Launch Assistant
          </Link>
        </div>
      </section>
    </div>
  );
}
