'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowRight, ExternalLink, Github, Globe, Loader, FileText, Settings, Activity, Workflow, ChevronRight, Save, CheckCircle, MessageSquare, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { MainNav } from '@/components/MainNav';

type WorkflowState =
  | 'initial'
  | 'program'
  | 'executive'
  | 'architecture'
  | 'roadmap'
  | 'planned'
  | `sprint-${number}`;

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
  executive_summary?: string;
  additional_prompt?: string;
  technical_architecture?: string;
  additional_prompt_arch?: string;
  implementation_roadmap?: string;
  additional_prompt_roadmap?: string;
  build_mode?: string;
  default_branch?: string;
  workflow_state?: WorkflowState;
  sprints_generated?: number;
  workspace_id?: string;
  created_at: string;
}

type Tab = 'basics' | 'program' | 'workflow' | 'watchdog' | 'prompts';
type WorkflowStep = 'program' | 'executive-summary' | 'technical-architecture' | 'implementation-roadmap' | 'sprints-tasks';

const WORKFLOW_STEPS: { id: WorkflowStep; label: string; state: WorkflowState }[] = [
  { id: 'program', label: 'Product Program', state: 'program' },
  { id: 'executive-summary', label: 'Executive Summary', state: 'executive' },
  { id: 'technical-architecture', label: 'Technical Architecture', state: 'architecture' },
  { id: 'implementation-roadmap', label: 'Implementation Roadmap', state: 'roadmap' },
  { id: 'sprints-tasks', label: 'Sprints & Tasks', state: 'planned' },
];

// Map workflow state to step index
const STATE_TO_INDEX: Record<string, number> = {
  'initial': -1,
  'program': 0,
  'executive': 1,
  'architecture': 2,
  'roadmap': 3,
  'planned': 4,
};

// Check if a step is accessible based on current workflow state
function isStepAccessible(stepIndex: number, currentState: WorkflowState | undefined): boolean {
  if (!currentState) return stepIndex === 0; // Only first step if no state
  
  // Handle sprint-N states as planned (index 4)
  const stateIndex = currentState.startsWith('sprint-') 
    ? 4 
    : (STATE_TO_INDEX[currentState] ?? -1);
  
  // Step is accessible if it's <= current state + 1
  // (current state is completed, next state is accessible)
  return stepIndex <= stateIndex + 1;
}

// Check if a step is completed based on current workflow state
function isStepCompleted(stepIndex: number, currentState: WorkflowState | undefined): boolean {
  if (!currentState) return false;
  
  const stateIndex = currentState.startsWith('sprint-') 
    ? 4 
    : (STATE_TO_INDEX[currentState] ?? -1);
  
  return stepIndex <= stateIndex;
}

// Get next workflow state for a given step
function getNextState(stepId: WorkflowStep): WorkflowState {
  const step = WORKFLOW_STEPS.find(s => s.id === stepId);
  return step?.state ?? 'initial';
}

// Prompt Key type for the prompts tab
const PROMPT_KEYS = [
  { key: 'product-program', label: 'Product Program', description: 'Generates the initial Product Requirements Document (PRD)' },
  { key: 'executive-summary', label: 'Executive Summary', description: 'Creates a strategic executive summary from the PRD' },
  { key: 'technical-architecture', label: 'Technical Architecture', description: 'Generates technical architecture documentation' },
  { key: 'implementation-roadmap', label: 'Implementation Roadmap', description: 'Creates detailed sprint-based implementation roadmap' },
  { key: 'watchdog-task-description', label: 'Watchdog Task Description', description: 'Generates task descriptions when watchdog creates tasks' },
] as const;

type PromptKey = typeof PROMPT_KEYS[number]['key'];

// Prompts Tab Component
function PromptsTab({ productId }: { productId: string }) {
  const [activePromptKey, setActivePromptKey] = useState<PromptKey>('product-program');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for the active prompt
  const [form, setForm] = useState({
    prompt_text: '',
    model: 'openclaw',
    temperature: 0.7,
    max_tokens: 4096,
    timeout_ms: 300000,
    system_prompt: '',
  });
  const [resetting, setResetting] = useState(false);

  // Load prompt from file when active prompt changes
  useEffect(() => {
    loadPromptFromFile(activePromptKey);
  }, [activePromptKey]);

  const loadPromptFromFile = async (key: PromptKey) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prompts/${key}`);
      if (!res.ok) throw new Error('Failed to load prompt from file');
      const data = await res.json();
      
      setForm({
        prompt_text: data.prompt_text || '',
        model: data.config?.model || 'openclaw',
        temperature: data.config?.temperature ?? 0.7,
        max_tokens: data.config?.max_tokens || 4096,
        timeout_ms: data.config?.timeout_ms || 300000,
        system_prompt: data.config?.system_prompt || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompt');
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      const res = await fetch(`/api/autopilot/products/${productId}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_key: activePromptKey,
          prompt_text: form.prompt_text,
          model: form.model,
          temperature: form.temperature,
          max_tokens: form.max_tokens,
          timeout_ms: form.timeout_ms,
          system_prompt: form.system_prompt,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to save prompt');
      
      setSuccess('Prompt saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!confirm('Reset to default? All changes will be lost and the original prompt will be restored.')) return;
    
    try {
      setResetting(true);
      setError(null);
      setSuccess(null);
      
      const res = await fetch(`/api/prompts/${activePromptKey}`, {
        method: 'PUT',
      });
      
      if (!res.ok) throw new Error('Failed to reset prompt');
      
      // Reload the prompt after reset
      await loadPromptFromFile(activePromptKey);
      setSuccess('Reset to default successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset prompt');
    } finally {
      setResetting(false);
    }
  };

  const activePromptInfo = PROMPT_KEYS.find(p => p.key === activePromptKey);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-mc-accent" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left sidebar - Prompt list */}
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide mb-4">LLM Prompts</h3>
        {PROMPT_KEYS.map((prompt) => {
          const isActive = activePromptKey === prompt.key;
          
          return (
            <button
              key={prompt.key}
              onClick={() => setActivePromptKey(prompt.key)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                isActive
                  ? 'bg-mc-accent/10 border-mc-accent text-mc-accent'
                  : 'bg-mc-bg-secondary border-mc-border text-mc-text hover:border-mc-accent/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="font-medium text-sm">{prompt.label}</span>
              </div>
              <p className="text-xs text-mc-text-secondary mt-1 line-clamp-2">{prompt.description}</p>
            </button>
          );
        })};
      </div>

      {/* Right content - Prompt editor */}
      <div className="lg:col-span-3 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-mc-text">{activePromptInfo?.label}</h2>
            <p className="text-sm text-mc-text-secondary mt-1">{activePromptInfo?.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {success && (
              <span className="text-sm text-green-400 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                {success}
              </span>
            )}
            <button
              onClick={resetToDefault}
              disabled={resetting}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              {resetting ? 'Resetting...' : 'Reset to Default'}
            </button>
            <button
              onClick={savePrompt}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-mc-bg bg-mc-accent hover:bg-mc-accent/90 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Prompt'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Configuration */}
        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide">Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Model */}
            <div>
              <label className="block text-sm text-mc-text-secondary mb-1">Model</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                placeholder="e.g., openclaw or anthropic/claude-sonnet-4-6"
              />
              <p className="text-xs text-mc-text-secondary mt-1">Gateway model identifier</p>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm text-mc-text-secondary mb-1">Temperature</label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={(e) => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text focus:outline-none focus:border-mc-accent"
              />
              <p className="text-xs text-mc-text-secondary mt-1">0.0 = deterministic, 2.0 = creative</p>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-sm text-mc-text-secondary mb-1">Max Tokens</label>
              <input
                type="number"
                min="100"
                max="32000"
                step="100"
                value={form.max_tokens}
                onChange={(e) => setForm(f => ({ ...f, max_tokens: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text focus:outline-none focus:border-mc-accent"
              />
              <p className="text-xs text-mc-text-secondary mt-1">Maximum output length</p>
            </div>

            {/* Timeout */}
            <div>
              <label className="block text-sm text-mc-text-secondary mb-1">Timeout (ms)</label>
              <input
                type="number"
                min="10000"
                max="600000"
                step="10000"
                value={form.timeout_ms}
                onChange={(e) => setForm(f => ({ ...f, timeout_ms: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text focus:outline-none focus:border-mc-accent"
              />
              <p className="text-xs text-mc-text-secondary mt-1">Maximum wait time</p>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm text-mc-text-secondary mb-1">System Prompt</label>
            <textarea
              value={form.system_prompt}
              onChange={(e) => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text focus:outline-none focus:border-mc-accent resize-none"
              placeholder="Optional system prompt to set the behavior context..."
            />
            <p className="text-xs text-mc-text-secondary mt-1">Defines the AI&apos;s role and behavior</p>
          </div>

        </div>

        {/* Prompt Text */}
        <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-mc-text-secondary uppercase tracking-wide">Prompt Template</h3>
            <span className="text-xs text-mc-text-secondary">
              Use {'{{variable}}'} syntax for dynamic values
            </span>
          </div>
          <textarea
            value={form.prompt_text}
            onChange={(e) => setForm(f => ({ ...f, prompt_text: e.target.value }))}
            rows={20}
            className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text font-mono focus:outline-none focus:border-mc-accent resize-y"
            placeholder="Enter the prompt template here..."
          />
          <p className="text-xs text-mc-text-secondary">
            Available variables depend on the prompt type. See the markdown file in /prompts for documentation.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AutopilotProductPage() {
  const params = useParams();
  const [product, setProduct] = useState<AutopilotProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('basics');
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<WorkflowStep>('program');
  const [editedProgram, setEditedProgram] = useState('');
  const [editedExecutive, setEditedExecutive] = useState('');
  const [editedArchitecture, setEditedArchitecture] = useState('');
  const [editedRoadmap, setEditedRoadmap] = useState('');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [additionalPromptArch, setAdditionalPromptArch] = useState('');
  const [additionalPromptRoadmap, setAdditionalPromptRoadmap] = useState('');
  const [autoBuildingExecutive, setAutoBuildingExecutive] = useState(false);
  const [autoBuildingArch, setAutoBuildingArch] = useState(false);
  const [autoBuildingRoadmap, setAutoBuildingRoadmap] = useState(false);
  const [generatingSprints, setGeneratingSprints] = useState(false);
  const [executiveCountdown, setExecutiveCountdown] = useState(300);
  const [archCountdown, setArchCountdown] = useState(300);
  const [roadmapCountdown, setRoadmapCountdown] = useState(300);
  const [sprints, setSprints] = useState<any[]>([]);
  
  // Watchdog state
  const [watchdogSettings, setWatchdogSettings] = useState<any>(null);
  const [watchdogForm, setWatchdogForm] = useState<any>(null);
  const [watchdogLogs, setWatchdogLogs] = useState<any[]>([]);
  const [watchdogCountdown, setWatchdogCountdown] = useState(0);
  const [isWatchdogRunning, setIsWatchdogRunning] = useState(false);
  const [isSavingWatchdog, setIsSavingWatchdog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Watchdog tasks state
  const [watchdogCurrentTask, setWatchdogCurrentTask] = useState<any>(null);
  const [watchdogNextTask, setWatchdogNextTask] = useState<any>(null);
  const [regressionFromStep, setRegressionFromStep] = useState<number | null>(null);

  useEffect(() => {
    loadProduct();
  }, [params.id]);

  useEffect(() => {
    setEditedProgram(product?.product_program || '');
    setEditedExecutive(product?.executive_summary || '');
    setEditedArchitecture(product?.technical_architecture || '');
    setEditedRoadmap(product?.implementation_roadmap || '');
    setAdditionalPrompt(product?.additional_prompt || '');
    setAdditionalPromptArch(product?.additional_prompt_arch || '');
    setAdditionalPromptRoadmap(product?.additional_prompt_roadmap || '');
  }, [product]);

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

  const currentState: WorkflowState = product?.workflow_state || 'initial';
  const currentStateIndex = currentState.startsWith('sprint-') ? 4 : (STATE_TO_INDEX[currentState] ?? -1);

  const handleSaveStep = async (step: WorkflowStep) => {
    if (!product) return;

    const stepIndex = WORKFLOW_STEPS.findIndex(s => s.id === step);
    const updates: Record<string, string> = {};

    if (step === 'program') updates.product_program = editedProgram;
    if (step === 'executive-summary') updates.executive_summary = editedExecutive;
    if (step === 'technical-architecture') updates.technical_architecture = editedArchitecture;
    if (step === 'implementation-roadmap') updates.implementation_roadmap = editedRoadmap;

    // persist prompt separately when saving executive step
    if (step === 'executive-summary') updates.additional_prompt = additionalPrompt;
    if (step === 'technical-architecture') updates.additional_prompt_arch = additionalPromptArch;
    if (step === 'implementation-roadmap') updates.additional_prompt_roadmap = additionalPromptRoadmap;

    // Advance only when saving the next progression step; editing previous steps won't rollback state
    if (stepIndex > currentStateIndex) {
      updates.workflow_state = getNextState(step);
      setRegressionFromStep(null);
    } else if (stepIndex < currentStateIndex) {
      setRegressionFromStep(stepIndex);
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to save');
      await loadProduct();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoBuildExecutive = async () => {
    if (!product) return;
    setAutoBuildingExecutive(true);
    setExecutiveCountdown(300);

    const controller = new AbortController();
    let timedOut = false;

    // Setup timeout handler to abort request and re-enable UI after 5 minutes
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      setAutoBuildingExecutive(false);
      alert('Auto-Build timed out after 5 minutes. You can now enter the Executive Summary manually.');
    }, 300000);

    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/generate-executive-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additional_prompt: additionalPrompt }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Ignore response if timeout already occurred
      if (timedOut) {
        console.log('Ignoring late response from executive summary generation (timeout exceeded)');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate executive summary');
      setEditedExecutive(data.executiveSummary || '');
      await loadProduct();
    } catch (err) {
      clearTimeout(timeoutId);
      // Ignore abort errors from our timeout
      if (err instanceof Error && err.name === 'AbortError' && timedOut) {
        return;
      }
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to auto-build executive summary. You can enter the content manually below.');
    } finally {
      setAutoBuildingExecutive(false);
    }
  };

  const handleAutoBuildArch = async () => {
    if (!product) return;
    setAutoBuildingArch(true);
    setArchCountdown(300);

    const controller = new AbortController();
    let timedOut = false;

    // Setup timeout handler to abort request and re-enable UI after 5 minutes
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      setAutoBuildingArch(false);
      alert('Auto-Build timed out after 5 minutes. You can now enter the Technical Architecture manually.');
    }, 300000);

    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/generate-technical-architecture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additional_prompt: additionalPromptArch }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Ignore response if timeout already occurred
      if (timedOut) {
        console.log('Ignoring late response from technical architecture generation (timeout exceeded)');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate technical architecture');
      setEditedArchitecture(data.technicalArchitecture || '');
      await loadProduct();
    } catch (err) {
      clearTimeout(timeoutId);
      // Ignore abort errors from our timeout
      if (err instanceof Error && err.name === 'AbortError' && timedOut) {
        return;
      }
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to auto-build technical architecture. You can enter the content manually below.');
    } finally {
      setAutoBuildingArch(false);
    }
  };

  useEffect(() => {
    if (!autoBuildingExecutive) return;
    const t = setInterval(() => {
      setExecutiveCountdown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [autoBuildingExecutive]);

  const handleAutoBuildRoadmap = async () => {
    if (!product) return;
    setAutoBuildingRoadmap(true);
    setRoadmapCountdown(300);

    const controller = new AbortController();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
      setAutoBuildingRoadmap(false);
      alert('Auto-Build timed out after 5 minutes. You can now enter the Implementation Roadmap manually.');
    }, 300000);

    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/generate-implementation-roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additional_prompt: additionalPromptRoadmap }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (timedOut) {
        console.log('Ignoring late response from implementation roadmap generation (timeout exceeded)');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate implementation roadmap');
      setEditedRoadmap(data.implementationRoadmap || '');
      await loadProduct();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError' && timedOut) {
        return;
      }
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to auto-build implementation roadmap. You can enter the content manually below.');
    } finally {
      setAutoBuildingRoadmap(false);
    }
  };

  useEffect(() => {
    if (!autoBuildingArch) return;
    const t = setInterval(() => {
      setArchCountdown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [autoBuildingArch]);

  useEffect(() => {
    if (!autoBuildingRoadmap) return;
    const t = setInterval(() => {
      setRoadmapCountdown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [autoBuildingRoadmap]);

  useEffect(() => {
    if (activeWorkflowStep === 'sprints-tasks' && product) {
      loadSprints();
    }
  }, [activeWorkflowStep, product]);

  const loadSprints = async () => {
    if (!product) return;
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/sprints`);
      if (res.ok) {
        const data = await res.json();
        setSprints(data.sprints || []);
      }
    } catch (err) {
      console.error('Failed to load sprints:', err);
    }
  };

  const handleGenerateSprints = async () => {
    if (!product) return;
    setGeneratingSprints(true);
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/generate-sprints-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate sprints');
      await loadSprints();
      await loadProduct();
      alert(`Generated ${data.sprintsGenerated} sprints with ${data.totalTasks} tasks`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to generate sprints and tasks');
    } finally {
      setGeneratingSprints(false);
    }
  };

  // Watchdog functions
  const loadWatchdogSettings = async () => {
    if (!product) return;
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/watchdog/settings`);
      if (res.ok) {
        const data = await res.json();
        let settings = data.settings;
        
        // Auto-populate dashboard URL from workspace if not set
        if (!settings.dashboard_url && product.workspace_id) {
          const workspaceSlug = product.workspace_id === 'default' ? 'default' : product.workspace_id;
          settings = {
            ...settings,
            dashboard_url: `${window.location.origin}/workspace/${workspaceSlug}`
          };
        }
        
        // Initialize form with defaults for new fields
        settings = {
          additional_prompt_task_creation: '',
          include_basic_info: true,
          include_product_program: true,
          include_executive_summary: true,
          include_technical_architecture: true,
          include_implementation_roadmap: true,
          ...settings
        };
        
        setWatchdogSettings(settings);
        setWatchdogForm({ ...settings });
        setIsWatchdogRunning(settings?.is_running || false);
      }
    } catch (err) {
      console.error('Failed to load watchdog settings:', err);
    }
  };

  const loadWatchdogLogs = async () => {
    if (!product) return;
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/watchdog/logs?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setWatchdogLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load watchdog logs:', err);
    }
  };

  const loadWatchdogTasks = async () => {
    if (!product) return;
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/watchdog/tasks`);
      if (res.ok) {
        const data = await res.json();
        setWatchdogCurrentTask(data.currentTask);
        setWatchdogNextTask(data.nextTask);
      }
    } catch (err) {
      console.error('Failed to load watchdog tasks:', err);
    }
  };

  const toggleWatchdog = async () => {
    if (!product) return;
    const newState = !isWatchdogRunning;
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/watchdog/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_running: newState }),
      });
      if (res.ok) {
        const data = await res.json();
        setWatchdogSettings(data.settings);
        setIsWatchdogRunning(data.settings?.is_running || false);
      }
    } catch (err) {
      console.error('Failed to toggle watchdog:', err);
    }
  };

  const updateWatchdogForm = (updates: any) => {
    setWatchdogForm((prev: any) => ({ ...prev, ...updates }));
  };

  const saveWatchdogSettings = async () => {
    if (!product || !watchdogForm) return;
    setIsSavingWatchdog(true);
    try {
      const res = await fetch(`/api/autopilot/products/${product.id}/watchdog/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(watchdogForm),
      });
      if (res.ok) {
        const data = await res.json();
        setWatchdogSettings(data.settings);
        setWatchdogForm(data.settings);
      }
    } catch (err) {
      console.error('Failed to update watchdog settings:', err);
    } finally {
      setIsSavingWatchdog(false);
    }
  };

  // Load watchdog data when tab is active
  useEffect(() => {
    if (activeTab === 'watchdog' && product) {
      loadWatchdogSettings();
      loadWatchdogLogs();
      loadWatchdogTasks();
    }
  }, [activeTab, product]);

  // Auto-refresh Last Run and Event Log every 3 seconds when watchdog tab is active
  useEffect(() => {
    if (activeTab !== 'watchdog' || !product) return;

    const interval = setInterval(() => {
      loadWatchdogLogs();
      loadWatchdogTasks();
    }, 3000);

    return () => clearInterval(interval);
  }, [activeTab, product?.id]);

  // Watchdog SSE connection for real-time countdown
  useEffect(() => {
    if (!product || activeTab !== 'watchdog') return;

    const eventSource = new EventSource(`/api/autopilot/products/${product.id}/watchdog/status`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setIsWatchdogRunning(data.is_running);
        setWatchdogCountdown(data.countdown_seconds);
        if (data.interval_seconds) {
          setWatchdogSettings((prev: any) => prev ? { ...prev, interval_seconds: data.interval_seconds } : prev);
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Don't close on error, let it reconnect automatically
    };

    return () => {
      eventSource.close();
    };
  }, [product?.id, activeTab]);

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
    { id: 'watchdog', label: 'Run Watchdog', icon: <Activity className="w-4 h-4" /> },
    { id: 'prompts', label: 'Prompts', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <>
      <MainNav />
      <div className="min-h-screen bg-mc-bg">
        {/* Product Header */}
        <header className="border-b border-mc-border bg-mc-bg-secondary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{product.icon || '🚀'}</span>
              <div>
                <h1 className="text-lg font-bold text-mc-text">{product.name}</h1>
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
              </div>
              <textarea
                value={editedProgram}
                onChange={(e) => setEditedProgram(e.target.value)}
                placeholder="# Product Requirements Document..."
                className="w-full h-[60vh] bg-mc-bg border border-mc-border rounded-lg p-4 text-sm font-mono text-mc-text focus:outline-none focus:border-mc-accent resize-none"
              />
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => handleSaveStep('program')}
                  disabled={saving}
                  className="px-4 py-2 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="space-y-6">
            {/* Workflow Progress Bar */}
            <div className="bg-mc-bg-secondary border border-mc-border rounded-xl p-4">
              <div className="flex items-center gap-2 overflow-x-auto">
                {WORKFLOW_STEPS.map((step, index) => {
                  const accessible = isStepAccessible(index, currentState);
                  const completed = isStepCompleted(index, currentState);
                  const stale = regressionFromStep !== null && index > regressionFromStep;

                  return (
                    <div key={step.id} className="flex items-center shrink-0">
                      <button
                        onClick={() => accessible && setActiveWorkflowStep(step.id)}
                        disabled={!accessible}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeWorkflowStep === step.id
                            ? 'bg-mc-accent text-mc-bg'
                            : accessible
                              ? 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg'
                              : 'text-mc-text-secondary/40 cursor-not-allowed'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                          activeWorkflowStep === step.id
                            ? 'bg-mc-bg text-mc-accent'
                            : completed
                              ? 'bg-green-600/20 text-green-400'
                              : 'bg-mc-bg-tertiary text-mc-text-secondary'
                        }`}>
                          {index + 1}
                        </span>
                        {step.label}
                        {stale && <span className="text-yellow-400 font-bold">!</span>}
                      </button>
                      {index < WORKFLOW_STEPS.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-mc-text-secondary mx-1" />
                      )}
                    </div>
                  );
                })}
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
                      onClick={() => handleSaveStep('program')}
                      disabled={saving}
                      className="px-4 py-2 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
                    </button>
                  </div>
                </div>
              )}

              {activeWorkflowStep === 'executive-summary' && (
                <div className="flex flex-col h-[calc(100vh-280px)] gap-4">
                  {/* Top section - 25% */}
                  <div className="flex-[25] flex items-stretch gap-4 bg-mc-bg rounded-lg border border-mc-border p-4 min-h-[180px]">
                    {/* Additional Prompt */}
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-xs font-medium text-mc-text-secondary uppercase tracking-wide">Additional Prompt</label>
                      <textarea
                        value={additionalPrompt}
                        onChange={(e) => setAdditionalPrompt(e.target.value)}
                        disabled={autoBuildingExecutive}
                        placeholder="Add any specific instructions or context for the executive summary generation..."
                        className="w-full h-full min-h-[120px] bg-mc-bg-tertiary border border-mc-border rounded-lg p-3 text-sm text-mc-text focus:outline-none focus:border-mc-accent resize-none disabled:opacity-60"
                      />
                    </div>

                    {/* Arrow indicator */}
                    <div className="flex items-center gap-2 text-mc-text-secondary">
                      <span className="text-xs bg-mc-bg-tertiary px-2 py-1 rounded border border-mc-border">+ Product Program</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>

                    {/* Auto-Build Button */}
                    <button
                      onClick={handleAutoBuildExecutive}
                      disabled={autoBuildingExecutive || !product?.product_program}
                      className="px-4 py-3 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 whitespace-nowrap min-w-[120px]"
                    >
                      {autoBuildingExecutive ? `Building… ${executiveCountdown}s` : 'Auto-Build'}
                    </button>
                  </div>

                  {/* Bottom section - 75% */}
                  <div className="flex-[75] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-mc-text">Executive Summary</h2>
                        <p className="text-sm text-mc-text-secondary">High-level overview for stakeholders and decision makers.</p>
                      </div>
                      <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded border border-mc-border">Step 2 of 5</span>
                    </div>
                    <textarea
                      value={editedExecutive}
                      onChange={(e) => setEditedExecutive(e.target.value)}
                      placeholder="# Executive Summary&#10;&#10;Write a concise executive summary covering:&#10;- Problem statement&#10;- Solution overview&#10;- Key metrics and goals&#10;- Resource requirements&#10;- Timeline highlights"
                      disabled={autoBuildingExecutive}
                      maxLength={100000}
                      className="flex-1 w-full min-h-[400px] bg-mc-bg border border-mc-border rounded-lg p-4 text-sm font-mono text-mc-text focus:outline-none focus:border-mc-accent resize-none disabled:opacity-60 overflow-auto"
                    />
                    <div className="flex justify-end">
                      <button onClick={() => handleSaveStep('executive-summary')} disabled={saving || autoBuildingExecutive} className="px-4 py-2 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center gap-2">
                        {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeWorkflowStep === 'technical-architecture' && (
                <div className="flex flex-col h-[calc(100vh-280px)] gap-4">
                  {/* Top section - 25% */}
                  <div className="flex-[25] flex items-stretch gap-4 bg-mc-bg rounded-lg border border-mc-border p-4 min-h-[180px]">
                    {/* Additional Prompt */}
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-xs font-medium text-mc-text-secondary uppercase tracking-wide">Additional Prompt</label>
                      <textarea
                        value={additionalPromptArch}
                        onChange={(e) => setAdditionalPromptArch(e.target.value)}
                        disabled={autoBuildingArch}
                        placeholder="Add any specific technical requirements or constraints..."
                        className="w-full h-full min-h-[120px] bg-mc-bg-tertiary border border-mc-border rounded-lg p-3 text-sm text-mc-text focus:outline-none focus:border-mc-accent resize-none disabled:opacity-60"
                      />
                    </div>

                    {/* Input indicators */}
                    <div className="flex flex-col justify-center gap-2 text-mc-text-secondary">
                      <span className="text-xs bg-mc-bg-tertiary px-2 py-1 rounded border border-mc-border">+ Product Program</span>
                      <span className="text-xs bg-mc-bg-tertiary px-2 py-1 rounded border border-mc-border">+ Executive Summary</span>
                      <ArrowRight className="w-4 h-4 self-center" />
                    </div>

                    {/* Auto-Build Button */}
                    <button
                      onClick={handleAutoBuildArch}
                      disabled={autoBuildingArch || !product?.product_program || !product?.executive_summary}
                      className="px-4 py-3 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 whitespace-nowrap min-w-[120px]"
                    >
                      {autoBuildingArch ? `Building… ${archCountdown}s` : 'Auto-Build'}
                    </button>
                  </div>

                  {/* Bottom section - 75% */}
                  <div className="flex-[75] flex flex-col gap-3 min-h-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-mc-text">Technical Architecture</h2>
                        <p className="text-sm text-mc-text-secondary">System design, tech stack, and infrastructure decisions. ({editedArchitecture.length} chars)</p>
                      </div>
                      <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded border border-mc-border">Step 3 of 5</span>
                    </div>
                    <textarea
                      value={editedArchitecture}
                      onChange={(e) => setEditedArchitecture(e.target.value)}
                      placeholder="# Technical Architecture&#10;&#10;## 1. Architecture Overview&#10;### 1.1 High-Level Architecture&#10;[Diagram description]&#10;&#10;### 1.2 Technology Stack&#10;| Layer | Technology | Purpose |&#10;&#10;## 2. Database Schema Design&#10;### 2.1 Core Tables&#10;[Table definitions]"
                      disabled={autoBuildingArch}
                      maxLength={100000}
                      className="flex-1 w-full min-h-[400px] bg-mc-bg border border-mc-border rounded-lg p-4 text-sm font-mono text-mc-text focus:outline-none focus:border-mc-accent resize-none disabled:opacity-60 overflow-auto"
                    />
                    <div className="flex justify-end">
                      <button onClick={() => handleSaveStep('technical-architecture')} disabled={saving || autoBuildingArch} className="px-4 py-2 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center gap-2">
                        {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeWorkflowStep === 'implementation-roadmap' && (
                <div className="flex flex-col h-[calc(100vh-280px)] gap-4">
                  <div className="flex-[25] flex items-stretch gap-4 bg-mc-bg rounded-lg border border-mc-border p-4 min-h-[180px]">
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-xs font-medium text-mc-text-secondary uppercase tracking-wide">Additional Prompt</label>
                      <textarea
                        value={additionalPromptRoadmap}
                        onChange={(e) => setAdditionalPromptRoadmap(e.target.value)}
                        disabled={autoBuildingRoadmap}
                        placeholder="Add any specific roadmap constraints, sequencing rules, delivery expectations or development notes..."
                        className="w-full h-full min-h-[120px] bg-mc-bg-tertiary border border-mc-border rounded-lg p-3 text-sm text-mc-text focus:outline-none focus:border-mc-accent resize-none disabled:opacity-60"
                      />
                    </div>

                    <div className="flex flex-col justify-center gap-2 text-mc-text-secondary">
                      <span className="text-xs bg-mc-bg-tertiary px-2 py-1 rounded border border-mc-border">+ Product Program</span>
                      <span className="text-xs bg-mc-bg-tertiary px-2 py-1 rounded border border-mc-border">+ Executive Summary</span>
                      <span className="text-xs bg-mc-bg-tertiary px-2 py-1 rounded border border-mc-border">+ Technical Architecture</span>
                      <ArrowRight className="w-4 h-4 self-center" />
                    </div>

                    <button
                      onClick={handleAutoBuildRoadmap}
                      disabled={autoBuildingRoadmap || !product?.product_program || !product?.executive_summary || !product?.technical_architecture}
                      className="px-4 py-3 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 whitespace-nowrap min-w-[120px]"
                    >
                      {autoBuildingRoadmap ? `Building… ${roadmapCountdown}s` : 'Auto-Build'}
                    </button>
                  </div>

                  <div className="flex-[75] flex flex-col gap-3 min-h-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-mc-text">Implementation Roadmap</h2>
                        <p className="text-sm text-mc-text-secondary">Detailed sprint-by-sprint delivery plan with tasks, deliverables and quality criteria. ({editedRoadmap.length} chars)</p>
                      </div>
                      <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded">Step 4 of 5</span>
                    </div>
                    <textarea
                      value={editedRoadmap}
                      onChange={(e) => setEditedRoadmap(e.target.value)}
                      placeholder="# Implementation Roadmap"
                      disabled={autoBuildingRoadmap}
                      maxLength={500000}
                      className="flex-1 w-full min-h-[400px] bg-mc-bg border border-mc-border rounded-lg p-4 text-sm font-mono text-mc-text focus:outline-none focus:border-mc-accent resize-none disabled:opacity-60 overflow-auto"
                    />
                    <div className="flex justify-end">
                      <button onClick={() => handleSaveStep('implementation-roadmap')} disabled={saving || autoBuildingRoadmap} className="px-4 py-2 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center gap-2">
                        {saving ? <><Loader className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeWorkflowStep === 'sprints-tasks' && (
                <div className="flex flex-col h-[calc(100vh-280px)] gap-4">
                  {/* Top section - 15% - Generate button */}
                  <div className="flex-[15] bg-mc-bg rounded-lg border border-mc-border p-4">
                    <div className="flex items-center justify-between h-full">
                      <div className="flex-1">
                        <p className="text-sm text-mc-text-secondary">
                          Load sprints and tasks into the database based on the Implementation Roadmap structure.
                          This will parse all phases and sprints to create executable tasks.
                        </p>
                      </div>
                      <button
                        onClick={handleGenerateSprints}
                        disabled={generatingSprints || !product?.implementation_roadmap}
                        className="px-4 py-3 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 whitespace-nowrap min-w-[160px] ml-4"
                      >
                        {generatingSprints ? 'Generating...' : 'Generate Sprints & Tasks'}
                      </button>
                    </div>
                  </div>

                  {/* Bottom section - 85% - Sprints and tasks list */}
                  <div className="flex-[85] overflow-auto">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold text-mc-text">Sprints & Tasks</h2>
                        <p className="text-sm text-mc-text-secondary">Development sprints with tasks, agents, and status tracking.</p>
                      </div>
                      <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded border border-mc-border">Step 5 of 5</span>
                    </div>

                    {/* Status Legend */}
                    <div className="flex flex-wrap gap-3 mb-4 text-xs">
                      <span className="text-mc-text-secondary"><code className="bg-mc-bg-tertiary px-1 rounded">pending</code> → no iniciada</span>
                      <span className="text-mc-text-secondary"><code className="bg-mc-bg-tertiary px-1 rounded">in_progress</code> → en curso</span>
                      <span className="text-mc-text-secondary"><code className="bg-mc-bg-tertiary px-1 rounded">blocked</code> → bloqueada</span>
                      <span className="text-mc-text-secondary"><code className="bg-mc-bg-tertiary px-1 rounded">testing</code> → en revision</span>
                      <span className="text-mc-text-secondary"><code className="bg-mc-bg-tertiary px-1 rounded">done</code> → completada</span>
                    </div>

                    {/* Sprints list */}
                    <div className="space-y-4">
                      {sprints.length === 0 ? (
                        <div className="bg-mc-bg rounded-lg border border-mc-border border-dashed p-8 text-center">
                          <p className="text-mc-text-secondary text-sm">No sprints generated yet. Click &quot;Generate Sprints & Tasks&quot; to parse the Implementation Roadmap.</p>
                        </div>
                      ) : (
                        sprints.map((sprint) => (
                          <div key={sprint.id} className="bg-mc-bg-secondary rounded-lg border border-mc-border overflow-hidden">
                            {/* Sprint Header */}
                            <div className="bg-mc-bg-tertiary px-4 py-3 border-b border-mc-border">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-mc-text">
                                  <span className="text-mc-accent">Sprint #{sprint.sprint_number}</span>
                                  <span className="mx-2 text-mc-text-secondary">|</span>
                                  <span>{sprint.phase_name}</span>
                                </h3>
                                <span className="text-xs text-mc-text-secondary bg-mc-bg px-2 py-1 rounded border border-mc-border">
                                  {sprint.tasks?.length || 0} tasks
                                </span>
                              </div>
                            </div>
                            
                            {/* Tasks Table */}
                            {sprint.tasks && sprint.tasks.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-mc-bg border-b border-mc-border">
                                      <th className="text-left px-4 py-2 text-mc-text-secondary font-medium">#</th>
                                      <th className="text-left px-4 py-2 text-mc-text-secondary font-medium">Agent</th>
                                      <th className="text-left px-4 py-2 text-mc-text-secondary font-medium">Task</th>
                                      <th className="text-left px-4 py-2 text-mc-text-secondary font-medium">Start</th>
                                      <th className="text-left px-4 py-2 text-mc-text-secondary font-medium">End</th>
                                      <th className="text-left px-4 py-2 text-mc-text-secondary font-medium">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sprint.tasks.map((task: any, idx: number) => (
                                      <tr key={task.id} className="border-b border-mc-border/50 hover:bg-mc-bg/50">
                                        <td className="px-4 py-2 text-mc-text-secondary">{idx + 1}</td>
                                        <td className="px-4 py-2">
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-mc-accent/10 text-mc-accent">
                                            {task.agent_role}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 text-mc-text">{task.title}</td>
                                        <td className="px-4 py-2 text-mc-text-secondary font-mono text-xs">{task.start_date || '—'}</td>
                                        <td className="px-4 py-2 text-mc-text-secondary font-mono text-xs">{task.end_date || '—'}</td>
                                        <td className="px-4 py-2">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            task.status === 'done' ? 'bg-green-500/20 text-green-400' :
                                            task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                                            task.status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                                            task.status === 'testing' ? 'bg-purple-500/20 text-purple-400' :
                                            'bg-yellow-500/20 text-yellow-400'
                                          }`}>
                                            {task.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="px-4 py-4 text-sm text-mc-text-secondary">
                                No tasks for this sprint.
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'watchdog' && (
          <div className="h-[calc(100vh-180px)] flex gap-4">
            {/* Left side - 70% - Watchdog Settings & Control */}
            <div className="flex-[70] flex flex-col gap-4 overflow-auto">
              {/* Watchdog Control Panel */}
              <div className="bg-mc-bg-secondary rounded-lg border border-mc-border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-mc-text">Watchdog Control</h2>
                  <div className="flex items-center gap-3">
                    {isWatchdogRunning && watchdogCountdown > 0 && (
                      <span className="text-sm text-mc-text-secondary font-mono">
                        Next: {Math.floor(watchdogCountdown / 60)}:{String(watchdogCountdown % 60).padStart(2, '0')}
                      </span>
                    )}
                    <button
                      onClick={toggleWatchdog}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                        isWatchdogRunning
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {isWatchdogRunning ? (
                        <><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> STOP</>
                      ) : (
                        <><span className="w-2 h-2 rounded-full bg-green-400" /> PLAY</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Status indicators - Vertical Layout */}
                <div className="space-y-4">
                  {/* Last Run */}
                  <div className="bg-mc-bg rounded-lg p-4 border border-mc-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-mc-text-secondary font-medium">Last Run</p>
                      {watchdogLogs.length > 0 && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          watchdogLogs[0].status === 'success' ? 'bg-green-500/20 text-green-400' :
                          watchdogLogs[0].status === 'error' ? 'bg-red-500/20 text-red-400' :
                          watchdogLogs[0].status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {watchdogLogs[0].status === 'success' && <CheckCircle className="w-3 h-3" />}
                          {watchdogLogs[0].status.toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    {watchdogLogs.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-mc-text">{watchdogLogs[0].message}</p>
                        <div className="flex items-center gap-4 text-xs text-mc-text-secondary">
                          <span>{new Date(watchdogLogs[0].created_at).toLocaleString()}</span>
                          <span className="bg-mc-bg-tertiary px-1.5 py-0.5 rounded">{watchdogLogs[0].execution_type}</span>
                        </div>
                        {watchdogLogs[0].details && (
                          <p className="text-xs text-mc-text-secondary">{watchdogLogs[0].details}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-mc-text-secondary">No runs yet</p>
                    )}
                  </div>

                  {/* Current Task */}
                  <div className="bg-mc-bg rounded-lg p-3 border border-mc-border">
                    <p className="text-xs text-mc-text-secondary font-medium mb-2">Current Task</p>
                    {watchdogCurrentTask ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-mc-accent/10 text-mc-accent">
                          {watchdogCurrentTask.agent_role}
                        </span>
                        <span className="text-mc-text truncate flex-1">{watchdogCurrentTask.title}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          watchdogCurrentTask.status === 'done' ? 'bg-green-500/20 text-green-400' :
                          watchdogCurrentTask.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          watchdogCurrentTask.status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                          watchdogCurrentTask.status === 'testing' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {watchdogCurrentTask.status}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-mc-text-secondary">No task in progress</p>
                    )}
                  </div>

                  {/* Next Task */}
                  <div className="bg-mc-bg rounded-lg p-3 border border-mc-border">
                    <p className="text-xs text-mc-text-secondary font-medium mb-2">Next Task</p>
                    {watchdogNextTask ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-mc-accent/10 text-mc-accent">
                          {watchdogNextTask.agent_role}
                        </span>
                        <span className="text-mc-text truncate flex-1">{watchdogNextTask.title}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                          {watchdogNextTask.status}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-mc-text-secondary">No pending tasks</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Watchdog Settings */}
              <div className="bg-mc-bg-secondary rounded-lg border border-mc-border p-4 flex-1 overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-mc-text">Watchdog Settings</h3>
                  <button
                    onClick={saveWatchdogSettings}
                    disabled={isSavingWatchdog}
                    className="px-3 py-1.5 bg-mc-accent text-mc-bg rounded-lg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSavingWatchdog ? (
                      <><Loader className="w-4 h-4 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4" /> Save</>
                    )}
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Dashboard URL */}
                  <div className="col-span-2">
                    <label className="block text-xs text-mc-text-secondary mb-1">Dashboard URL</label>
                    <input
                      type="text"
                      value={watchdogForm?.dashboard_url || ''}
                      onChange={(e) => updateWatchdogForm({ dashboard_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                    />
                  </div>

                  {/* Interval */}
                  <div>
                    <label className="block text-xs text-mc-text-secondary mb-1">Check Interval</label>
                    <select
                      value={watchdogForm?.interval_seconds || 300}
                      onChange={(e) => updateWatchdogForm({ interval_seconds: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                    >
                      <option value={30}>30 seconds</option>
                      <option value={60}>1 minute</option>
                      <option value={300}>5 minutes</option>
                      <option value={900}>15 minutes</option>
                      <option value={1800}>30 minutes</option>
                      <option value={3600}>1 hour</option>
                      <option value={7200}>2 hours</option>
                      <option value={28800}>8 hours</option>
                      <option value={86400}>24 hours</option>
                    </select>
                  </div>

                  {/* New Task Priority */}
                  <div>
                    <label className="block text-xs text-mc-text-secondary mb-1">New Task Priority</label>
                    <select
                      value={watchdogForm?.new_task_priority || 'normal'}
                      onChange={(e) => updateWatchdogForm({ new_task_priority: e.target.value })}
                      className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  {/* Additional Prompt for Task Creation */}
                  <div className="col-span-2">
                    <label className="block text-xs text-mc-text-secondary mb-1">Additional Prompt for Task Creation</label>
                    <textarea
                      value={watchdogForm?.additional_prompt_task_creation || ''}
                      onChange={(e) => updateWatchdogForm({ additional_prompt_task_creation: e.target.value })}
                      placeholder="Add any specific instructions for task creation..."
                      rows={5}
                      className="w-full px-3 py-2 bg-mc-bg border border-mc-border rounded-lg text-sm text-mc-text focus:outline-none focus:border-mc-accent resize-none"
                    />
                  </div>

                  {/* Include Components Section */}
                  <div className="col-span-2">
                    <label className="block text-xs text-mc-text-secondary mb-2">Include in Task Creation Context:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 cursor-pointer bg-mc-bg rounded p-2 border border-mc-border">
                        <input
                          type="checkbox"
                          checked={watchdogForm?.include_basic_info !== false}
                          onChange={(e) => updateWatchdogForm({ include_basic_info: e.target.checked })}
                          className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                        />
                        <span className="text-sm text-mc-text">Basic Info</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-mc-bg rounded p-2 border border-mc-border">
                        <input
                          type="checkbox"
                          checked={watchdogForm?.include_product_program !== false}
                          onChange={(e) => updateWatchdogForm({ include_product_program: e.target.checked })}
                          className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                        />
                        <span className="text-sm text-mc-text">Product Program</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-mc-bg rounded p-2 border border-mc-border">
                        <input
                          type="checkbox"
                          checked={watchdogForm?.include_executive_summary !== false}
                          onChange={(e) => updateWatchdogForm({ include_executive_summary: e.target.checked })}
                          className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                        />
                        <span className="text-sm text-mc-text">Executive Summary</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-mc-bg rounded p-2 border border-mc-border">
                        <input
                          type="checkbox"
                          checked={watchdogForm?.include_technical_architecture !== false}
                          onChange={(e) => updateWatchdogForm({ include_technical_architecture: e.target.checked })}
                          className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                        />
                        <span className="text-sm text-mc-text">Technical Architecture</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-mc-bg rounded p-2 border border-mc-border">
                        <input
                          type="checkbox"
                          checked={watchdogForm?.include_implementation_roadmap !== false}
                          onChange={(e) => updateWatchdogForm({ include_implementation_roadmap: e.target.checked })}
                          className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                        />
                        <span className="text-sm text-mc-text">Implementation Roadmap</span>
                      </label>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="col-span-2 space-y-2 pt-2 border-t border-mc-border">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watchdogForm?.auto_nudge_stuck !== false}
                        onChange={(e) => updateWatchdogForm({ auto_nudge_stuck: e.target.checked })}
                        className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                      />
                      <span className="text-sm text-mc-text">Auto-nudge stuck tasks</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watchdogForm?.notify_new_task !== false}
                        onChange={(e) => updateWatchdogForm({ notify_new_task: e.target.checked })}
                        className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                      />
                      <span className="text-sm text-mc-text">Notify on Telegram when new task created</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={watchdogForm?.notify_status_change === true}
                        onChange={(e) => updateWatchdogForm({ notify_status_change: e.target.checked })}
                        className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                      />
                      <span className="text-sm text-mc-text">Notify on Telegram when task status changes to:</span>
                      <select
                        value={watchdogForm?.notify_statuses || 'done'}
                        onChange={(e) => updateWatchdogForm({ notify_statuses: [e.target.value] })}
                        className="px-2 py-1 bg-mc-bg border border-mc-border rounded text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                      >
                        <option value="done">done</option>
                        <option value="blocked">blocked</option>
                        <option value="testing">testing</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watchdogForm?.stop_on_sprint_finish === true}
                        onChange={(e) => updateWatchdogForm({ stop_on_sprint_finish: e.target.checked })}
                        className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                      />
                      <span className="text-sm text-mc-text">Stop watchdog when sprint finishes</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watchdogForm?.regression_testing_enabled !== false}
                        onChange={(e) => updateWatchdogForm({ regression_testing_enabled: e.target.checked })}
                        className="rounded border-mc-border text-mc-accent focus:ring-mc-accent"
                      />
                      <span className="text-sm text-mc-text">Create regression testing tasks when:</span>
                      <select
                        value={watchdogForm?.regression_trigger || 'sprint finish'}
                        onChange={(e) => updateWatchdogForm({ regression_trigger: e.target.value })}
                        className="ml-2 px-2 py-1 bg-mc-bg border border-mc-border rounded text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                      >
                        <option value="sprint finish">Sprint finishes</option>
                        <option value="each task done">Each task done</option>
                        <option value="each 3 tasks done">Every 3 tasks done</option>
                        <option value="each 2h">Every 2 hours</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - 30% - Event Log */}
            <div className="flex-[30] bg-mc-bg-secondary rounded-lg border border-mc-border p-4 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-semibold text-mc-text">Event Log</h3>
                <button
                  onClick={loadWatchdogLogs}
                  className="text-xs text-mc-accent hover:underline"
                >
                  Refresh
                </button>
              </div>
              
              <div className="flex-1 overflow-auto space-y-2">
                {watchdogLogs.length === 0 ? (
                  <p className="text-sm text-mc-text-secondary text-center py-8">No events yet</p>
                ) : (
                  watchdogLogs.map((log: any) => (
                    <div key={log.id} className="bg-mc-bg rounded p-2 border border-mc-border text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          log.status === 'success' ? 'bg-green-400' :
                          log.status === 'error' ? 'bg-red-400' :
                          log.status === 'warning' ? 'bg-yellow-400' :
                          'bg-blue-400'
                        }`} />
                        <span className="text-xs text-mc-text-secondary">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                        <span className="text-xs text-mc-text-secondary bg-mc-bg-tertiary px-1 rounded">
                          {log.execution_type}
                        </span>
                      </div>
                      <p className="text-mc-text">{log.message}</p>
                      {log.details && (
                        <p className="text-xs text-mc-text-secondary mt-1">{log.details}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prompts' && product && (
          <PromptsTab productId={product.id} />
        )}

      </main>
    </div>
  </>
  );
}
