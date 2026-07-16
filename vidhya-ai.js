import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../../Layout/PageLayout";
import ThemeToggle from "../../ThemeToggle/ThemeToggle";
import {
  KeyRound,
  MessageCircle,
  Volume2,
  VolumeX,
  Target,
  Camera,
  Dna,
  Atom,
  FlaskConical,
  Calculator,
  BookOpen,
  AlertTriangle,
  X,
  Menu,
  Search,
  History,
  Trash2,
} from "lucide-react";
import "./vidya.css";
import { GROQ_KEY_STORAGE, DEFAULT_GROQ_API_KEY } from "../../../services/api";

// ── ✅ FIXED: Dynamic Asset Imports with correct relative paths and filenames ──
import vidyaLogoAsset from "../../../assets/vidya_icon.png";
import vidyaTextAsset from "../../../assets/vidya_text.png";

// ── 🔑 Groq API models (fallback chain — tries each in order) ───────────
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

// ── VIDYA — single unified AI ─────────────────────────────────────────────
const VIDYA = {
  color: "#DA7756",
  colorRGB: "218,119,86",
  examBg: "rgba(218,119,86,0.12)",
  examBorder: "rgba(218,119,86,0.35)",
  pitch: 1.0,
  rate: 0.8,

  system: `You are VIDYA, an all-in-one AI tutor for Indian students preparing for NEET UG, JEE Mains, JEE Advanced, and Class 11-12 Board exams. You are an expert in ALL four subjects:

BIOLOGY: Botany, Zoology, Human Physiology from NCERT Class 11 & 12. Use mnemonics and simple analogies.
PHYSICS: Mechanics, Electrodynamics, Optics, Modern Physics. Reference HC Verma and DC Pandey. Give JEE tricks and step-by-step solutions.
CHEMISTRY: Organic, Inorganic, and Physical Chemistry. Make reactions easy with story-like explanations. Reference NCERT and P. Bahadur.
MATHEMATICS: Calculus, Algebra, Coordinate Geometry, Trigonometry, Probability. Give shortcuts and JEE solving tricks.

When a student asks about any topic, automatically detect which subject it belongs to and answer as an expert in that subject. Always mention the relevant NCERT chapter. Be warm, patient, encouraging, and speak in simple clear Indian English like a friendly teacher talking directly to the student.

If the student sends a photo of a question, diagram, circuit, equation, or textbook page — read it carefully and explain or solve it completely.

STRICT RULES: Never use markdown, asterisks, bullet points, dashes, headers, or table symbols. Never use *, **, #, -, or |. Write ONLY in plain flowing sentences and short paragraphs, exactly like a teacher speaking out loud to a student.`,

  greeting: "HI! I am VIDYA your AI tutor",

  subjects: ["Biology", "Physics", "Chemistry", "Mathematics"],
};

// ── Chat modes ────────────────────────────────────────────────────────────
// "all"       — VIDYA's normal all-subjects tutor (default).
// "examOnly"  — locked to NEET / JEE exam preparation only.
// "stateBoard"— locked to State Board school syllabus only.
const MODES = {
  all: {
    label: "All Subjects",
    system: VIDYA.system,
  },
  examOnly: {
    label: "JEE & NEET",
    system: `You are VIDYA, an AI tutor strictly dedicated to NEET UG, JEE Mains, and JEE Advanced exam preparation. You cover Physics, Chemistry, Biology (NEET) and Physics, Chemistry, Mathematics (JEE) at the Class 11-12 level, referencing NCERT plus standard reference books like HC Verma, DC Pandey, and P. Bahadur.

You must ONLY answer questions that relate to NEET or JEE preparation: subject concepts, numericals, previous year questions, exam strategy, syllabus, and revision. If a student asks anything outside NEET/JEE preparation (general chit-chat, unrelated exams, State Board-only topics, or anything unrelated to Physics, Chemistry, Biology, or Mathematics), politely say that this mode is dedicated to NEET & JEE only and ask them to switch to "All Subjects" or "State Board" mode for that.

Be warm, patient, and encouraging, and speak in simple clear Indian English like a friendly teacher talking directly to the student. If the student sends a photo of a question, diagram, or equation, read it carefully and solve it completely.

STRICT RULES: Never use markdown, asterisks, bullet points, dashes, headers, or table symbols. Never use *, **, #, -, or |. Write ONLY in plain flowing sentences and short paragraphs, exactly like a teacher speaking out loud to a student.`,
  },
  stateBoard: {
    label: "State Board",
    system: `You are VIDYA, an AI tutor strictly dedicated to State Board school syllabus, from Class 6 to Class 12. You help with the subjects taught under state board curricula (Tamil Nadu, and other Indian state boards) — Science, Mathematics, Social Science, and Languages — explained at the level and pace of regular school lessons rather than competitive-exam depth.

You must ONLY answer questions that relate to the State Board school syllabus. If a student asks a NEET or JEE level competitive-exam question, or anything unrelated to school State Board subjects, politely say that this mode is dedicated to State Board syllabus only and ask them to switch to "JEE & NEET" or "All Subjects" mode for that.

Be warm, patient, and encouraging, and speak in simple clear Indian English like a friendly school teacher talking directly to the student. If the student sends a photo of a textbook page or question, read it carefully and explain it completely.

STRICT RULES: Never use markdown, asterisks, bullet points, dashes, headers, or table symbols. Never use *, **, #, -, or |. Write ONLY in plain flowing sentences and short paragraphs, exactly like a teacher speaking out loud to a student.`,
  },
};

// ── Helper: convert File to base64 ────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Chat/search history entries older than this are dropped automatically.
const HISTORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

function pruneOldHistory(list) {
  const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
  return (list || []).filter((h) => (h.ts || 0) >= cutoff);
}

// ── Component ──────────────────────────────────────────────────────────────
export default function VIDYAPage({ userName, onLogout }) {
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoVoice, setAutoVoice] = useState(false);
  const [chatHistory, setChatHistory] = useState([]); // Groq-native format: [{role:"user"|"assistant", content: [...]}]
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKey, setApiKey] = useState(
    localStorage.getItem(GROQ_KEY_STORAGE) || DEFAULT_GROQ_API_KEY || "",
  );
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState("all"); // "all" | "examOnly" | "stateBoard"
  const [justAsked, setJustAsked] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("vidya_search_history") || "[]",
      );
      const fresh = pruneOldHistory(stored);
      if (fresh.length !== stored.length) {
        // Some entries were older than a week — persist the trimmed list immediately.
        try {
          localStorage.setItem("vidya_search_history", JSON.stringify(fresh));
        } catch {}
      }
      return fresh;
    } catch {
      return [];
    }
  });
  const pulseTimeoutRef = useRef(null);

  const fileInputRef = useRef(null);
  const chatboxRef = useRef(null);
  const mouthIntervalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatboxRef.current)
      chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setMessages([{ role: "greeting", text: VIDYA.greeting, id: Date.now() }]);
  }, []);

  // Stop speech when VIDYA AI is closed / unmounted
  useEffect(() => {
    const mouthInterval = mouthIntervalRef.current;
    const pulseTimeout = pulseTimeoutRef.current;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      clearInterval(mouthInterval);
      clearTimeout(pulseTimeout);
    };
  }, []);

  useEffect(() => {
    if (!apiKey) setShowKeyPrompt(true);
    else setShowKeyPrompt(false);
  }, [apiKey]);

  function switchMode(next) {
    if (next === mode) return;
    setMode(next);
    setMessages((prev) => [
      ...prev,
      {
        role: "greeting",
        text: `Switched to ${MODES[next].label} mode. ${
          next === "all"
            ? "Ask me anything across Biology, Physics, Chemistry, or Maths."
            : `I'll now only answer questions related to ${MODES[next].label}.`
        }`,
        id: Date.now(),
      },
    ]);
  }

  function saveApiKey() {
    const k = apiKeyInput.replace(/[^\x20-\x7E]/g, "").trim();
    if (!k) return;
    localStorage.setItem("vidya_groq_key", k);
    setApiKey(k);
    setApiKeyInput("");
  }

  // ── Image upload ──────────────────────────────────────────────────────
  async function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image too large. Please use under 5MB.");
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setUploadedImage({
        base64,
        mimeType: file.type,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      });
    } catch {
      alert("Could not read image. Please try again.");
    }
    e.target.value = "";
  }

  function removeImage() {
    if (uploadedImage?.previewUrl)
      URL.revokeObjectURL(uploadedImage.previewUrl);
    setUploadedImage(null);
  }

  // ── Search history (persisted so past questions can be found again) ────
  // Entries older than one week are dropped automatically, both on load and
  // whenever a new entry is added, so the list never carries stale content.
  function addToSearchHistory(text) {
    if (!text?.trim()) return;
    setSearchHistory((prev) => {
      const deduped = pruneOldHistory(prev).filter(
        (h) => h.text.toLowerCase() !== text.trim().toLowerCase(),
      );
      const next = [
        { id: Date.now(), text: text.trim(), ts: Date.now() },
        ...deduped,
      ].slice(0, 50);
      try {
        localStorage.setItem("vidya_search_history", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function clearSearchHistory() {
    setSearchHistory([]);
    try {
      localStorage.removeItem("vidya_search_history");
    } catch {}
  }

  const filteredHistory = historyQuery.trim()
    ? searchHistory.filter((h) =>
        h.text.toLowerCase().includes(historyQuery.trim().toLowerCase()),
      )
    : searchHistory;

  // ── Voice ─────────────────────────────────────────────────────────────
  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_#`]/g, "").replace(/\n+/g, ". ");
    const u = new SpeechSynthesisUtterance(clean);
    u.pitch = VIDYA.pitch;
    u.rate = VIDYA.rate;
    u.volume = 1;
    const voices = window.speechSynthesis.getVoices() || [];
    const en = voices.filter((v) => /en/i.test(v.lang));
    const voice = en.find((v) => /female/i.test(v.name)) || en[0] || voices[0];
    if (voice) u.voice = voice;
    u.onstart = startMouth;
    u.onend = stopMouth;
    u.onerror = stopMouth;
    window.speechSynthesis.speak(u);
  }

  function startMouth() {
    const logo = document.getElementById("vidya-logo-wrap");
    if (logo) logo.classList.add("speaking");
  }

  function stopMouth() {
    clearInterval(mouthIntervalRef.current);
    const logo = document.getElementById("vidya-logo-wrap");
    if (logo) logo.classList.remove("speaking");
  }

  // ── Try one Groq model ────────────────────────────────────────────────
  async function tryModel(model, messagesPayload, systemPrompt) {
    const cleanKey = apiKey.replace(/[^\x20-\x7E]/g, "").trim();
    const res = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt || VIDYA.system },
          ...messagesPayload,
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `API error ${res.status}`;
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        if (/api key|permission|unauthorized|invalid/i.test(msg)) {
          setShowKeyPrompt(true);
          setApiKey("");
          localStorage.removeItem("vidya_groq_key");
          throw new Error("__AUTH__:" + msg);
        }
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("Empty response");
    return raw;
  }

  // ── Send message with fallback across Groq models ────────────────────
  async function sendMessage(overrideText) {
    if (busy) return;
    const text = (overrideText || input).trim();
    const hasImage = !!uploadedImage;
    if (!text && !hasImage) return;
    if (!apiKey) {
      setShowKeyPrompt(true);
      return;
    }

    setInput("");
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: text || "(image sent)",
        imagePreview: hasImage ? uploadedImage.previewUrl : null,
        id: Date.now(),
      },
    ]);
    if (text) addToSearchHistory(text);

    const imageData = uploadedImage;
    setUploadedImage(null);
    setBusy(true);
    setSidebarOpen(false);

    // Glow pulse on the VIDYA logo right after the question is asked
    setJustAsked(true);
    clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => setJustAsked(false), 2400);

    try {
      const contentPayload = [];
      const userText =
        text ||
        (hasImage
          ? "Please explain or solve what is shown in this image."
          : "");

      if (userText) {
        contentPayload.push({ type: "text", text: userText });
      }
      if (hasImage) {
        contentPayload.push({
          type: "image_url",
          image_url: {
            url: `data:${imageData.mimeType};base64,${imageData.base64}`,
          },
        });
      }

      const messagesPayload = [
        ...chatHistory,
        { role: "user", content: contentPayload },
      ];

      let rawReply = null;
      let lastError = null;
      const systemPrompt = (MODES[mode] || MODES.all).system;

      for (const model of GROQ_MODELS) {
        try {
          rawReply = await tryModel(model, messagesPayload, systemPrompt);
          break;
        } catch (e) {
          if (e.message.startsWith("__AUTH__:")) throw e;
          lastError = e;
        }
      }

      if (!rawReply)
        throw (
          lastError ||
          new Error("All models are currently busy. Please try again.")
        );

      const reply = rawReply
        .replace(/#{1,6}\s*/g, "")
        .replace(/\*\*(.*?)\*\//g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`{1,3}[^`]*`{1,3}/g, "")
        .replace(/^\s*[-•]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/\|.*\|/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      setChatHistory((prev) =>
        [
          ...prev,
          { role: "user", content: contentPayload },
          { role: "assistant", content: reply },
        ].slice(-20),
      );

      setMessages((prev) => [
        ...prev,
        { role: "bot", text: reply, id: Date.now() },
      ]);
      if (autoVoice) speak(reply);
    } catch (e) {
      const errMsg = e.message.startsWith("__AUTH__:")
        ? "Invalid API key. Please enter your key again."
        : e.message ||
          "Connection issue. Please check your internet and try again.";
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: `⚠ ${errMsg}`, id: Date.now() },
      ]);
    }

    setBusy(false);
    inputRef.current?.focus();
  }

  const accentStyle = {
    "--vidya-accent": VIDYA.color,
    "--vidya-accent-rgb": VIDYA.colorRGB,
  };

  return (
    <PageLayout userName={userName} onLogout={onLogout}>
      <div className="vidya-root" style={accentStyle}>
        {/* ── API Key Prompt ── */}
        {showKeyPrompt && (
          <div className="vidya-key-overlay">
            <div className="vidya-key-modal">
              <div className="vidya-key-icon">
                <KeyRound size={32} />
              </div>
              <h2>Enter your Groq API Key</h2>
              <p>
                VIDYA AI now runs on Groq Cloud. Get your API key from{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                >
                  console.groq.com/keys
                </a>
                .
              </p>
              <input
                className="vidya-key-input"
                type="password"
                placeholder="Paste your Groq API key here (gsk_...)…"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveApiKey();
                }}
                autoFocus
              />
              <button
                className="vidya-key-btn"
                onClick={saveApiKey}
                style={{
                  background: `linear-gradient(135deg,${VIDYA.color},#C4623F)`,
                }}
              >
                Save & Start Chatting →
              </button>
              <p className="vidya-key-note">
                Your key is saved locally in your browser only.
              </p>
            </div>
          </div>
        )}

        {/* ── Mobile hamburger toggle ── */}
        <button
          className="vidya-mobile-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? "Close menu" : "Open menu"}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* ── Backdrop for mobile drawer ── */}
        {sidebarOpen && (
          <div
            className="vidya-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Sidebar ── */}
        <aside className={`vidya-sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="vidya-sidebar-top">
            {/* ── Brand Layout ── */}
            <div
              className="vidya-brand"
              onClick={() => navigate("/home")}
              style={{ cursor: "pointer" }}
            >
              <div className="vidya-custom-brand-logo-wrap">
                <img
                  src={vidyaLogoAsset}
                  alt="VIDYA Geometric Icon"
                  className="vidya-custom-brand-logo-img"
                />
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "3px" }}
              >
                <img
                  src={vidyaTextAsset}
                  alt="VIDYA Text"
                  style={{
                    height: "70px",
                    objectFit: "contain",
                    alignSelf: "flex-start",
                    display: "block",
                  }}
                />
                <div className="vidya-brand-sub">All-in-One AI Tutor</div>
              </div>
            </div>

            {/* Exam badges */}
            <div className="vidya-exam-row">
              <span className="vidya-badge badge-neet">NEET</span>
              <span className="vidya-badge badge-jeem">JEE Mains</span>
              <span className="vidya-badge badge-jeea">JEE Adv</span>
              <span className="vidya-badge badge-board">Boards</span>
            </div>

            {/* Avatar */}
            <div className="vidya-avatar-stage">
              <div
                className="vidya-stage-bg"
                style={{
                  background: `radial-gradient(ellipse at 50% 110%, rgba(${VIDYA.colorRGB},0.2) 0%, transparent 65%)`,
                }}
              />
              <div
                className="vidya-stage-glow"
                style={{ background: `rgba(${VIDYA.colorRGB},0.25)` }}
              />
              <div
                className={`vidya-avatar-wrap${busy ? " thinking" : ""}${justAsked ? " pulse-glow" : ""}`}
                id="vidya-logo-wrap"
              >
                <img
                  src={vidyaLogoAsset}
                  alt="VIDYA"
                  className="vidya-avatar-logo-img"
                />
              </div>
            </div>

            {/* VIDYA info */}
            <div className="vidya-teacher-info">
              <span
                className="vidya-role-tag"
                style={{ background: VIDYA.examBg, color: VIDYA.color }}
              >
                All Subjects · NEET &amp; JEE
              </span>
              <div className="vidya-subject-chips">
                {VIDYA.subjects.map((s) => (
                  <span key={s} className="vidya-chip">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="vidya-divider" />

          {/* Search history */}
          <div className="vidya-history-wrap">
            <div className="vidya-history-label-row">
              <span className="vidya-qt-label">
                <History
                  size={12}
                  style={{ verticalAlign: "-2px", marginRight: 5 }}
                />
                SEARCH HISTORY
              </span>
              {searchHistory.length > 0 && (
                <button
                  className="vidya-history-clear"
                  title="Clear history"
                  onClick={clearSearchHistory}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <div className="vidya-history-search-box">
              <Search size={14} className="vidya-history-search-icon" />
              <input
                className="vidya-history-search-input"
                type="text"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Search your past questions…"
              />
              {historyQuery && (
                <button
                  className="vidya-history-search-clear"
                  onClick={() => setHistoryQuery("")}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="vidya-history-list">
              {filteredHistory.length === 0 ? (
                <div className="vidya-history-empty">
                  {searchHistory.length === 0
                    ? "Questions you ask will show up here."
                    : "No matching questions found."}
                </div>
              ) : (
                filteredHistory.map((h) => (
                  <button
                    key={h.id}
                    className="vidya-qt-btn"
                    onClick={() => sendMessage(h.text)}
                  >
                    <MessageCircle
                      size={14}
                      style={{
                        verticalAlign: "-2px",
                        marginRight: 6,
                        flexShrink: 0,
                      }}
                    />
                    {h.text}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="vidya-divider" />

          {/* API key is managed from the Dashboard now */}
          {apiKey && (
            <div className="vidya-voice-wrap">
              <button
                className="vidya-voice-btn"
                onClick={() => navigate("/home")}
                title="Change your API key from the Dashboard"
              >
                <KeyRound
                  size={14}
                  style={{ verticalAlign: "-2px", marginRight: 6 }}
                />
                Manage API Key in Dashboard
              </button>
            </div>
          )}
        </aside>

        {/* ── Chat main ── */}
        <main className="vidya-chat-main">
          {/* Mode switch — restricts VIDYA's answers to the selected scope */}
          <div className="flex flex-wrap gap-2 py-2.5 px-4 border-b border-border bg-bg-secondary">
            {Object.entries(MODES).map(([key, m]) => (
              <button
                key={key}
                onClick={() => switchMode(key)}
                title={
                  key === "all"
                    ? "Ask about any subject"
                    : `Answers restricted to ${m.label} only`
                }
                className={`rounded-token_pill py-1.5 px-3.5 text-[12.5px] font-bold whitespace-nowrap cursor-pointer transition-all border ${
                  mode === key
                    ? "text-white border-transparent"
                    : "bg-surface text-text-muted border-border hover:text-text hover:border-border-strong"
                }`}
                style={
                  mode === key
                    ? {
                        background: `linear-gradient(135deg,${VIDYA.color},#C4623F)`,
                      }
                    : undefined
                }
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Header */}
          <div className="vidya-chat-header">
            <div>
              <div className="vidya-chat-header-name">VIDYA — AI Tutor</div>
              <div className="vidya-status-dot">
                {apiKey ? (
                  "Online · Ready to teach all subjects"
                ) : (
                  <>
                    <AlertTriangle
                      size={12}
                      style={{ verticalAlign: "-1px", marginRight: 4 }}
                    />
                    API key needed
                  </>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ThemeToggle />
              <button
                onClick={() => {
                  if (autoVoice && window.speechSynthesis)
                    window.speechSynthesis.cancel();
                  setAutoVoice((v) => !v);
                }}
                title={
                  autoVoice
                    ? "Auto-Speak ON — click to turn off"
                    : "Auto-Speak OFF — click to turn on"
                }
                style={{
                  background: autoVoice
                    ? `linear-gradient(135deg,${VIDYA.color},#C4623F)`
                    : "var(--c-bg-tertiary, #EFEDE4)",
                  border: `1.5px solid ${autoVoice ? VIDYA.color : "var(--c-border, #E7E4D9)"}`,
                  borderRadius: "10px",
                  padding: "6px 12px",
                  cursor: "pointer",
                  color: autoVoice ? "#fff" : "var(--c-text-muted, #6B6759)",
                  fontSize: "18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s",
                }}
              >
                {autoVoice ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
              <div
                className="vidya-exam-ind"
                style={{
                  background: VIDYA.examBg,
                  color: VIDYA.color,
                  border: `1px solid ${VIDYA.examBorder}`,
                }}
              >
                {MODES[mode].label}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="vidya-chatbox" ref={chatboxRef}>
            <div
              className="vidya-welcome-card"
              style={{
                borderColor: `rgba(${VIDYA.colorRGB},0.2)`,
                background: `linear-gradient(135deg,rgba(${VIDYA.colorRGB},0.08),rgba(0,0,0,0.2))`,
              }}
            >
              <h3>
                <Target
                  size={17}
                  style={{ verticalAlign: "-3px", marginRight: 6 }}
                />
                Your All-in-One NEET &amp; JEE Tutor
              </h3>
              <p>
                Ask me any doubt in Biology, Physics, Chemistry, or Maths. You
                can also{" "}
                <strong>
                  <Camera
                    size={14}
                    style={{ verticalAlign: "-2px", marginRight: 3 }}
                  />
                  send a photo
                </strong>{" "}
                of any question or diagram!
              </p>
              <div className="vidya-w-tags">
                <span className="vidya-w-tag">
                  <Dna
                    size={13}
                    style={{ verticalAlign: "-2px", marginRight: 4 }}
                  />
                  Biology
                </span>
                <span className="vidya-w-tag">
                  <Atom
                    size={13}
                    style={{ verticalAlign: "-2px", marginRight: 4 }}
                  />
                  Physics
                </span>
                <span className="vidya-w-tag">
                  <FlaskConical
                    size={13}
                    style={{ verticalAlign: "-2px", marginRight: 4 }}
                  />
                  Chemistry
                </span>
                <span className="vidya-w-tag">
                  <Calculator
                    size={13}
                    style={{ verticalAlign: "-2px", marginRight: 4 }}
                  />
                  Mathematics
                </span>
                <span className="vidya-w-tag">
                  <BookOpen
                    size={13}
                    style={{ verticalAlign: "-2px", marginRight: 4 }}
                  />
                  NCERT Based
                </span>
                <span className="vidya-w-tag">
                  <Camera
                    size={13}
                    style={{ verticalAlign: "-2px", marginRight: 4 }}
                  />
                  Image Support
                </span>
              </div>
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`vidya-msg ${msg.role === "user" ? "user" : "bot"}`}
                style={
                  msg.role === "user"
                    ? {
                        background: `linear-gradient(135deg,${VIDYA.color},#C4623F)`,
                      }
                    : {}
                }
              >
                {msg.imagePreview && (
                  <img
                    src={msg.imagePreview}
                    alt="uploaded"
                    style={{
                      display: "block",
                      maxWidth: "220px",
                      maxHeight: "180px",
                      borderRadius: "8px",
                      marginBottom:
                        msg.text && msg.text !== "(image sent)" ? "8px" : "0",
                      objectFit: "contain",
                      background: "rgba(255,255,255,0.1)",
                    }}
                  />
                )}
                {msg.text &&
                  msg.text !== "(image sent)" &&
                  (msg.text.startsWith("⚠ ") ? (
                    <>
                      <AlertTriangle
                        size={14}
                        style={{ verticalAlign: "-2px", marginRight: 6 }}
                      />
                      {msg.text.slice(2)}
                    </>
                  ) : (
                    msg.text
                  ))}
              </div>
            ))}

            {busy && (
              <div className="vidya-msg bot vidya-thinking-row">
                <span className="vidya-thinking-avatar-wrap">
                  <img
                    src={vidyaLogoAsset}
                    alt=""
                    className="vidya-thinking-avatar"
                  />
                </span>
                <span className="vidya-thinking-text">VIDYA is thinking…</span>
              </div>
            )}
          </div>

          {/* Image preview bar */}
          {uploadedImage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 14px",
                maxWidth: "760px",
                width: "100%",
                margin: "0 auto",
                background: "var(--c-bg-tertiary, #EFEDE4)",
                borderTop: "1px solid var(--c-border, #E7E4D9)",
              }}
            >
              <img
                src={uploadedImage.previewUrl}
                alt="preview"
                style={{
                  width: "56px",
                  height: "56px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: `2px solid ${VIDYA.color}`,
                }}
              />
              <div
                style={{
                  flex: 1,
                  fontSize: "12px",
                  color: "var(--c-text-muted, #6B6759)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <Camera
                  size={13}
                  style={{ verticalAlign: "-2px", marginRight: 4 }}
                />
                {uploadedImage.name}
              </div>
              <button
                onClick={removeImage}
                style={{
                  background: "var(--c-surface, #fff)",
                  border: "1px solid var(--c-border, #E7E4D9)",
                  borderRadius: "50%",
                  width: "26px",
                  height: "26px",
                  cursor: "pointer",
                  color: "var(--c-text-muted, #6B6759)",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="vidya-input-area">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageSelect}
            />

            <button
              title="Send a photo of your question or diagram"
              onClick={() => fileInputRef.current?.click()}
              disabled={!apiKey}
              style={{
                background: uploadedImage
                  ? `linear-gradient(135deg,${VIDYA.color},#C4623F)`
                  : "var(--c-surface, #fff)",
                border: `1.5px solid ${uploadedImage ? VIDYA.color : "var(--c-border, #E7E4D9)"}`,
                borderRadius: "50%",
                padding: "0 12px",
                height: "46px",
                width: "46px",
                cursor: apiKey ? "pointer" : "not-allowed",
                fontSize: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.2s",
                color: uploadedImage ? "#fff" : "var(--c-text-muted, #6B6759)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <Camera size={19} />
            </button>

            <input
              ref={inputRef}
              className="vidya-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                uploadedImage
                  ? "Add a question about this image (optional)…"
                  : apiKey
                    ? "Ask any Biology, Physics, Chemistry or Maths doubt… or send a photo"
                    : "Enter API key to start chatting…"
              }
              style={{ "--focus-color": VIDYA.color }}
              disabled={!apiKey}
            />

            <button
              className="vidya-send-btn"
              style={{
                background: `linear-gradient(135deg,${VIDYA.color},#C4623F)`,
              }}
              onClick={() => sendMessage()}
              disabled={busy || !apiKey || (!input.trim() && !uploadedImage)}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="#fff">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </main>
      </div>
    </PageLayout>
  );
}
