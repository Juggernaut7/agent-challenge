"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { listTemplates } from "@/lib/workflow/templates";

interface Step2PlaceholderProps {
  onReset: () => void;
  onCreateWorkflow: () => void;
  onLoadWorkflow?: (workflowId: string) => void;
  onLoadTemplate?: (templateId: string) => void;
}

interface Workflow {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
}

export default function Step2Placeholder({ onReset, onCreateWorkflow, onLoadWorkflow, onLoadTemplate }: Step2PlaceholderProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeTab, setActiveTab] = useState<"workflows" | "templates">("templates");
  const templates = listTemplates();

  useEffect(() => {
    // Load workflows from API
    const loadWorkflows = async () => {
      try {
        const response = await fetch('/api/workflows');
        const data = await response.json();

        if (data.workflows && Array.isArray(data.workflows)) {
          setWorkflows(data.workflows.map((w: any) => ({
            id: w.id,
            title: w.name,
            description: w.description,
            createdAt: new Date(w.updatedAt || w.createdAt).toLocaleDateString(),
          })));
        }
      } catch (error) {
        console.error('Error loading workflows:', error);
      }
    };

    loadWorkflows();
  }, []);

  return (
    <div className="max-w-[900px] mx-auto w-full">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-24"
      >
        <h2 className="text-title-h2 text-text-primary mb-8">Get Started</h2>
        <p className="text-body-large text-text-secondary">
          Create a new workflow, use a template, or continue where you left off
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex justify-center gap-8 mb-24">
        <button
          onClick={() => setActiveTab("workflows")}
          className={`px-20 py-10 rounded-8 text-body-medium transition-all ${
            activeTab === "workflows"
              ? "bg-primary-green text-white shadow-[0_0_12px_rgba(34,197,94,0.2)]"
              : "bg-card-bg text-text-secondary hover:text-text-primary hover:bg-white/5 border border-border-system"
          }`}
        >
          Your Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-20 py-10 rounded-8 text-body-medium transition-all ${
            activeTab === "templates"
              ? "bg-primary-green text-white shadow-[0_0_12px_rgba(34,197,94,0.2)]"
              : "bg-card-bg text-text-secondary hover:text-text-primary hover:bg-white/5 border border-border-system"
          }`}
        >
          Templates ({templates.length})
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 mb-32">
        {/* Create Workflow Tile - Always first */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.5,
            delay: 0,
            ease: "easeOut"
          }}
          className="relative cursor-pointer"
          onClick={onCreateWorkflow}
        >
          <div className="bg-card-bg rounded-12 p-24 border-2 border-dashed border-border-system hover:border-accent-green transition-all h-full flex items-center justify-center min-h-[160px] group">
            <div className="text-center">
              <div className="w-48 h-48 rounded-full bg-primary-green/10 flex items-center justify-center mx-auto mb-12 group-hover:scale-110 transition-transform">
                <svg className="w-24 h-24 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-label-large text-text-primary font-medium">Create Workflow</h3>
            </div>
          </div>
        </motion.div>

        {/* Show Workflows or Templates based on tab */}
        {activeTab === "workflows" ? (
          workflows.length > 0 ? (
            workflows.map((workflow, index) => (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: (index + 1) * 0.1,
                  ease: "easeOut"
                }}
                className="relative cursor-pointer"
                onClick={() => onLoadWorkflow?.(workflow.id)}
              >
                <div className="bg-card-bg rounded-12 p-24 border border-border-system hover:border-accent-green hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all h-full min-h-[160px] group">
                  <div className="absolute inset-0 rounded-12 bg-gradient-to-br from-primary-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <h3 className="text-label-large text-text-primary font-medium mb-8">{workflow.title}</h3>
                    {workflow.description && (
                      <p className="text-body-small text-text-secondary mb-12 line-clamp-2">{workflow.description}</p>
                    )}
                    <p className="text-body-small text-text-muted">Updated {workflow.createdAt}</p>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-1 lg:col-span-3 flex items-center justify-center min-h-[160px]">
              <p className="text-body-medium text-black-alpha-48">No saved workflows yet</p>
            </div>
          )
        ) : (
          templates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: (index + 1) * 0.1,
                ease: "easeOut"
              }}
              className="relative cursor-pointer"
              onClick={() => onLoadTemplate?.(template.id)}
            >
              <div className="bg-card-bg rounded-12 p-24 border border-border-system hover:border-accent-green hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all h-full min-h-[160px] relative overflow-hidden group">
                <div className="relative">
                  <h3 className="text-label-large text-text-primary font-medium mb-8">{template.name}</h3>
                  <p className="text-body-small text-text-secondary line-clamp-2">{template.description}</p>
                  <div className="mt-12 inline-flex items-center gap-6 text-body-small text-accent-green font-medium group-hover:translate-x-2 transition-transform">
                    <span>Use template</span>
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Action Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="flex justify-center"
      >
        <button
          onClick={onReset}
          className="px-24 py-12 text-label-large text-text-muted hover:text-text-primary transition-colors"
        >
          Back
        </button>
      </motion.div>
    </div>
  );
}