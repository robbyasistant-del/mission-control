'use client';

import { useState, useEffect } from 'react';
import { Plus, ArrowRight, Trash2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { MainNav } from '@/components/MainNav';

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

function ProductCard({ product, onDelete }: { product: AutopilotProduct; onDelete: (id: string) => void }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}`, { method: 'DELETE' });
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
      <Link href={`/autopilot/${product.id}`}>
        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6 hover:border-mc-accent/50 transition-all hover:shadow-lg cursor-pointer group relative min-h-[160px]">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{product.icon || '🚀'}</span>
              <div>
                <h3 className="font-semibold text-lg group-hover:text-mc-accent transition-colors">
                  {product.name}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
              <ArrowRight className="w-5 h-5 text-mc-text-secondary group-hover:text-mc-accent transition-colors" />
            </div>
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

  const handleDelete = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  if (loading) {
    return (
      <>
        <MainNav />
        <div className="min-h-screen bg-mc-bg flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-pulse">🚀</div>
            <p className="text-mc-text-secondary">Loading products...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <MainNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header con título y botón de crear */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-1">Autopilot Products</h2>
            <p className="text-mc-text-secondary">AI-powered product automation</p>
          </div>
          <Link
            href="/autopilot/new"
            className="flex items-center gap-2 px-4 py-2 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90"
          >
            <Plus className="w-4 h-4" />
            New Product
          </Link>
        </div>

        {products.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onDelete={handleDelete}
              />
            ))}
            
            {/* Add Product Card */}
            <Link href="/autopilot/new">
              <div className="border-2 border-dashed border-mc-border rounded-xl p-6 hover:border-mc-accent/50 transition-colors flex flex-col items-center justify-center gap-3 min-h-[160px]">
                <div className="w-12 h-12 rounded-full bg-mc-bg-tertiary flex items-center justify-center">
                  <Plus className="w-6 h-6 text-mc-text-secondary" />
                </div>
                <span className="text-mc-text-secondary font-medium">New Product</span>
              </div>
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
