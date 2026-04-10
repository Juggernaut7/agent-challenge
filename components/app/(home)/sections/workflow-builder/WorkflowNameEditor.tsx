"use client";

import { useState, useEffect, ReactNode } from "react";
import { Workflow } from "@/lib/workflow/types";

interface WorkflowNameEditorProps {
  workflow: Workflow | null;
  onUpdate: (updates: Partial<Workflow>) => void;
  renameTrigger?: number;
  rightAccessory?: ReactNode;
  className?: string;
}

export default function WorkflowNameEditor({ 
  workflow, 
  onUpdate, 
  renameTrigger = 0, 
  rightAccessory,
  className = ""
}: WorkflowNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(workflow?.name || "New Workflow");

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
    }
  }, [workflow]);

  useEffect(() => {
    if (renameTrigger > 0) {
      setIsEditing(true);
    }
  }, [renameTrigger]);

  const handleSave = () => {
    if (name.trim()) {
      onUpdate({ name: name.trim() });
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setName(workflow?.name || "New Workflow");
      setIsEditing(false);
    }
  };

  if (!workflow) return null;

  return (
    <div className={`flex items-center gap-12 ${className}`}>
      {isEditing ? (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="px-8 py-4 bg-white/5 border border-primary-green rounded-4 text-label-medium text-text-primary focus:outline-none min-w-200 outline-none"
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="group px-8 py-4 hover:bg-white/5 rounded-4 text-label-medium text-text-primary transition-all flex items-center gap-8 border border-transparent hover:border-white/10"
        >
          <span className="font-bold tracking-tight">{name}</span>
          <svg className="w-12 h-12 text-text-muted group-hover:text-primary-green transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
      {rightAccessory && (
        <div className="flex items-center gap-8">
          {rightAccessory}
        </div>
      )}
    </div>
  );
}

