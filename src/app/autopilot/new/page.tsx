'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Rocket, Plus, Loader, Check, AlertTriangle, Sparkles, Search } from 'lucide-react';
import Link from 'next/link';

type Step = 'basics' | 'program' | 'done';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function NewAutopilotProductPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('basics');
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);
  
  const fallbackProductProgram = `# Product Requirements Document

## Overview

## Objectives:

## Features:

## Reference Urls:

## Visual References:`;

  const [generatingProgram, setGeneratingProgram] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(120);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    repo_url: '',
    live_url: '',
    source_code_path: '',
    local_deploy_path: '',
    icon: '🚀',
    product_program: '',
    build_mode: 'plan_first' as 'plan_first' | 'auto_build',
    default_branch: 'main',
    workspace_id: '',
  });

  const icons = ['🚀', '🤖', '⚡', '🔥', '💡', '🎯', '📊', '🔧', '🌟', '🎨'];

  useEffect(() => {
    fetch('/api/workspaces')
      .then(res => res.json())
      .then((data: Workspace[]) => {
        setWorkspaces(data);
        if (data.length > 0) {
          setForm(f => f.workspace_id ? f : { ...f, workspace_id: data[0].id });
        }
      })
      .catch(err => console.error('Failed to load workspaces:', err))
      .finally(() => setWorkspacesLoading(false));
  }, []);

  const handleScan = async (url: string) => {
    if (!isValidUrl(url)) return;
    setScanning(true);
    setScanError(null);

    try {
      const res = await fetch('/api/products/scan-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Scan failed' }));
        setScanError(data.error || `Scan failed (${res.status})`);
        return;
      }

      const { name, description } = await res.json();
      setForm(f => ({
        ...f,
        name: f.name || name || f.name,
        description: f.description || description || f.description,
      }));
    } catch (error) {
      setScanError('Failed to connect to scan service');
    } finally {
      setScanning(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!form.repo_url && !form.live_url) return;
    setGeneratingDesc(true);
    setDescError(null);
    try {
      const res = await fetch('/api/products/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: form.repo_url, live_url: form.live_url, name: form.name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Generation failed' }));
        setDescError(data.error || `Failed (${res.status})`);
        return;
      }
      const { description } = await res.json();
      if (description) {
        setForm(f => ({ ...f, description }));
      }
    } catch {
      setDescError('Failed to generate description.');
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/autopilot/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const product = await res.json();
        setProductId(product.id);
        setStep('program');
      }
    } catch (error) {
      console.error('Failed to create product:', error);
    } finally {
      setSaving(false);
    }
  };

  const generateSuggestedProgram = async () => {
    setGeneratingProgram(true);
    setGenerationSeconds(120);
    setGenerationError(null);
    setForm(f => ({ ...f, product_program: '' }));

    try {
      const res = await fetch('/api/autopilot/products/generate-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          repo_url: form.repo_url,
          live_url: form.live_url,
          source_code_path: form.source_code_path,
          local_deploy_path: form.local_deploy_path,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const suggested = typeof data?.suggestedProgram === 'string' && data.suggestedProgram.trim()
        ? data.suggestedProgram
        : fallbackProductProgram;

      if (data.source?.startsWith?.('fallback')) {
        setGenerationError(data.source === 'fallback:timeout' ? 'Timeout — no response from Gateway' : 'Gateway error — using fallback');
      }

      setForm(f => ({ ...f, product_program: suggested }));
    } catch {
      setGenerationError('Connection error — using fallback');
      setForm(f => ({ ...f, product_program: fallbackProductProgram }));
    } finally {
      setGeneratingProgram(false);
    }
  };

  // NOTE: Auto-generation removed — now user-initiated via "Auto-generation" button

  useEffect(() => {
    if (!generatingProgram) return;
    const t = setInterval(() => {
      setGenerationSeconds((s) => {
        if (s <= 1) {
          clearInterval(t);
          // On timeout, leave the textarea empty so user can fill manually or retry
          setGenerationError('Timeout — you can edit manually or try again');
          setForm(f => ({ ...f, product_program: fallbackProductProgram }));
          setGeneratingProgram(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [generatingProgram, fallbackProductProgram]);

  const handleSaveProgram = async () => {
    if (!productId) return;
    setSaving(true);
    try {
      await fetch(`/api/autopilot/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_program: form.product_program || fallbackProductProgram,
          workflow_state: 'program',
        }),
      });
      setStep('done');
    } catch (error) {
      console.error('Failed to save program:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-mc-bg">
      <header className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/autopilot" className="text-mc-text-secondary hover:text-mc-text">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Rocket className="w-5 h-5 text-mc-accent-cyan" />
            <h1 className="text-lg font-bold text-mc-text">New Autopilot Product</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {(['basics', 'program', 'done'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-mc-accent text-white' :
                (['basics', 'program', 'done'].indexOf(step) > i) ? 'bg-green-500/20 text-green-400' :
                'bg-mc-bg-tertiary text-mc-text-secondary'
              }`}>
                {(['basics', 'program', 'done'].indexOf(step) > i) ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < 2 && <div className="w-12 h-px bg-mc-border" />}
            </div>
          ))}
        </div>

        {step === 'basics' && (
          <div className="space-y-6">
            {/* Icon selector */}
            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">Icon</label>
              <div className="flex flex-wrap gap-2">
                {icons.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon: i }))}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                      form.icon === i
                        ? 'bg-mc-accent/20 border-2 border-mc-accent'
                        : 'bg-mc-bg-tertiary border border-mc-border hover:border-mc-accent/50'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">Product Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-mc-bg-tertiary border border-mc-border rounded-lg px-4 py-3 text-mc-text focus:outline-none focus:border-mc-accent"
                placeholder="My Autopilot Product"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-mc-bg-tertiary border border-mc-border rounded-lg px-4 py-3 text-mc-text focus:outline-none focus:border-mc-accent resize-none"
                rows={3}
                placeholder="What does this product do?"
              />
              {(form.repo_url || form.live_url) && (
                <div className="mt-2">
                  <button
                    onClick={handleGenerateDescription}
                    disabled={generatingDesc}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-mc-bg-tertiary border border-mc-border rounded-lg text-mc-text-secondary hover:text-mc-accent hover:border-mc-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingDesc ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {generatingDesc ? 'Generating...' : 'Auto-generate from repo & site'}
                  </button>
                  {descError && <p className="text-[11px] text-red-400 mt-1">{descError}</p>}
                </div>
              )}
            </div>

            {/* URLs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Repo URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.repo_url}
                    onChange={e => setForm(f => ({ ...f, repo_url: e.target.value }))}
                    className="flex-1 bg-mc-bg-tertiary border border-mc-border rounded-lg px-4 py-3 text-mc-text text-sm focus:outline-none focus:border-mc-accent"
                    placeholder="https://github.com/..."
                  />
                  <button
                    onClick={() => handleScan(form.repo_url)}
                    disabled={!isValidUrl(form.repo_url) || scanning}
                    className="shrink-0 px-3 py-3 bg-mc-bg-tertiary border border-mc-border rounded-lg text-mc-text-secondary hover:text-mc-text hover:border-mc-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Scan repo"
                  >
                    {scanning ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Live URL</label>
                <input
                  type="text"
                  value={form.live_url}
                  onChange={e => setForm(f => ({ ...f, live_url: e.target.value }))}
                  className="w-full bg-mc-bg-tertiary border border-mc-border rounded-lg px-4 py-3 text-mc-text text-sm focus:outline-none focus:border-mc-accent"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Local Paths */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Source-code:</label>
                <input
                  type="text"
                  value={form.source_code_path}
                  onChange={e => setForm(f => ({ ...f, source_code_path: e.target.value }))}
                  className="w-full bg-mc-bg-tertiary border border-mc-border rounded-lg px-4 py-3 text-mc-text text-sm focus:outline-none focus:border-mc-accent"
                  placeholder="C:\\path\\to\\source"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Local Deploy:</label>
                <input
                  type="text"
                  value={form.local_deploy_path}
                  onChange={e => setForm(f => ({ ...f, local_deploy_path: e.target.value }))}
                  className="w-full bg-mc-bg-tertiary border border-mc-border rounded-lg px-4 py-3 text-mc-text text-sm focus:outline-none focus:border-mc-accent"
                  placeholder="C:\\path\\to\\deploy"
                />
              </div>
            </div>

            {scanError && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {scanError}
              </div>
            )}

            {/* Workspace */}
            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">Workspace</label>
              <select
                value={form.workspace_id}
                onChange={e => setForm(f => ({ ...f, workspace_id: e.target.value }))}
                disabled={workspacesLoading}
                className="w-full bg-mc-bg-tertiary border border-mc-border rounded-lg px-4 py-3 text-mc-text focus:outline-none focus:border-mc-accent disabled:opacity-50"
              >
                {workspaces.map(w => (
                  <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                ))}
              </select>
            </div>

            {/* Default Branch */}
            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">Default Branch</label>
              <input
                type="text"
                value={form.default_branch}
                onChange={e => setForm(f => ({ ...f, default_branch: e.target.value }))}
                className="w-full bg-mc-bg-tertiary border border-mc-border rounded-lg px-4 py-3 text-mc-text focus:outline-none focus:border-mc-accent"
                placeholder="main"
              />            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleCreate}
                disabled={!form.name || saving}
                className="min-h-11 flex items-center gap-2 px-6 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Creating...</>
                ) : (
                  <>Next <ArrowLeft className="w-4 h-4 rotate-180" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'program' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-mc-text">Product Program (PRD)</label>
                <button
                  onClick={generateSuggestedProgram}
                  disabled={generatingProgram}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-mc-bg-tertiary border border-mc-border rounded-lg text-mc-text-secondary hover:text-mc-accent hover:border-mc-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generatingProgram ? (
                    <><Loader className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Auto-generation</>
                  )}
                </button>
              </div>

              {generatingProgram && (
                <div className="mb-3 rounded-lg border border-mc-accent/30 bg-mc-accent/10 px-3 py-2 flex items-center gap-3">
                  <Loader className="w-4 h-4 animate-spin text-mc-accent" />
                  <div className="flex-1">
                    <div className="text-sm text-mc-text">Generating proposal via Gateway...</div>
                    <div className="text-xs text-mc-text-secondary">Timeout in {generationSeconds}s</div>
                  </div>
                </div>
              )}

              {generationError && !generatingProgram && (
                <div className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 flex items-center gap-2 text-sm text-yellow-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{generationError}</span>
                </div>
              )}

              <textarea
                value={form.product_program}
                onChange={e => setForm(f => ({ ...f, product_program: e.target.value }))}
                placeholder={fallbackProductProgram}
                className="w-full bg-mc-bg-tertiary border border-mc-border rounded-lg px-4 py-3 text-mc-text focus:outline-none focus:border-mc-accent resize-none font-mono text-sm"
                rows={20}
              />
              <p className="text-xs text-mc-text-secondary mt-2">
                {generatingProgram
                  ? 'Waiting for Gateway response. You can still edit below if needed.'
                  : 'Tip: Click "Auto-generation" for a quick suggested draft, or fill manually.'}
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep('basics')}
                className="min-h-11 px-4 text-mc-text-secondary hover:text-mc-text"
              >
                Back
              </button>
              <button
                onClick={handleSaveProgram}
                disabled={saving || generatingProgram}
                className="min-h-11 flex items-center gap-2 px-6 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90 disabled:opacity-50"
              >
                {saving ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <>Save & Continue <ArrowLeft className="w-4 h-4 rotate-180" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Product Created!</h2>
            <p className="text-mc-text-secondary mb-6">
              Your Autopilot product is ready. The agent will start working on it soon.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/autopilot"
                className="min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary flex items-center gap-2"
              >
                Back to Products
              </Link>
              {productId && (
                <Link
                  href={`/autopilot/${productId}`}
                  className="min-h-11 flex items-center gap-2 px-6 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90"
                >
                  View Product <ArrowLeft className="w-4 h-4 rotate-180" />
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
