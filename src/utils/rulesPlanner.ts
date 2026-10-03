/**
 * Rule-Based Offline Planner for Linux Terminal Agent (LTA)
 * Supports English and Persian natural language prompts.
 * Generates bounded LTA plans with dependencies, explicit exit codes and outcome verification.
 */

import { LTAPlan, PlanStep } from '../types/terminal';
import { analyzeCommand } from './safety';

export function matchRulePlan(query: string): LTAPlan | null {
  const q = query.trim().toLowerCase();

  // 1. Disk usage and large files
  if (
    /disk|حجم دیسک|فضای دیسک|فایل.*بزرگ|storage|df\b/i.test(q) ||
    /find.*large|large.*file|فایل‌های حجیم/i.test(q)
  ) {
    const steps: PlanStep[] = [
      {
        id: 'step_df',
        title: 'Inspect filesystem disk volume allocation',
        tool: 'shell',
        args: { command: 'df -h' },
        accept_exit_codes: [0],
        verify: [{ tool: 'shell', args: { command: 'df -h' }, expected_exit: 0, contains: '/' }],
      },
      {
        id: 'step_find_large',
        title: 'Locate largest files and directories in current project',
        tool: 'shell',
        args: { command: 'du -ah . 2>/dev/null | sort -rh | head -n 15' },
        depends_on: ['step_df'],
        accept_exit_codes: [0],
      },
    ];
    return attachSafety({
      goal: 'Inspect disk usage and identify largest files',
      summary: 'Runs df -h to check available storage and du to locate space-consuming files.',
      steps,
    });
  }

  // 2. Memory / RAM usage
  if (/memory|ram|رم|حافظه|swap|سواپ|oom/i.test(q)) {
    const steps: PlanStep[] = [
      {
        id: 'step_free',
        title: 'Check physical RAM and swap allocation',
        tool: 'shell',
        args: { command: 'free -h' },
        accept_exit_codes: [0],
        verify: [{ tool: 'shell', args: { command: 'free -m' }, expected_exit: 0, contains: 'Mem:' }],
      },
      {
        id: 'step_top_mem',
        title: 'List top 10 memory-consuming processes',
        tool: 'shell',
        args: { command: 'ps aux --sort=-%mem | head -n 11' },
        depends_on: ['step_free'],
        accept_exit_codes: [0],
      },
    ];
    return attachSafety({
      goal: 'Inspect memory allocation and identify heavy processes',
      summary: 'Runs free -h to check RAM/swap and lists the top memory-hungry processes.',
      steps,
    });
  }

  // 3. Network Traffic & Open Ports
  if (/traffic|ترافیک|bandwidth|پهنای باند|rx|tx/i.test(q)) {
    const steps: PlanStep[] = [
      {
        id: 'step_traffic',
        title: 'Sample interface RX/TX throughput for 5 seconds',
        tool: 'network_traffic',
        args: { seconds: 5, interval: 1 },
        accept_exit_codes: [0],
      },
      {
        id: 'step_iface_stats',
        title: 'Inspect network link interface stats',
        tool: 'shell',
        args: { command: 'ip -s link' },
        depends_on: ['step_traffic'],
        accept_exit_codes: [0],
      },
    ];
    return attachSafety({
      goal: 'Sample live network traffic and inspect network interfaces',
      summary: 'Samples network interface throughput counters and reads interface transmission stats.',
      steps,
    });
  }

  if (/port|پورت|listening|socket|ساکت|اتصالات شبکه/i.test(q)) {
    const steps: PlanStep[] = [
      {
        id: 'step_ports',
        title: 'List active listening TCP and UDP sockets with process identifiers',
        tool: 'shell',
        args: { command: 'ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || ss -tul' },
        accept_exit_codes: [0],
        verify: [{ tool: 'shell', args: { command: 'ss -tul' }, expected_exit: 0, contains: 'Netid' }],
      },
    ];
    return attachSafety({
      goal: 'Inspect active listening network ports and sockets',
      summary: 'Scans listening ports using ss/netstat to identify network listeners.',
      steps,
    });
  }

  // 4. Docker
  if (/docker|داکر|container|کانتینر/i.test(q)) {
    const steps: PlanStep[] = [
      {
        id: 'step_docker_ps',
        title: 'Check running and stopped Docker containers',
        tool: 'shell',
        args: { command: 'docker ps -a' },
        accept_exit_codes: [0, 1, 127],
      },
      {
        id: 'step_docker_stats',
        title: 'Inspect Docker container resource metrics',
        tool: 'shell',
        args: { command: 'docker stats --no-stream' },
        depends_on: ['step_docker_ps'],
        accept_exit_codes: [0, 1, 127],
      },
    ];
    return attachSafety({
      goal: 'Inspect Docker containers and resource consumption',
      summary: 'Lists all Docker containers and fetches one-shot resource metrics.',
      steps,
    });
  }

  // 5. Nginx & Web server
  if (/nginx|انجین‌ایکس|وب سرور|webserver|site.*down/i.test(q)) {
    const steps: PlanStep[] = [
      {
        id: 'step_nginx_test',
        title: 'Validate Nginx configuration syntax',
        tool: 'shell',
        args: { command: 'nginx -t 2>&1 || cat /etc/nginx/nginx.conf 2>/dev/null' },
        accept_exit_codes: [0, 1, 127],
      },
      {
        id: 'step_nginx_status',
        title: 'Check Nginx systemd service status',
        tool: 'service',
        args: { name: 'nginx', action: 'status' },
        depends_on: ['step_nginx_test'],
        accept_exit_codes: [0, 3],
      },
      {
        id: 'step_nginx_port',
        title: 'Verify HTTP port 80/443 listeners',
        tool: 'shell',
        args: { command: 'ss -tulpn | grep -E ":80 |:443 "' },
        depends_on: ['step_nginx_status'],
        accept_exit_codes: [0, 1],
      },
    ];
    return attachSafety({
      goal: 'Diagnose Nginx configuration and runtime service health',
      summary: 'Tests configuration syntax, examines system service state, and checks web port listeners.',
      steps,
    });
  }

  // 6. Systemd Failed Services
  if (/failed|service|سرویس|systemd|داکتور|doctor/i.test(q)) {
    const steps: PlanStep[] = [
      {
        id: 'step_systemd_failed',
        title: 'Check for degraded or failed system services',
        tool: 'shell',
        args: { command: 'systemctl --failed' },
        accept_exit_codes: [0],
        verify: [{ tool: 'shell', args: { command: 'systemctl is-system-running' }, expected_exit: 0 }],
      },
      {
        id: 'step_journal_errors',
        title: 'Inspect recent high-priority system journal errors',
        tool: 'shell',
        args: { command: 'journalctl -p 3 -xb -n 25 2>/dev/null || journalctl -n 25' },
        depends_on: ['step_systemd_failed'],
        accept_exit_codes: [0, 1],
      },
    ];
    return attachSafety({
      goal: 'Diagnose degraded system services and journal errors',
      summary: 'Finds failed systemd units and retrieves the latest critical error journal entries.',
      steps,
    });
  }

  // 7. Git operations
  if (/git|گیت|مخزن|commit|کامیت|تغییرات/i.test(q)) {
    const steps: PlanStep[] = [
      {
        id: 'step_git_status',
        title: 'Inspect Git working tree status',
        tool: 'inspect',
        args: { kind: 'git_status' },
        accept_exit_codes: [0, 128],
      },
      {
        id: 'step_git_diff',
        title: 'Review uncommitted changes in current branch',
        tool: 'inspect',
        args: { kind: 'git_diff' },
        depends_on: ['step_git_status'],
        accept_exit_codes: [0, 128],
      },
      {
        id: 'step_git_log',
        title: 'Inspect last 5 commit messages',
        tool: 'inspect',
        args: { kind: 'git_log' },
        depends_on: ['step_git_status'],
        accept_exit_codes: [0, 128],
      },
    ];
    return attachSafety({
      goal: 'Inspect Git repository state, working changes, and history',
      summary: 'Executes git status, git diff, and recent git log for safe project inspection.',
      steps,
    });
  }

  // 8. CPU & System Overview
  if (/cpu|پردازنده|load|لود|uptime|آپ‌تایم|سیستم/i.test(q)) {
    const steps: PlanStep[] = [
      {
        id: 'step_uptime',
        title: 'Check system uptime, active sessions, and 1/5/15 minute load averages',
        tool: 'shell',
        args: { command: 'uptime' },
        accept_exit_codes: [0],
      },
      {
        id: 'step_lscpu',
        title: 'Inspect CPU architecture and core layout',
        tool: 'shell',
        args: { command: 'lscpu | head -n 20 2>/dev/null || uname -a' },
        depends_on: ['step_uptime'],
        accept_exit_codes: [0],
      },
      {
        id: 'step_top_cpu',
        title: 'List top 10 processes by CPU consumption',
        tool: 'shell',
        args: { command: 'ps aux --sort=-%cpu | head -n 11' },
        depends_on: ['step_uptime'],
        accept_exit_codes: [0],
      },
    ];
    return attachSafety({
      goal: 'Inspect CPU load averages and active process utilization',
      summary: 'Runs uptime, gathers CPU architecture info, and lists top CPU-consuming processes.',
      steps,
    });
  }

  return null;
}

export function attachSafety(plan: LTAPlan): LTAPlan {
  for (const step of plan.steps) {
    if (step.tool === 'shell' && step.args?.command) {
      step.safety = analyzeCommand(step.args.command);
    } else if (step.tool === 'write_file') {
      step.safety = {
        level: 'CAUTION',
        reasons: ['File write mutation requires preview diff and automatic backup creation.'],
        isBlocked: false,
        requiresConfirmation: true,
      };
    } else if (step.tool === 'service' && ['restart', 'stop', 'disable'].includes(step.args?.action)) {
      step.safety = {
        level: 'CAUTION',
        reasons: [`Service action "${step.args.action}" alters running daemon state.`],
        isBlocked: false,
        requiresConfirmation: true,
      };
    } else {
      step.safety = {
        level: 'SAFE',
        reasons: ['Read-only inspection tool.'],
        isBlocked: false,
        requiresConfirmation: false,
      };
    }
  }
  return plan;
}
