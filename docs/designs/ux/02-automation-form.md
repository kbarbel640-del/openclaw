# Automation Configuration Form - UI Prototype

**Generated:** 2025-01-26
**Component:** Smart-Sync Fork Configuration Form (Multi-Step Wizard)
**Magic MCP Response:** Full form bundle with validation, step navigation, and animations

---

## ⚠️ Stack Translation Required

**Magic MCP Output:** React + shadcn/ui + Framer Motion
**Clawdbot Stack:** Lit Web Components + Tailwind v4 + Custom Design System

The code below provides **design patterns, styling, and UX concepts** but must be translated from React to Lit Web Components for Clawdbot.

### Key Translation Points:
- React `useState` → Lit reactive properties (`@state`)
- React components → Lit custom elements with `@customElement()` decorator
- Framer Motion page transitions → CSS animations or Web Animations API in Lit
- shadcn/ui components → Clawbot's existing design system components
- Form validation → Lit form handlers with reactive error states

---

## Installation

```bash
npm install framer-motion lucide-react @radix-ui/react-label @radix-ui/react-slot class-variance-authority @radix-ui/react-switch @radix-ui/react-select clsx tailwind-merge
```

---

## Component Files

### lib/utils.ts

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### components/ui/label.tsx

```typescript
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
```

### components/ui/textarea.tsx

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
```

### components/ui/switch.tsx

```typescript
"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
```

---

## Main Form Component (Multi-Step Wizard)

```typescript
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitFork,
  Clock,
  Link as LinkIcon,
  Brain,
  GitMerge,
  Bell,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Info
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// TypeScript Interfaces
interface FormData {
  name: string;
  description: string;
  schedule: string;
  customCron: string;
  upstreamUrl: string;
  forkUrl: string;
  aiProvider: string;
  aiModel: string;
  aiApiKey: string;
  enableAiReview: boolean;
  mergeStrategy: string;
  autoMerge: boolean;
  conflictResolution: string;
  emailNotifications: boolean;
  slackWebhook: string;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

interface StepConfig {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

// Utility
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

// Step Configuration
const steps: StepConfig[] = [
  { id: 1, title: 'Basic Info', description: 'Name and description', icon: GitFork },
  { id: 2, title: 'Schedule', description: 'Sync frequency', icon: Clock },
  { id: 3, title: 'Repositories', description: 'Source and target', icon: LinkIcon },
  { id: 4, title: 'AI Settings', description: 'AI-powered features', icon: Brain },
  { id: 5, title: 'Merge Behavior', description: 'Merge strategy', icon: GitMerge },
  { id: 6, title: 'Notifications', description: 'Alert preferences', icon: Bell }
];

// Main Form Component
const AutomationConfigForm: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    schedule: 'daily',
    customCron: '',
    upstreamUrl: '',
    forkUrl: '',
    aiProvider: 'openai',
    aiModel: 'gpt-4',
    aiApiKey: '',
    enableAiReview: false,
    mergeStrategy: 'merge',
    autoMerge: false,
    conflictResolution: 'manual',
    emailNotifications: true,
    slackWebhook: '',
    notifyOnSuccess: true,
    notifyOnFailure: true
  });

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = 'Name is required';
    }
    if (step === 2) {
      if (formData.schedule === 'custom' && !formData.customCron.trim()) {
        newErrors.customCron = 'Custom cron expression is required';
      }
    }
    if (step === 3) {
      if (!formData.upstreamUrl.trim()) newErrors.upstreamUrl = 'Upstream URL is required';
      if (!formData.forkUrl.trim()) newErrors.forkUrl = 'Fork URL is required';
    }
    if (step === 4) {
      if (formData.enableAiReview && !formData.aiApiKey.trim()) {
        newErrors.aiApiKey = 'API key is required when AI review is enabled';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setDirection('forward');
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const handlePrevious = () => {
    setDirection('backward');
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      console.log('Form submitted:', formData);
      alert('Automation configured successfully!');
    }
  };

  // Animation variants
  const pageVariants = {
    initial: (direction: string) => ({
      x: direction === 'forward' ? 300 : -300,
      opacity: 0
    }),
    in: {
      x: 0,
      opacity: 1
    },
    out: (direction: string) => ({
      x: direction === 'forward' ? -300 : 300,
      opacity: 0
    })
  };

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.4
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg">
          {/* Header with Progress */}
          <CardHeader className="border-b border-border">
            <CardTitle className="text-2xl">Smart-Sync Fork Automation</CardTitle>
            <CardDescription>Configure your repository synchronization automation</CardDescription>

            {/* Progress Steps */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Step {currentStep} of {steps.length}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="overflow-hidden h-2 mb-6 text-xs flex rounded-full bg-muted">
                  <div
                    style={{ width: `${(currentStep / steps.length) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-500"
                  />
                </div>

                {/* Step Icons */}
                <div className="flex justify-between">
                  {steps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isCompleted = currentStep > step.id;
                    const isCurrent = currentStep === step.id;

                    return (
                      <div key={step.id} className="flex flex-col items-center">
                        <div
                          className={cn(
                            'rounded-full flex items-center justify-center transition-all w-10 h-10',
                            isCompleted && 'bg-primary text-primary-foreground',
                            isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                            !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {isCompleted ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <StepIcon className="w-5 h-5" />
                          )}
                        </div>
                        <div className="hidden sm:block mt-2 text-center">
                          <p className={cn(
                            'text-xs font-medium',
                            (isCurrent || isCompleted) ? 'text-primary' : 'text-muted-foreground'
                          )}>
                            {step.title}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentStep}
                custom={direction}
                variants={pageVariants}
                initial="initial"
                animate="in"
                exit="out"
                transition={pageTransition}
                className="min-h-[400px]"
              >
                {/* STEP 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Basic Information</h3>
                      <p className="text-sm text-muted-foreground">Give your automation a name and description</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Automation Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="My Fork Sync"
                          className={errors.name ? 'border-destructive' : ''}
                        />
                        {errors.name && (
                          <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {errors.name}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          placeholder="Describe what this automation does..."
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Schedule Configuration */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Sync Schedule</h3>
                      <p className="text-sm text-muted-foreground">Configure how often to sync your fork</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="schedule">Frequency</Label>
                        <Select value={formData.schedule} onValueChange={(value) => handleInputChange('schedule', value)}>
                          <SelectTrigger id="schedule">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Every Hour</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="custom">Custom (Cron)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Custom Cron Input */}
                      {formData.schedule === 'custom' && (
                        <div>
                          <Label htmlFor="customCron">Cron Expression *</Label>
                          <Input
                            id="customCron"
                            value={formData.customCron}
                            onChange={(e) => handleInputChange('customCron', e.target.value)}
                            placeholder="0 0 * * *"
                            className={errors.customCron ? 'border-destructive' : ''}
                          />
                          {errors.customCron && (
                            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {errors.customCron}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Use standard cron syntax (e.g., "0 0 * * *" for daily at midnight)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 3: Repository Configuration */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Repository URLs</h3>
                      <p className="text-sm text-muted-foreground">Specify the upstream and fork repositories</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="upstreamUrl">Upstream Repository URL *</Label>
                        <Input
                          id="upstreamUrl"
                          value={formData.upstreamUrl}
                          onChange={(e) => handleInputChange('upstreamUrl', e.target.value)}
                          placeholder="https://github.com/original/repo.git"
                          className={errors.upstreamUrl ? 'border-destructive' : ''}
                        />
                        {errors.upstreamUrl && (
                          <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {errors.upstreamUrl}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="forkUrl">Your Fork URL *</Label>
                        <Input
                          id="forkUrl"
                          value={formData.forkUrl}
                          onChange={(e) => handleInputChange('forkUrl', e.target.value)}
                          placeholder="https://github.com/yourusername/repo.git"
                          className={errors.forkUrl ? 'border-destructive' : ''}
                        />
                        {errors.forkUrl && (
                          <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {errors.forkUrl}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: AI Settings */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">AI-Powered Features</h3>
                      <p className="text-sm text-muted-foreground">Configure AI assistance for code review</p>
                    </div>

                    <div className="space-y-4">
                      {/* Enable AI Review Toggle */}
                      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="enableAiReview">Enable AI Code Review</Label>
                          <p className="text-sm text-muted-foreground">Use AI to analyze changes before merging</p>
                        </div>
                        <Switch
                          id="enableAiReview"
                          checked={formData.enableAiReview}
                          onCheckedChange={(checked) => handleInputChange('enableAiReview', checked)}
                        />
                      </div>

                      {/* AI Settings (shown when enabled) */}
                      {formData.enableAiReview && (
                        <>
                          <div>
                            <Label htmlFor="aiProvider">AI Provider</Label>
                            <Select value={formData.aiProvider} onValueChange={(value) => handleInputChange('aiProvider', value)}>
                              <SelectTrigger id="aiProvider">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="anthropic">Anthropic</SelectItem>
                                <SelectItem value="google">Google AI</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="aiModel">Model</Label>
                            <Select value={formData.aiModel} onValueChange={(value) => handleInputChange('aiModel', value)}>
                              <SelectTrigger id="aiModel">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gpt-4">GPT-4</SelectItem>
                                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                <SelectItem value="claude-3">Claude 3</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="aiApiKey">API Key *</Label>
                            <Input
                              id="aiApiKey"
                              type="password"
                              value={formData.aiApiKey}
                              onChange={(e) => handleInputChange('aiApiKey', e.target.value)}
                              placeholder="sk-..."
                              className={errors.aiApiKey ? 'border-destructive' : ''}
                            />
                            {errors.aiApiKey && (
                              <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                {errors.aiApiKey}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 5: Merge Behavior */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Merge Strategy</h3>
                      <p className="text-sm text-muted-foreground">Configure how changes are merged</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="mergeStrategy">Strategy</Label>
                        <Select value={formData.mergeStrategy} onValueChange={(value) => handleInputChange('mergeStrategy', value)}>
                          <SelectTrigger id="mergeStrategy">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="merge">Merge Commit</SelectItem>
                            <SelectItem value="rebase">Rebase</SelectItem>
                            <SelectItem value="squash">Squash and Merge</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="autoMerge">Auto-merge</Label>
                          <p className="text-sm text-muted-foreground">Automatically merge when no conflicts</p>
                        </div>
                        <Switch
                          id="autoMerge"
                          checked={formData.autoMerge}
                          onCheckedChange={(checked) => handleInputChange('autoMerge', checked)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="conflictResolution">Conflict Resolution</Label>
                        <Select value={formData.conflictResolution} onValueChange={(value) => handleInputChange('conflictResolution', value)}>
                          <SelectTrigger id="conflictResolution">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual Review</SelectItem>
                            <SelectItem value="upstream">Prefer Upstream</SelectItem>
                            <SelectItem value="fork">Prefer Fork</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 6: Notifications */}
                {currentStep === 6 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">Notification Settings</h3>
                      <p className="text-sm text-muted-foreground">Configure how you want to be notified</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="emailNotifications">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">Receive updates via email</p>
                        </div>
                        <Switch
                          id="emailNotifications"
                          checked={formData.emailNotifications}
                          onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="slackWebhook">Slack Webhook URL</Label>
                        <Input
                          id="slackWebhook"
                          value={formData.slackWebhook}
                          onChange={(e) => handleInputChange('slackWebhook', e.target.value)}
                          placeholder="https://hooks.slack.com/services/..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">Optional: Send notifications to Slack</p>
                      </div>

                      <div className="space-y-3 p-4 border border-border rounded-lg">
                        <Label>Notify on:</Label>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Successful sync</span>
                          <Switch
                            checked={formData.notifyOnSuccess}
                            onCheckedChange={(checked) => handleInputChange('notifyOnSuccess', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Failed sync</span>
                          <Switch
                            checked={formData.notifyOnFailure}
                            onCheckedChange={(checked) => handleInputChange('notifyOnFailure', checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {currentStep < steps.length ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit}>
                  <Check className="w-4 h-4 mr-2" />
                  Complete Setup
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function AutomationConfigDemo() {
  return <AutomationConfigForm />;
}
```

---

## Key Features Captured

### Multi-Step Wizard Pattern
1. **Progress Indicator** - Visual progress bar with step icons
2. **Step Navigation** - Previous/Next buttons with validation
3. **Animation** - Framer Motion slide transitions between steps
4. **Step Icons** - GitFork, Clock, Link, Brain, GitMerge, Bell icons

### Form Fields Per Step

**Step 1: Basic Info**
- Automation Name (required, with validation)
- Description (optional textarea)

**Step 2: Schedule**
- Frequency dropdown (Hourly, Daily, Weekly, Custom)
- Custom Cron expression input (conditional)

**Step 3: Repositories**
- Upstream Repository URL (required, validated)
- Fork Repository URL (required, validated)

**Step 4: AI Settings**
- Enable AI Review toggle
- AI Provider dropdown (conditional)
- AI Model dropdown (conditional)
- API Key input (conditional, password type)

**Step 5: Merge Behavior**
- Merge Strategy dropdown (Merge, Rebase, Squash)
- Auto-Merge toggle
- Conflict Resolution dropdown

**Step 6: Notifications**
- Email Notifications toggle
- Slack Webhook URL input
- Notify on Success toggle
- Notify on Failure toggle

### Validation & Error Handling
- Per-step validation before proceeding
- Error messages with AlertCircle icon
- Visual error states (red border)
- Help text with Info icon

### Styling Features
- Tailwind v4 CSS variables
- Dark mode support
- Responsive layout
- Card-based container
- Bordered sections for related controls

---

## Form Field Types for Clawdbot Lit Implementation

| React Component | Lit Equivalent |
|----------------|---------------|
| `<Input>` | `<input class="...">` with CSS classes |
| `<Textarea>` | `<textarea class="...">` with CSS classes |
| `<Switch>` | Custom toggle component (or `<input type="checkbox">` styled) |
| `<Select>` | Native `<select>` or custom dropdown |
| `<Label>` | `<label class="...">` with CSS classes |
| Framer Motion | CSS `@keyframes` or Web Animations API |

---

## Smart-Sync Fork Specific Fields Mapping

| Magic MCP Field | Smart-Sync Fork Field |
|-----------------|----------------------|
| `schedule` | `schedule.type` + `schedule.value` |
| `upstreamUrl` | `upstreamRepoUrl` |
| `forkUrl` | `forkRepoUrl` |
| `enableAiReview` | N/A (AI always used) |
| `aiProvider` | N/A (uses global default) |
| `aiModel` | `aiModel` (optional override) |
| `mergeStrategy` | `autoMergeMethod` |
| `autoMerge` | `autoMerge` |
| `conflictResolution` | `uncertaintyAction` |

Missing fields to add:
- `forkBranch` (default "main")
- `upstreamBranch` (default "main")
- `sshKeyPath` (dropdown with auto-detect)
- `confidenceThreshold` (slider 0-100, default 90)
- `maxWrongPathCorrections` (number, default 3)
- `maxMinutesPerConflict` (number, default 5)
