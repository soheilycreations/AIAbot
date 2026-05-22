"use client";

import { useState, useEffect, useRef } from "react";
import { BookOpen, Plus, Trash2, Pencil, Check, X, Tag, ToggleLeft, ToggleRight, Upload, FileText, File, AlertCircle } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const SHOP_ID = "shop_123";

export default function KnowledgeBasePage() {
  const [faqs, setFaqs]           = useState([]);
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]           = useState({ question: "", answer: "", keywords: "" });
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [activeTab, setActiveTab] = useState("faqs");
  const fileRef = useRef();

  useEffect(() => { fetchFaqs(); fetchShop(); fetchDocs(); }, []);

  async function fetchFaqs() {
    setLoading(true);
    const res = await fetch(`${BACKEND_URL}/api/faqs?shopId=${SHOP_ID}`);
    setFaqs(await res.json());
    setLoading(false);
  }

  async function fetchDocs() {
    const res = await fetch(`${BACKEND_URL}/api/docs?shopId=${SHOP_ID}`);
    setDocs(await res.json());
  }

  async function fetchShop() {
    const res = await fetch(`${BACKEND_URL}/api/shop/${SHOP_ID}`);
    const data = await res.json();
    setAutoReply(data.auto_reply);
  }

  async function toggleAutoReply() {
    const newVal = !autoReply;
    setAutoReply(newVal);
    await fetch(`${BACKEND_URL}/api/shop/${SHOP_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_reply: newVal }),
    });
  }

  async function saveFaq() {
    if (!form.question || !form.answer) return;
    setSaving(true);
    const keywords = form.keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
    const url    = editingId ? `${BACKEND_URL}/api/faqs/${editingId}` : `${BACKEND_URL}/api/faqs`;
    const method = editingId ? "PATCH" : "POST";
    const body   = editingId
      ? { question: form.question, answer: form.answer, keywords }
      : { shop_id: SHOP_ID, question: form.question, answer: form.answer, keywords };

    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setForm({ question: "", answer: "", keywords: "" });
    setShowForm(false); setEditingId(null); setSaving(false);
    fetchFaqs();
  }

  async function deleteFaq(id) {
    if (!confirm("Delete this FAQ?")) return;
    await fetch(`${BACKEND_URL}/api/faqs/${id}`, { method: "DELETE" });
    fetchFaqs();
  }

  async function toggleActive(faq) {
    await fetch(`${BACKEND_URL}/api/faqs/${faq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !faq.is_active }),
    });
    fetchFaqs();
  }

  function startEdit(faq) {
    setForm({ question: faq.question, answer: faq.answer, keywords: (faq.keywords || []).join(", ") });
    setEditingId(faq.id); setShowForm(true);
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("shopId", SHOP_ID);

    try {
      const res  = await fetch(`${BACKEND_URL}/api/docs/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadMsg({ type: "success", text: `✅ "${file.name}" uploaded! ${data.doc.content_length} characters extracted.` });
        fetchDocs();
      } else {
        setUploadMsg({ type: "error", text: `❌ ${data.error}` });
      }
    } catch (err) {
      setUploadMsg({ type: "error", text: "❌ Upload failed. Try again." });
    }
    setUploading(false);
    fileRef.current.value = "";
  }

  async function deleteDoc(id) {
    if (!confirm("Delete this document?")) return;
    await fetch(`${BACKEND_URL}/api/docs/${id}`, { method: "DELETE" });
    fetchDocs();
  }

  function fileIcon(fileType) {
    if (fileType?.includes("pdf")) return "📄";
    if (fileType?.includes("word") || fileType?.includes("document")) return "📝";
    if (fileType?.includes("sheet") || fileType?.includes("excel")) return "📊";
    return "📃";
  }

  return (
    <div className="px-8 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-5 w-5 text-purple-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Knowledge Base</h1>
          </div>
          <p className="text-sm text-slate-400">Train your AI bot with FAQs and business documents</p>
        </div>
        <button
          onClick={toggleAutoReply}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition-all
            ${autoReply ? "bg-green-900/30 border-green-700/40 text-green-300" : "bg-white/5 border-white/10 text-slate-400"}`}
        >
          {autoReply ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          Auto-Reply {autoReply ? "ON" : "OFF"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 glass rounded-xl p-1 w-fit">
        {[
          { id: "faqs", label: "FAQs", count: faqs.length },
          { id: "docs", label: "Documents", count: docs.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all
              ${activeTab === tab.id ? "bg-purple-600/30 text-purple-300" : "text-slate-400 hover:text-slate-200"}`}
          >
            {tab.label}
            <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── FAQs Tab ── */}
      {activeTab === "faqs" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm({ question: "", answer: "", keywords: "" }); }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" /> Add FAQ
            </button>
          </div>

          {showForm && (
            <div className="glass rounded-2xl p-6 mb-4 border border-purple-700/30 animate-fade-in">
              <h2 className="text-sm font-bold text-white mb-4">{editingId ? "Edit FAQ" : "New FAQ"}</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Question</label>
                  <input value={form.question} onChange={e => setForm({...form, question: e.target.value})}
                    placeholder="e.g. What are your prices?"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Answer</label>
                  <textarea value={form.answer} onChange={e => setForm({...form, answer: e.target.value})}
                    placeholder="e.g. Our prices start from Rs. 5,000..."
                    rows={3} className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">
                    Keywords <span className="text-slate-600 font-normal">(comma separated)</span>
                  </label>
                  <input value={form.keywords} onChange={e => setForm({...form, keywords: e.target.value})}
                    placeholder="price, cost, how much"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={saveFaq} disabled={saving} className="btn-primary">
                    <Check className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-ghost">
                    <X className="h-4 w-4" /> Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16 text-slate-600 text-sm">Loading…</div>
          ) : faqs.length === 0 ? (
            <div className="glass rounded-2xl px-6 py-12 flex flex-col items-center text-center">
              <BookOpen className="h-8 w-8 text-slate-600 mb-3" />
              <p className="text-sm text-slate-500">No FAQs yet — add your first one above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {faqs.map(faq => (
                <div key={faq.id} className={`glass rounded-2xl px-5 py-4 ${!faq.is_active ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white mb-1">{faq.question}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{faq.answer}</p>
                      {faq.keywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {faq.keywords.map(kw => (
                            <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-purple-900/40 border border-purple-700/30 px-2 py-0.5 text-[10px] text-purple-300">
                              <Tag className="h-2.5 w-2.5" />{kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => toggleActive(faq)}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border transition-all
                          ${faq.is_active ? "bg-green-900/30 border-green-700/30 text-green-400" : "bg-white/5 border-white/10 text-slate-500"}`}>
                        {faq.is_active ? "Active" : "Inactive"}
                      </button>
                      <button onClick={() => startEdit(faq)} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteFaq(faq.id)} className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Documents Tab ── */}
      {activeTab === "docs" && (
        <>
          {/* Upload area */}
          <div
            onClick={() => fileRef.current.click()}
            className="glass rounded-2xl border-2 border-dashed border-white/10 hover:border-purple-500/40 p-8 flex flex-col items-center cursor-pointer transition-all duration-200 hover:bg-purple-900/10 mb-4"
          >
            <Upload className="h-8 w-8 text-purple-400 mb-3" />
            <p className="text-sm font-semibold text-white mb-1">Upload Business Documents</p>
            <p className="text-xs text-slate-500">PDF, Word (.docx), Excel (.xlsx), CSV, TXT — max 10MB</p>
            <p className="text-xs text-slate-600 mt-1">AI will read and learn from these files automatically</p>
            {uploading && <p className="text-xs text-yellow-400 mt-3 animate-pulse">Uploading and extracting text…</p>}
          </div>

          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
            onChange={handleFileUpload} />

          {uploadMsg && (
            <div className={`rounded-xl px-4 py-3 text-xs mb-4 flex items-center gap-2
              ${uploadMsg.type === "success" ? "bg-green-900/30 border border-green-700/30 text-green-300" : "bg-red-900/30 border border-red-700/30 text-red-300"}`}>
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {uploadMsg.text}
            </div>
          )}

          {docs.length === 0 ? (
            <div className="glass rounded-2xl px-6 py-12 flex flex-col items-center text-center">
              <FileText className="h-8 w-8 text-slate-600 mb-3" />
              <p className="text-sm text-slate-500">No documents uploaded yet</p>
              <p className="text-xs text-slate-600 mt-1">Upload your product catalog, price list, or any business document</p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map(doc => (
                <div key={doc.id} className="glass rounded-2xl px-5 py-4 animate-fade-in">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{fileIcon(doc.file_type)}</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{doc.file_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{doc.content_length?.toLocaleString()} characters extracted</p>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">{doc.preview}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteDoc(doc.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer stats */}
      <div className="mt-4 glass rounded-xl px-5 py-3 flex items-center gap-6 text-xs text-slate-600">
        <span>FAQs: <span className="text-slate-400">{faqs.filter(f=>f.is_active).length} active</span></span>
        <span>Documents: <span className="text-slate-400">{docs.length}</span></span>
        <span>Auto-Reply: <span className={autoReply ? "text-green-400" : "text-red-400"}>{autoReply ? "Enabled" : "Disabled"}</span></span>
      </div>
    </div>
  );
}
