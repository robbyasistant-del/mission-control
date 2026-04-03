'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Github, Globe, Loader, FileText, Settings, Activity, Workflow, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface AutopilotProduct {
  id: string;
  name: string;
  description?: string;
  repo_url?: string;
  live_url?: string;
  source_code_path?: string;
  local_deploy_path?: string;
  icon?: string;
  product_program?: string;
  build_mode?: string;
  default_branch?: string;
  created_at: string;
}

type Tab = 'basics' | 'program' | 'workflow' | 'activity';
type WorkflowStep = 'program' | 'executive-summary' | 'technical-architecture' | 'implementation-roadmap' | 'sprints-tasks';

const WORKFLOW_STEPS: { id: WorkflowStep; label: string }[] = [
  { id: 'program', label: 'Product Program' },
  { id: 'executive-summary', label: 'Executive Summary' },
  { id: 'technical-architecture', label: 'Technical Architecture' },
  { id: 'implementation-roadmap', label: 'Implementation Roadmap' },
  { id: 'sprints-tasks', label: 'Sprints & Tasks' },
];

export default function AutopilotProductPage() {
  const params = useParams();
  const [product, setProduct] = useState<AutopilotProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('basics');
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<WorkflowStep>('program');
  const [editedProgram, setEditedProgram] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [params.id]);

  useEffect(() => {
    if (product?.product_program) {
      setEditedProgram(product.product_program);
    }
  }, [product?.product_program]);

  const loadProduct = async () => {
    try {
      const res = await fetch(`/api/autopilot/products/${params.id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Product not found');
        } else {
          setError('Failed to load product');
        }
        return;
      }
      const data = await res.json();
      setProduct(data);
    } catch (err) {
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProgram = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_program: editedProgram }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setProduct(prev => prev ? { ...prev, product_program: editedProgram } : null);
    } catch (err) {
      alert('Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-mc-accent" />
          <p className="text-mc-text-secondary">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Product not found'}</p>
          <Link href="/autopilot" className="text-mc-accent hover:underline">
            Back to Autopilot
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'basics', label: 'Basic Info', icon: <Settings className="w-4 h-4" /> },
    { id: 'program', label: 'Product Program', icon: <FileText className="w-4 h-4" /> },
    { id: 'workflow', label: 'Product Workflow', icon: <Workflow className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-mc-bg">
      {/* Header */}
      <header className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/autopilot" className="text-mc-text-secondary hover:text-mc-text">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="text-3xl">{product.icon || '🚀'}</span>
            <div>
              <h1 className="text-xl font-bold text-mc-text">{product.name}</h1>
              <p className="text-xs text-mc-text-secondary">Autopilot Product</p>
            </div>
          </div>
        </div>
      </header>

      {/* Horizontal Tabs */}
      <div className="border-b border-mc-border bg-mc-bg-secondary/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-mc-accent text-mc-accent'
                    : 'border-transparent text-mc-text-secondary hover:text-mc-text hover:border-mc-border'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'basics' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Basic Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide mb-3">Description</h2>
                {product.description ? (
                  <p className="text-mc-text">{product.description}</p>
                ) : (
                  <p className="text-mc-text-secondary italic">No description provided.</p>
                )}
              </div>

              {/* Paths */}
              <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide mb-4">Paths & URLs</h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-mc-bg rounded-lg border border-mc-border">
                    <Github className="w-5 h-5 text-mc-text-secondary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-mc-text-secondary">Repository</p>
                      <p className="text-sm text-mc-text truncate">{product.repo_url || 'Not set'}</p>
                    </div>
                    {product.repo_url && (
                      <a href={product.repo_url} target="_blank" rel="noopener noreferrer" className="text-mc-accent hover:text-mc-accent/80">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-mc-bg rounded-lg border border-mc-border">
                    <Globe className="w-5 h-5 text-mc-text-secondary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-mc-text-secondary">Live URL</p>
                      <p className="text-sm text-mc-text truncate">{product.live_url || 'Not set'}</p>
                    </div>
                    {product.live_url && (
                      <a href={product.live_url} target="_blank" rel="noopener noreferrer" className="text-mc-accent hover:text-mc-accent/80">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-mc-bg rounded-lg border border-mc-border">
                    <FileText className="w-5 h-5 text-mc-text-secondary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-mc-text-secondary">Source Code Path</p>
                      <p className="text-sm text-mc-text truncate">{product.source_code_path || 'Not set'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-mc-bg rounded-lg border border-mc-border">
                    <FileText className="w-5 h-5 text-mc-text-secondary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-mc-text-secondary">Local Deploy Path</p>
                      <p className="text-sm text-mc-text truncate">{product.local_deploy_path || 'Not set'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Settings */}
            <div className="space-y-6">
              <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide mb-4">Settings</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-mc-text-secondary">Build Mode</span>
                    <span className="text-mc-text capitalize">{product.build_mode?.replace('_', ' ') || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-mc-text-secondary">Default Branch</span>
                    <span className="text-mc-text">{product.default_branch || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-mc-text-secondary">Created</span>
                    <span className="text-mc-text">
                      {new Date(product.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'program' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide">Product Program (PRD)</h2>
                <button
                  onClick={handleSaveProgram}
                  disabled={saving}
                  className="px-4 py-2 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
              <textarea
                value={editedProgram}
                onChange={(e) => setEditedProgram(e.target.value)}
                placeholder="# Product Requirements Document..."
                className="w-full h-[60vh] bg-mc-bg border border-mc-border rounded-lg p-4 text-sm font-mono text-mc-text focus:outline-none focus:border-mc-accent resize-none"
              />
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="space-y-6">
            {/* Workflow Progress Bar */}
            <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-4">
              <div className="flex items-center gap-2 overflow-x-auto">
                {WORKFLOW_STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center shrink-0">
                    <button
                      onClick={() => setActiveWorkflowStep(step.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeWorkflowStep === step.id
                          ? 'bg-mc-accent text-mc-bg'
                          : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        activeWorkflowStep === step.id
                          ? 'bg-mc-bg text-mc-accent'
                          : 'bg-mc-bg-tertiary text-mc-text-secondary'
                      }`}>
                        {index + 1}
                      </span>
                      {step.label}
                    </button>
                    {index < WORKFLOW_STEPS.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-mc-text-secondary mx-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Step Content */}
            <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
              {activeWorkflowStep === 'program' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-mc-text">Product Program</h2>
                    <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded">Step 1 of 5</span>
                  </div>
                  <p className="text-sm text-mc-text-secondary">Define the core product requirements and specifications.</p>
                  <textarea
                    value={editedProgram}
                    onChange={(e) => setEditedProgram(e.target.value)}
                    placeholder="# Product Requirements Document..."
                    className="w-full h-[50vh] bg-mc-bg border border-mc-border rounded-lg p-4 text-sm font-mono text-mc-text focus:outline-none focus:border-mc-accent resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProgram}
                      disabled={saving}
                      className="px-4 py-2 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Program'}
                    </button>
                  </div>
                </div>
              )}

              {activeWorkflowStep === 'executive-summary' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-mc-text">Executive Summary</h2>
                    <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded">Step 2 of 5</span>
                  </div>
                  <p className="text-sm text-mc-text-secondary">High-level overview for stakeholders and decision makers.</p>
                  <div className="bg-mc-bg rounded-lg border border-mc-border border-dashed p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-mc-text-secondary" />
                    <p className="text-mc-text-secondary">Executive Summary editor coming soon.</p>
                  </div>
                </div>
              )}

              {activeWorkflowStep === 'technical-architecture' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-mc-text">Technical Architecture</h2>
                    <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded">Step 3 of 5</span>
                  </div>
                  <p className="text-sm text-mc-text-secondary">System design, tech stack, and infrastructure decisions.</p>
                  <div className="bg-mc-bg rounded-lg border border-mc-border border-dashed p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-mc-text-secondary" />
                    <p className="text-mc-text-secondary">Technical Architecture editor coming soon.</p>
                  </div>
                </div>
              )}

              {activeWorkflowStep === 'implementation-roadmap' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-mc-text">Implementation Roadmap</h2>
                    <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded">Step 4 of 5</span>
                  </div>
                  <p className="text-sm text-mc-text-secondary">Timeline, milestones, and resource allocation plan.</p>
                  <div className="bg-mc-bg rounded-lg border border-mc-border border-dashed p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-mc-text-secondary" />
                    <p className="text-mc-text-secondary">Implementation Roadmap editor coming soon.</p>
                  </div>
                </div>
              )}

              {activeWorkflowStep === 'sprints-tasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-mc-text">Sprints & Tasks</h2>
                    <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded">Step 5 of 5</span>
                  </div>
                  <p className="text-sm text-mc-text-secondary">Development sprints with tasks, agents, and status tracking.</p>
                  
                  {/* Sample Sprint Layout */}
                  <div className="space-y-6">
                    <div className="bg-mc-bg rounded-lg border border-mc-border p-4">
                      <h3 className="font-semibold text-mc-text mb-3">Sprint 1: Foundation & Setup</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-3 p-2 bg-mc-bg-secondary rounded">
                          <span className="text-mc-accent font-mono">[rob_web]</span>
                          <span className="text-mc-text-secondary font-mono">[2026-03-31 16:27]</span>
                          <span className="text-mc-text-secondary font-mono">[2026-03-31 16:28]</span>
                          <span className="text-green-400 font-mono">[done]</span>
                          <span className="flex-1 text-mc-text">Technical architecture design</span>
                          <input type="checkbox" checked className="accent-mc-accent" readOnly />
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-mc-bg-secondary rounded">
                          <span className="text-mc-accent font-mono">[rob_asogrowth]</span>
                          <span className="text-mc-text-secondary font-mono">[TBD]</span>
                          <span className="text-mc-text-secondary font-mono">[TBD]</span>
                          <span className="text-yellow-400 font-mono">[pending]</span>
                          <span className="flex-1 text-mc-text">Establish data quality checks</span>
                          <input type="checkbox" className="accent-mc-accent" />
                        </div>
                        <div className="flex items-center gap-3 p-2 bg-mc-bg-secondary rounded">
                          <span className="text-mc-accent font-mono">[rob_asogrowth]</span>
                          <span className="text-mc-text-secondary font-mono">[TBD]</span>
                          <span className="text-mc-text-secondary font-mono">[TBD]</span>
                          <span className="text-yellow-400 font-mono">[pending]</span>
                          <span className="flex-1 text-mc-text">Create staging tables</span>
                          <input type="checkbox" className="accent-mc-accent" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-mc-bg rounded-lg border border-mc-border border-dashed p-8 text-center">
                      <p className="text-mc-text-secondary text-sm">+ Add new sprint</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-12 text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 text-mc-text-secondary" />
              <h2 className="text-lg font-semibold text-mc-text mb-2">Activity Log</h2>
              <p className="text-mc-text-secondary">Activity tracking coming soon.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
