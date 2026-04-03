'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Rocket, ExternalLink, Github, Globe, Loader } from 'lucide-react';
import Link from 'next/link';

interface AutopilotProduct {
  id: string;
  name: string;
  description?: string;
  repo_url?: string;
  live_url?: string;
  icon?: string;
  product_program?: string;
  build_mode?: string;
  default_branch?: string;
  created_at: string;
}

export default function AutopilotProductPage() {
  const params = useParams();
  const [product, setProduct] = useState<AutopilotProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProduct();
  }, [params.id]);

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
            </div>          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {product.description && (
              <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide mb-3">Description</h2>
                <p className="text-mc-text">{product.description}</p>
              </div>
            )}

            {/* Product Program */}
            <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide mb-3">Product Program</h2>
              {product.product_program ? (
                <pre className="bg-mc-bg rounded-lg p-4 text-sm font-mono text-mc-text overflow-x-auto">
                  {product.product_program}
                </pre>
              ) : (
                <p className="text-mc-text-secondary italic">No program defined yet.</p>
              )}
            </div>
          </div>

          {/* Right Column - Links & Info */}
          <div className="space-y-6">
            {/* Links */}
            <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide mb-4">Links</h2>
              <div className="space-y-3">
                {product.repo_url ? (
                  <a
                    href={product.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-mc-bg rounded-lg hover:border-mc-accent border border-mc-border transition-colors"
                  >
                    <Github className="w-5 h-5 text-mc-text-secondary" />
                    <span className="flex-1 truncate text-sm">Repository</span>
                    <ExternalLink className="w-4 h-4 text-mc-text-secondary" />
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-mc-bg rounded-lg opacity-50">
                    <Github className="w-5 h-5" />
                    <span className="text-sm">No repository</span>
                  </div>
                )}
                {product.live_url ? (
                  <a
                    href={product.live_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-mc-bg rounded-lg hover:border-mc-accent border border-mc-border transition-colors"
                  >
                    <Globe className="w-5 h-5 text-mc-text-secondary" />
                    <span className="flex-1 truncate text-sm">Live Site</span>
                    <ExternalLink className="w-4 h-4 text-mc-text-secondary" />
                  </a>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-mc-bg rounded-lg opacity-50">
                    <Globe className="w-5 h-5" />
                    <span className="text-sm">No live site</span>
                  </div>
                )}
              </div>            </div>

            {/* Settings */}
            <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide mb-4">Settings</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-mc-text-secondary">Build Mode</span>
                  <span className="text-mc-text capitalize">{product.build_mode?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mc-text-secondary">Default Branch</span>
                  <span className="text-mc-text">{product.default_branch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mc-text-secondary">Created</span>
                  <span className="text-mc-text">
                    {new Date(product.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="w-5 h-5 text-mc-accent-cyan" />
                <h2 className="text-sm font-semibold">Autopilot Status</h2>
              </div>              <p className="text-sm text-mc-text-secondary">
                Full autopilot functionality coming soon. This product is created and ready.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
