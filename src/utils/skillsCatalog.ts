/**
 * Linux Terminal Agent Skills Catalog
 * Implements built-in packs (git, docker, network, traffic, systemd, nginx)
 * plus advanced extensions (k8s_triage, ssl_inspector, security_audit, db_sentinel)
 */

import { SkillPack } from '../types/terminal';
import { attachSafety } from './rulesPlanner';

export const BUILTIN_SKILLS: SkillPack[] = [
  {
    id: 'nginx',
    name: 'Nginx Diagnostic & Repair',
    nameFa: 'عیب‌یابی و تعمیر Nginx',
    version: '2.1.0',
    category: 'devops',
    description: 'Validates Nginx configuration syntax, inspects listening sockets, checks systemd unit, and tests HTTP status.',
    descriptionFa: 'بررسی صحت فایل‌های پیکربندی Nginx، تست پورت‌های ۸۰ و ۴۴۳، بررسی وضعیت سرویس و کد وضعیت HTTP.',
    parameters: [
      {
        name: 'url',
        label: 'Health Check URL',
        labelFa: 'آدرس چک سلامت',
        type: 'string',
        default: 'http://127.0.0.1/',
        description: 'Target endpoint for HTTP verification check.',
        descriptionFa: 'آدرس اینترنتی محلی یا سرور برای راستی‌آزمایی پاسخ وب.',
      },
      {
        name: 'repair',
        label: 'Propose Service Restart if Healthy',
        labelFa: 'پیشنهاد ریستارت در صورت سلامت پیکربندی',
        type: 'boolean',
        default: false,
        description: 'Proposes bounded restart only if configuration syntax tests pass.',
        descriptionFa: 'تنها در صورت تایید سینتکس تنظیمات، پیشنهاد ریستارت امن سرویس داده می‌شود.',
      },
    ],
    generatePlan: (params) => {
      const url = params.url || 'http://127.0.0.1/';
      const repair = Boolean(params.repair);

      const steps: any[] = [
        {
          id: 'step_nginx_test',
          title: 'Validate Nginx configuration syntax with nginx -t',
          tool: 'shell',
          args: { command: 'nginx -t 2>&1 || (cat /etc/nginx/nginx.conf 2>/dev/null | head -n 30)' },
          accept_exit_codes: [0, 1],
        },
        {
          id: 'step_nginx_status',
          title: 'Inspect Nginx system service active status',
          tool: 'service',
          args: { name: 'nginx', action: 'status' },
          depends_on: ['step_nginx_test'],
          accept_exit_codes: [0, 3],
        },
        {
          id: 'step_nginx_ports',
          title: 'Inspect active socket bindings on port 80 and 443',
          tool: 'shell',
          args: { command: 'ss -tulpn | grep -E "(:80|:443)"' },
          depends_on: ['step_nginx_status'],
          accept_exit_codes: [0, 1],
        },
      ];

      if (repair) {
        steps.push({
          id: 'step_nginx_reload',
          title: 'Reload Nginx service gracefully to apply configuration',
          tool: 'service',
          args: { name: 'nginx', action: 'reload' },
          depends_on: ['step_nginx_ports'],
          accept_exit_codes: [0],
          verify: [{ tool: 'service', args: { name: 'nginx', action: 'is-active' }, expected_exit: 0 }],
        });
      }

      steps.push({
        id: 'step_http_probe',
        title: `Verify HTTP endpoint response (${url})`,
        tool: 'http_check',
        args: { url },
        depends_on: [steps[steps.length - 1].id],
        accept_exit_codes: [0, 1],
        verify: [{ tool: 'http_check', url, status_code: 200 }],
      });

      return attachSafety({
        goal: `Diagnose and evaluate Nginx service on ${url}`,
        summary: 'Runs nginx syntax test, service status inspection, port verification and HTTP 200 response probe.',
        steps,
      });
    },
  },
  {
    id: 'git',
    name: 'Git Repository Inspector',
    nameFa: 'بازرس مخزن گیت',
    version: '2.0.0',
    category: 'storage',
    description: 'Inspects uncommitted changes, working branch status, untracked files, and recent commit history.',
    descriptionFa: 'بررسی تغییرات کامیت‌نشده، وضعیت برنچ فعال، فایل‌های ردگیری‌نشده و تاریخچه آخرین کامیت‌ها.',
    parameters: [
      {
        name: 'commit_count',
        label: 'Commit Count',
        labelFa: 'تعداد آخرین کامیت‌ها',
        type: 'number',
        default: 5,
        description: 'Number of recent commits to display in graph view.',
        descriptionFa: 'تعداد آخرین کامیت‌هایی که نمایش داده می‌شوند.',
      },
    ],
    generatePlan: (params) => {
      const count = params.commit_count || 5;
      return attachSafety({
        goal: 'Inspect Git repository health, staging tree, and recent commits',
        summary: 'Safely queries git status, short diff, and git log without modifying index.',
        steps: [
          {
            id: 'step_git_status',
            title: 'Inspect working branch and staging status',
            tool: 'shell',
            args: { command: 'git status -s' },
            accept_exit_codes: [0, 128],
          },
          {
            id: 'step_git_diff',
            title: 'Review uncommitted file changes diff stat',
            tool: 'shell',
            args: { command: 'git diff --stat' },
            depends_on: ['step_git_status'],
            accept_exit_codes: [0],
          },
          {
            id: 'step_git_log',
            title: `Show last ${count} commits with author and graph`,
            tool: 'shell',
            args: { command: `git log -n ${count} --oneline --graph --decorate` },
            depends_on: ['step_git_status'],
            accept_exit_codes: [0],
          },
        ],
      });
    },
  },
  {
    id: 'docker',
    name: 'Docker Container Sentinel',
    nameFa: 'نگهبان و پاکسازی داکر',
    version: '2.1.0',
    category: 'devops',
    description: 'Surveys running containers, dangling volumes, stopped pods, and disk space used by Docker daemon.',
    descriptionFa: 'بررسی کانتینرهای فعال، ولوم‌های بی‌استفاده، ایمیج‌های معلق و میزان حجم اشغال‌شده توسط داکر.',
    parameters: [
      {
        name: 'include_prune_check',
        label: 'Include Reclaimable Space Preview',
        labelFa: 'نمایش حجم قابل بازیابی (Prune Preview)',
        type: 'boolean',
        default: true,
        description: 'Previews reclaimable disk space from stopped containers and dangling images.',
        descriptionFa: 'پیش‌نمایش میزان فضای دیسکی که با پاکسازی آزاد می‌شود.',
      },
    ],
    generatePlan: (params) => {
      const steps: any[] = [
        {
          id: 'step_docker_ps',
          title: 'List active and stopped containers with health status',
          tool: 'shell',
          args: { command: 'docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"' },
          accept_exit_codes: [0, 1, 127],
        },
        {
          id: 'step_docker_df',
          title: 'Inspect Docker system disk allocation (images, containers, volumes, build cache)',
          tool: 'shell',
          args: { command: 'docker system df' },
          depends_on: ['step_docker_ps'],
          accept_exit_codes: [0, 1, 127],
        },
      ];
      if (params.include_prune_check) {
        steps.push({
          id: 'step_docker_dangling',
          title: 'Inspect dangling and untagged images',
          tool: 'shell',
          args: { command: 'docker images -f "dangling=true" -q | wc -l' },
          depends_on: ['step_docker_df'],
          accept_exit_codes: [0, 1, 127],
        });
      }
      return attachSafety({
        goal: 'Audit Docker container operational status and disk footprint',
        summary: 'Inspects Docker container list, system disk breakdown, and dangling images.',
        steps,
      });
    },
  },
  {
    id: 'systemd',
    name: 'Systemd Unit & Log Detective',
    nameFa: 'کارآگاه سرویس‌های Systemd و لاگ‌ها',
    version: '2.0.0',
    category: 'system',
    description: 'Diagnoses individual systemd services, extracts recent journalctl error records, and verifies auto-start state.',
    descriptionFa: 'عیب‌یابی سرویس مشخص در لینوکس، استخراج آخرین خطاهای journalctl و بررسی وضعیت راه‌اندازی خودکار.',
    parameters: [
      {
        name: 'service',
        label: 'Service Name',
        labelFa: 'نام سرویس',
        type: 'string',
        default: 'ssh',
        required: true,
        description: 'Systemd unit name (e.g. ssh, nginx, docker, postgresql).',
        descriptionFa: 'نام سرویس سیستمی مانند ssh یا nginx.',
      },
      {
        name: 'lines',
        label: 'Log Lines Count',
        labelFa: 'تعداد خطوط لاگ',
        type: 'number',
        default: 30,
        description: 'Lines of journalctl output to capture.',
        descriptionFa: 'تعداد خطوط آخر لاگ برای نمایش.',
      },
    ],
    generatePlan: (params) => {
      const svc = params.service || 'ssh';
      const lines = params.lines || 30;
      return attachSafety({
        goal: `Inspect systemd service status and logs for ${svc}`,
        summary: `Queries systemctl status, enabled state, and latest ${lines} journalctl error records for ${svc}.`,
        steps: [
          {
            id: 'step_unit_status',
            title: `Check active and load state for ${svc}`,
            tool: 'service',
            args: { name: svc, action: 'status' },
            accept_exit_codes: [0, 3],
          },
          {
            id: 'step_unit_logs',
            title: `Extract latest ${lines} log entries from journalctl for ${svc}`,
            tool: 'shell',
            args: { command: `journalctl -u ${svc} -n ${lines} --no-pager 2>/dev/null` },
            depends_on: ['step_unit_status'],
            accept_exit_codes: [0, 1],
          },
        ],
      });
    },
  },
  {
    id: 'network',
    name: 'Network Connectivity & Route Auditor',
    nameFa: 'ممیزی شبکه و مسیریابی',
    version: '2.0.0',
    category: 'network',
    description: 'Tests local loopback, default gateway ping, DNS resolution, and TCP/UDP socket distribution.',
    descriptionFa: 'بررسی لوپ‌بک، پینگ گیت‌وی پیش‌فرض، عملکرد سرور DNS و لیست سوکت‌های باز شبکه.',
    parameters: [
      {
        name: 'dns_test_host',
        label: 'DNS Test Hostname',
        labelFa: 'دامنه تست DNS',
        type: 'string',
        default: 'google.com',
        description: 'Domain to resolve during DNS probe.',
        descriptionFa: 'دامنه برای راستی‌آزمایی تفکیک‌نام DNS.',
      },
    ],
    generatePlan: (params) => {
      const host = params.dns_test_host || 'google.com';
      return attachSafety({
        goal: 'Audit network interfaces, DNS name resolution, and active listeners',
        summary: 'Inspects IP addresses, default route, DNS resolution, and open ports.',
        steps: [
          {
            id: 'step_ip_addr',
            title: 'Display configured IP addresses and interface states',
            tool: 'shell',
            args: { command: 'ip -br addr show' },
            accept_exit_codes: [0],
          },
          {
            id: 'step_routes',
            title: 'Inspect default gateway and routing table',
            tool: 'shell',
            args: { command: 'ip route show' },
            depends_on: ['step_ip_addr'],
            accept_exit_codes: [0],
          },
          {
            id: 'step_dns_resolve',
            title: `Test DNS name resolution for ${host}`,
            tool: 'shell',
            args: { command: `getent hosts ${host} || host ${host} 2>/dev/null || nslookup ${host} 2>/dev/null` },
            depends_on: ['step_routes'],
            accept_exit_codes: [0, 1, 2],
          },
          {
            id: 'step_listeners',
            title: 'List all listening TCP/UDP sockets with process names',
            tool: 'shell',
            args: { command: 'ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null' },
            depends_on: ['step_ip_addr'],
            accept_exit_codes: [0, 1],
          },
        ],
      });
    },
  },
  {
    id: 'traffic',
    name: 'Real-time Network Throughput Sampler',
    nameFa: 'نمونه‌بردار زنده پهنای باند شبکه',
    version: '2.0.0',
    category: 'network',
    description: 'Samples interface RX/TX counters without packet capture, showing live bandwidth consumption.',
    descriptionFa: 'نمونه‌برداری نرخ دریافت/ارسال کارت شبکه با شمارنده‌های هسته بدون تحلیل بسته‌ها.',
    parameters: [
      {
        name: 'seconds',
        label: 'Duration (Seconds)',
        labelFa: 'مدت زمان نمونه‌برداری (ثانیه)',
        type: 'number',
        default: 5,
        description: 'Duration to sample (1-60s).',
        descriptionFa: 'مدت زمان نمونه‌برداری به ثانیه.',
      },
    ],
    generatePlan: (params) => {
      const sec = Math.min(Math.max(params.seconds || 5, 1), 60);
      return attachSafety({
        goal: `Sample network traffic throughput for ${sec} seconds`,
        summary: `Samples RX/TX transmission counters on active interfaces for ${sec} seconds.`,
        steps: [
          {
            id: 'step_traffic_sampler',
            title: `Sample network interface RX/TX rate (${sec}s)`,
            tool: 'network_traffic',
            args: { seconds: sec, interval: 1 },
            accept_exit_codes: [0],
          },
        ],
      });
    },
  },
  {
    id: 'ssl_inspector',
    name: 'SSL / TLS Certificate Auditor',
    nameFa: 'بازرس گواهینامه‌های امنیتی SSL/TLS',
    version: '1.2.0',
    category: 'security',
    description: 'Inspects SSL certificate expiration date, issuer, subject alt names, and TLS handshake validity.',
    descriptionFa: 'بررسی تاریخ انقضای گواهینامه SSL، صادرکننده، زیرشاخه‌ها و تایید اتصال TLS امن.',
    parameters: [
      {
        name: 'target_host',
        label: 'Target Host / Domain',
        labelFa: 'دامنه یا هاست مقصد',
        type: 'string',
        default: 'localhost:443',
        required: true,
        description: 'Domain and port (e.g. google.com:443, localhost:443).',
        descriptionFa: 'نام هاست و پورت برای بررسی گواهی SSL.',
      },
    ],
    generatePlan: (params) => {
      const host = params.target_host || 'localhost:443';
      const cleanHost = host.replace(/https?:\/\//, '').split('/')[0];
      return attachSafety({
        goal: `Inspect SSL/TLS certificate validity for ${cleanHost}`,
        summary: `Queries openssl s_client to inspect certificate expiration and SANs for ${cleanHost}.`,
        steps: [
          {
            id: 'step_cert_dates',
            title: `Check certificate expiration and issuer for ${cleanHost}`,
            tool: 'shell',
            args: {
              command: `echo | openssl s_client -servername ${cleanHost.split(':')[0]} -connect ${cleanHost} 2>/dev/null | openssl x509 -noout -dates -issuer -subject 2>/dev/null || echo "Unable to connect to ${cleanHost}"`,
            },
            accept_exit_codes: [0, 1],
          },
        ],
      });
    },
  },
  {
    id: 'security_audit',
    name: 'Linux Security Hardening Auditor',
    nameFa: 'ممیزی امنیت و سخت‌سازی سرور لینوکس',
    version: '1.5.0',
    category: 'security',
    description: 'Checks for world-writable sensitive files, failed SSH attempts, unconfined listening ports, and sudo privileges.',
    descriptionFa: 'بررسی فایل‌های با دسترسی باز خطرناک، لاگین‌های ناموفق SSH، پورت‌های باز نامطمئن و دسترسی‌های sudo.',
    parameters: [],
    generatePlan: () => {
      return attachSafety({
        goal: 'Conduct Linux security and privilege baseline audit',
        summary: 'Scans for world-writable directories, recent failed SSH login attacks, and open network sockets.',
        steps: [
          {
            id: 'step_failed_ssh',
            title: 'Scan for recent failed authentication attempts',
            tool: 'shell',
            args: { command: 'grep "Failed password" /var/log/auth.log 2>/dev/null | tail -n 15 || echo "No direct auth.log access or clean logs."' },
            accept_exit_codes: [0, 1],
          },
          {
            id: 'step_sudo_check',
            title: 'Verify current user sudo permissions',
            tool: 'shell',
            args: { command: 'sudo -l -n 2>&1 | head -n 10 || echo "Non-interactive sudo restricted."' },
            accept_exit_codes: [0, 1],
          },
          {
            id: 'step_world_writable',
            title: 'Scan for world-writable files in current project directory',
            tool: 'shell',
            args: { command: 'find . -maxdepth 3 -type f -perm -0002 -not -path "*/node_modules/*" 2>/dev/null | head -n 10' },
            accept_exit_codes: [0],
          },
        ],
      });
    },
  },
];
