/**
 * Linux Terminal Agent (LTA) Type Definitions
 * Compatible with nimajavan/terminal_agent Plan Schema v2.0
 */

export type DangerLevel = 'SAFE' | 'CAUTION' | 'DANGEROUS' | 'BLOCKED';

export interface SafetyAssessment {
  level: DangerLevel;
  reasons: string[];
  isBlocked: boolean;
  requiresConfirmation: boolean;
  suggestedSafeAlternative?: string;
}

export type ToolType =
  | 'shell'
  | 'read_file'
  | 'write_file'
  | 'change_directory'
  | 'service'
  | 'http_check'
  | 'inspect'
  | 'network_traffic';

export interface StepVerification {
  tool?: string;
  args?: Record<string, unknown>;
  expected_exit?: number;
  contains?: string;
  url?: string;
  status_code?: number;
  passed?: boolean;
  message?: string;
}

export interface PlanStep {
  id: string;
  title: string;
  tool: ToolType;
  args: Record<string, any>;
  depends_on?: string[];
  accept_exit_codes?: number[];
  verify?: StepVerification[];
  safety?: SafetyAssessment;
  // Runtime status
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'blocked';
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  verified?: boolean;
  verificationResults?: StepVerification[];
}

export interface LTAPlan {
  goal: string;
  summary: string;
  steps: PlanStep[];
  model?: string;
  provider?: string;
  createdAt?: string;
  sessionId?: string;
}

export interface CommandExploration {
  command: string;
  summary: string;
  summaryFa: string;
  tokens: {
    token: string;
    description: string;
    descriptionFa: string;
    type: 'binary' | 'flag' | 'argument' | 'operator' | 'pipe';
  }[];
  dangerLevel: DangerLevel;
  warnings: string[];
  posixCompliant: boolean;
  safeAlternative?: string;
}

export interface DoctorFinding {
  id: string;
  title: string;
  titleFa: string;
  severity: 'ok' | 'warning' | 'critical';
  details: string;
  detailsFa: string;
  suggestedAction?: string;
  repairPlan?: LTAPlan;
}

export interface DoctorReport {
  service: string;
  url?: string;
  timestamp: string;
  healthy: boolean;
  findings: DoctorFinding[];
  diagnosticOutputs: { check: string; command: string; output: string; exitCode: number }[];
  repairProposed?: boolean;
}

export interface SkillParam {
  name: string;
  label: string;
  labelFa: string;
  type: 'string' | 'number' | 'boolean' | 'choice';
  default?: any;
  choices?: string[];
  required?: boolean;
  description: string;
  descriptionFa: string;
}

export interface SkillPack {
  id: string;
  name: string;
  nameFa: string;
  version: string;
  category: 'system' | 'network' | 'devops' | 'storage' | 'security';
  description: string;
  descriptionFa: string;
  parameters: SkillParam[];
  generatePlan: (params: Record<string, any>) => LTAPlan;
  rawJson?: string;
  isCustom?: boolean;
}

export interface SystemStatus {
  osName: string;
  kernel: string;
  arch: string;
  hostname: string;
  uptime: string;
  uptimeSeconds: number;
  cpuModel: string;
  cpuCores: number;
  cpuLoad: number[];
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
    mountPoint: string;
  };
  currentDir: string;
  activeShell: string;
  openPorts: {
    proto: string;
    localAddress: string;
    port: number;
    process?: string;
  }[];
}

export interface FileBackupRecord {
  id: string;
  path: string;
  originalContent: string;
  newContent: string;
  diff: string;
  timestamp: string;
  hash: string;
}

export interface UsageBudget {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
  estimatedCostUsd: number;
  budgetLimitUsd: number;
  lastLatencyMs: number;
}
