'use client';

import { useState, useEffect } from 'react';
import { Rocket, Plus, ArrowRight, FlaskConical } from 'lucide-react';
import Link from 'next/link';

interface AutopilotProduct {
  id: string;
  name: string;
  description?: string;
  repo_url?: string;
  live_url?: string;
  icon?: string;
  status?: string;
  created_at: string;
}

export default function AutopilotHomePage() {
  const [products, setProducts] = useState<AutopilotProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/autopilot/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to load autopilot products:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mc-bg">
      {/* Header */}
      <header className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Rocket className="w-6 h-6 text-mc-accent-cyan" />
              <div>
                <h1 className="text-xl font-bold text-mc-text">Autopilot</h1>
                <p className="text-xs text-mc-text-secondary">AI-powered product automation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/autopilot/new"
                className="min-h-11 flex items-center gap-2 px-4 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90"
              >
                <Plus className="w-4 h-4" />
                New Product
              </Link>
              <Link
                href="/laboratory"
                className="min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary flex items-center gap-2 text-sm"
              >
                <FlaskConical className="w-4 h-4" />
                Laboratory
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">🚀</div>
              <p className="text-mc-text-secondary">Loading products...</p>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-6">🚀</div>
            <h2 className="text-xl font-semibold mb-2">No products yet</h2>
            <p className="text-mc-text-secondary mb-6">
              Create your first Autopilot product to get started
            </p>
            <Link
              href="/autopilot/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90"
            >
              <Plus className="w-5 h-5" />
              Create First Product
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Products ({products.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <Link key={product.id} href={`/autopilot/${product.id}`}>
                  <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6 hover:border-mc-accent/50 transition-all hover:shadow-lg cursor-pointer group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{product.icon || '🚀'}</span>
                        <div>
                          <h3 className="font-semibold text-lg group-hover:text-mc-accent transition-colors">
                            {product.name}
                          </h3>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-mc-text-secondary group-hover:text-mc-accent transition-colors" />
                    </div>
                    {product.description && (
                      <p className="text-sm text-mc-text-secondary line-clamp-2 mb-3">
                        {product.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {product.repo_url && (
                        <span className="text-xs px-2 py-1 bg-mc-bg-tertiary rounded text-mc-text-secondary">
                          Has repo
                        </span>
                      )}
                      {product.live_url && (
                        <span className="text-xs px-2 py-1 bg-mc-bg-tertiary rounded text-mc-text-secondary">
                          Live site
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
              
              {/* Add Product Card */}
              <Link href="/autopilot/new">
                <div className="border-2 border-dashed border-mc-border rounded-xl p-6 hover:border-mc-accent/50 transition-colors flex flex-col items-center justify-center gap-3 min-h-[160px]"
                >
                  <div className="w-12 h-12 rounded-full bg-mc-bg-tertiary flex items-center justify-center">
                    <Plus className="w-6 h-6 text-mc-text-secondary" />
                  </div>
                  <span className="text-mc-text-secondary font-medium">New Product</span>
                </div>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
