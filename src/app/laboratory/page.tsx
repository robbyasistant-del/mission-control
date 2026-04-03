'use client';

import { useState, useEffect } from 'react';
import { Plus, FlaskConical, ArrowRight, Trash2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { HealthBadge } from '@/components/autopilot/HealthBadge';
import type { Product } from '@/lib/types';

function ProductCard({ product, pendingCount, healthScore, onDelete }: { 
  product: Product; 
  pendingCount: number;
  healthScore?: number;
  onDelete: (id: string) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(product.id);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete product');
      }
    } catch {
      alert('Failed to delete product');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Link
        href={`/laboratory/${product.id}`}
        className="group block bg-mc-bg-secondary border border-mc-border rounded-xl p-5 hover:border-mc-accent/50 transition-colors relative min-h-[140px]"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="relative text-2xl">
              {product.icon}
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </span>
            <div>
              <h3 className="font-semibold text-mc-text group-hover:text-mc-accent transition-colors">{product.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded ${
                product.status === 'active' ? 'bg-green-500/20 text-green-400' :
                product.status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                'bg-mc-bg-tertiary text-mc-text-secondary'
              }`}>
                {product.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {healthScore !== undefined && (
              <Link
                href={`/laboratory/${product.id}/health`}
                onClick={(e) => e.stopPropagation()}
                className="hover:scale-110 transition-transform"
              >
                <HealthBadge score={healthScore} size={38} />
              </Link>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="p-1.5 rounded hover:bg-mc-accent-red/20 text-mc-text-secondary hover:text-mc-accent-red transition-colors opacity-0 group-hover:opacity-100"
              title="Delete product"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <ArrowRight className="w-4 h-4 text-mc-text-secondary group-hover:text-mc-accent transition-colors" />
          </div>
        </div>
        {product.description && (
          <p className="text-sm text-mc-text-secondary line-clamp-2">{product.description}</p>
        )}
      </Link>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-mc-bg-secondary border border-mc-border rounded-t-xl sm:rounded-xl w-full max-w-md p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-mc-accent-red/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-mc-accent-red" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Delete Product</h3>
                <p className="text-sm text-mc-text-secondary">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-mc-text-secondary mb-6">
              Are you sure you want to delete <strong>{product.name}</strong>?
              {pendingCount > 0 && (
                <span className="block mt-2 text-amber-400">
                  ⚠️ This will also delete {pendingCount} pending idea(s).
                </span>
              )}
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-mc-text-secondary hover:text-mc-text"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-mc-accent-red text-white rounded-lg font-medium hover:bg-mc-accent-red/90 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AutopilotPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [healthScores, setHealthScores] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const prods: Product[] = await res.json();
          setProducts(prods);

          // Fetch pending idea counts in parallel
          const counts: Record<string, number> = {};
          await Promise.all(prods.map(async (p) => {
            try {
              const r = await fetch(`/api/products/${p.id}/ideas/pending`);
              if (r.ok) {
                const ideas = await r.json();
                if (Array.isArray(ideas) && ideas.length > 0) counts[p.id] = ideas.length;
              }
            } catch { /* skip */ }
          }));
          setPendingCounts(counts);

          // Fetch health scores
          try {
            const healthRes = await fetch('/api/products/health-scores');
            if (healthRes.ok) {
              const scores = await healthRes.json();
              setHealthScores(scores);
            }
          } catch { /* skip */ }
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Listen for SSE health score updates
  useEffect(() => {
    function handleHealthUpdate(e: Event) {
      const { productId, score } = (e as CustomEvent).detail;
      setHealthScores(prev => ({ ...prev, [productId]: score }));
    }
    window.addEventListener('health-score-updated', handleHealthUpdate);
    return () => window.removeEventListener('health-score-updated', handleHealthUpdate);
  }, []);

  const handleDelete = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
    // Also clean up pending counts and health scores
    setPendingCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[id];
      return newCounts;
    });
    setHealthScores(prev => {
      const newScores = { ...prev };
      delete newScores[id];
      return newScores;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🧪</div>
          <p className="text-mc-text-secondary">Loading laboratory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mc-bg">
      <header className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FlaskConical className="w-6 h-6 text-mc-accent-cyan" />
              <h1 className="text-xl font-bold text-mc-text">Product Laboratory</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/" className="min-h-11 px-4 rounded-lg border border-mc-border bg-mc-bg text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary flex items-center gap-2 text-sm">
                Workspaces
              </Link>
              <Link
                href="/laboratory/new"
                className="min-h-11 px-4 rounded-lg bg-mc-accent text-white hover:bg-mc-accent/90 flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                New Product
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {products.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🧪</div>
            <h2 className="text-2xl font-bold text-mc-text mb-3">No products yet</h2>
            <p className="text-mc-text-secondary mb-8 max-w-md mx-auto">
              Create your first product to start the autonomous development loop.
              Agents will research, ideate, and you swipe to decide what gets built.
            </p>
            <Link
              href="/laboratory/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-mc-accent text-white rounded-lg hover:bg-mc-accent/90 font-medium"
            >
              <Plus className="w-5 h-5" />
              Create First Product
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                pendingCount={pendingCounts[product.id] || 0}
                healthScore={healthScores[product.id]}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
