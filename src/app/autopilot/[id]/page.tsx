'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Github, Globe, Loader, FileText, Settings, Activity } from 'lucide-react';
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

type Tab = 'basics' | 'program' | 'activity';

export default function AutopilotProductPage() {
  const params = useParams();
  const [product, setProduct] = useState<AutopilotProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('basics');
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
