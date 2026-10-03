/**
 * Safety & Security Analyzer for Linux Terminal Commands
 * Ported & Enhanced from terminal_agent/core/safety.py
 */

import { DangerLevel, SafetyAssessment } from '../types/terminal';

interface SafetyPattern {
  regex: RegExp;
  reason: string;
  reasonFa: string;
  suggestedAlternative?: string;
}

export const BLOCKED_PATTERNS: SafetyPattern[] = [
  {
    regex: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+(\/|\/\*|~|\/\.\.|\/etc|\/boot|\/bin|\/usr)(\s|$)/,
    reason: 'Recursive deletion of root, home, or critical system directory is strictly blocked.',
    reasonFa: 'حذف بازگشتی دایرکتوری ریشه یا سیستم به طور کامل مسدود شده است.',
    suggestedAlternative: 'Specify a restricted subdirectory or use trash-cli / mv to quarantine files.',
  },
  {
    regex: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: 'Fork bomb detected: attempts to exhaust process table and crash the system.',
    reasonFa: 'بمب فورک تشخیص داده شد: باعث اشباع جدول پردازه‌ها و قفل شدن سرور می‌شود.',
    suggestedAlternative: 'Use ulimit or bounded loop with sleep for stress testing.',
  },
  {
    regex: /\bmkfs(\.\w+)?\s+\/dev\/(sd[a-z]|nvme\d+n\d+|hd[a-z]|vd[a-z])\b/,
    reason: 'Direct filesystem formatting of storage device destroys partition table.',
    reasonFa: 'فرمت مستقیم دیسک یا پارتیشن ذخیره‌سازی باعث نابودی کامل داده‌ها می‌شود.',
    suggestedAlternative: 'Inspect with lsblk or fdisk -l first.',
  },
  {
    regex: /\bdd\s+.*of=\/dev\/(sd[a-z]|nvme\d+n\d+|hd[a-z]|vd[a-z])\b/,
    reason: 'Direct block-level overwrite of disk device.',
    reasonFa: 'نوشتن مستقیم روی بلاک دیسک فیزیکی باعث تخریب داده‌ها می‌شود.',
    suggestedAlternative: 'dd into a safe image file (.img) instead of raw /dev device.',
  },
  {
    regex: />\s*\/dev\/(sd[a-z]|nvme\d+n\d+|hd[a-z]|vd[a-z])\b/,
    reason: 'Redirection write into raw disk block device.',
    reasonFa: 'تغییر مسیر نوشتن به دیوایس خام دیسک.',
    suggestedAlternative: 'Direct output to a regular file.',
  },
  {
    regex: /\bchmod\s+-[a-zA-Z]*R\s+777\s+\/\s*$/,
    reason: 'Global 777 permissions on root breaks the Linux security and permission model.',
    reasonFa: 'دسترسی سراسری ۷۷۷ روی ریشه مدل امنیتی لینوکس را نابود می‌کند.',
    suggestedAlternative: 'Apply specific permissions (e.g. 755/644) only to your project directory.',
  },
  {
    regex: />\s*\/dev\/kmem\b|>\s*\/dev\/mem\b/,
    reason: 'Direct write to kernel memory.',
    reasonFa: 'تلاش برای نوشتن مستقیم در حافظه کرنل لینوکس.',
    suggestedAlternative: 'Kernel modifications must use loaded modules with signature verification.',
  },
  {
    regex: /\b(mv|cp)\s+.*\s+\/dev\/null\s*$/,
    reason: 'Overwriting or corrupting /dev/null node.',
    reasonFa: 'تخریب یا بازنویسی نود سیستمی /dev/null.',
    suggestedAlternative: 'Use standard shell redirection `> /dev/null` instead of moving files over it.',
  },
];

export const DANGEROUS_PATTERNS: SafetyPattern[] = [
  {
    regex: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*\b/,
    reason: 'Recursive file or directory deletion.',
    reasonFa: 'حذف بازگشتی فایل‌ها و پوشه‌ها می‌تواند داده‌های غیرقابل بازگشت را پاک کند.',
    suggestedAlternative: 'List files first (`find ...` or `ls`), or use `rm -i` for interactive safety.',
  },
  {
    regex: /\b(shutdown|poweroff|reboot|halt|init\s+[06])\b/,
    reason: 'System reboot or poweroff command disrupts running services.',
    reasonFa: 'دستور ریبوت یا خاموش کردن سیستم، سرویس‌های جاری را قطع می‌کند.',
    suggestedAlternative: 'Check service health first before considering a full reboot.',
  },
  {
    regex: /\b(fdisk|parted|gdisk|sfdisk)\b/,
    reason: 'Partition table manipulation tool modifies drive layout.',
    reasonFa: 'ابزار دستکاری جدول پارتیشن‌ها.',
    suggestedAlternative: 'Use read-only `lsblk` or `parted -l` to inspect layout without changing it.',
  },
  {
    regex: /\biptables\s+-F\b|nft\s+flush\s+ruleset\b/,
    reason: 'Flushing firewall rules leaves host unprotected or can lock you out.',
    reasonFa: 'پاک‌کردن فایروال تمام پورت‌ها را باز می‌کند یا دسترسی SSH را قطع می‌کند.',
    suggestedAlternative: 'Inspect rules with `iptables -L -n -v` before applying targeted changes.',
  },
  {
    regex: /\bkill\s+-9\s+-1\b|pkill\s+-9\s+.*systemd/,
    reason: 'Mass process termination or killing init/systemd.',
    reasonFa: 'خاتمه دسته‌جمعی پروسه‌ها یا کشتن پردازه سیستمی اصلی.',
    suggestedAlternative: 'Target specific PID with graceful SIGTERM (`kill <PID>`).',
  },
  {
    regex: />\s*\/etc\/(passwd|shadow|sudoers|fstab)\b/,
    reason: 'Direct overwrite of critical authentication or filesystem mounts configuration.',
    reasonFa: 'بازنویسی مستقیم فایل‌های حساس احراز هویت لینوکس مانند passwd یا sudoers.',
    suggestedAlternative: 'Use safe management tools like `visudo` or `usermod`.',
  },
  {
    regex: /\bchown\s+-[a-zA-Z]*R\s+.*(\/|\/var|\/etc|\/usr)/,
    reason: 'Recursive ownership change on system directories.',
    reasonFa: 'تغییر مالکیت بازگشتی روی دایرکتوری‌های سیستمی.',
    suggestedAlternative: 'Scope chown strictly to your application folder (e.g. `/var/www/my-app`).',
  },
  {
    regex: /\b(dropdb|drop\s+database)\b/i,
    reason: 'Database drop command permanently removes database schemas and tables.',
    reasonFa: 'دستور حذف پایگاه داده تمام جداول را برای همیشه پاک می‌کند.',
    suggestedAlternative: 'Take a database dump backup (`pg_dump` / `mysqldump`) before dropping.',
  },
];

export const CAUTION_PATTERNS: SafetyPattern[] = [
  {
    regex: /\b(kill|pkill|killall)\b/,
    reason: 'Terminating running processes.',
    reasonFa: 'متوقف ساختن پردازه‌های در حال اجرا.',
    suggestedAlternative: 'Verify PID with `ps aux | grep <name>` before sending signal.',
  },
  {
    regex: /\b(systemctl|service)\s+(stop|restart|disable)\b/,
    reason: 'Stopping, restarting or disabling a system service.',
    reasonFa: 'توقف یا ریستارت سرویس سیستمی.',
    suggestedAlternative: 'Inspect `systemctl status <service>` and `journalctl -u <service> -e` first.',
  },
  {
    regex: /\b(apt-get|apt|dnf|yum|pacman|zypper|apk)\s+(remove|purge|erase|-R)\b/,
    reason: 'Package removal may remove dependent packages.',
    reasonFa: 'حذف بسته نرم‌افزاری ممکن است وابستگی‌های دیگر را نیز حذف کند.',
    suggestedAlternative: 'Check simulation (`apt-get remove --dry-run`).',
  },
  {
    regex: /\bgit\s+(reset\s+--hard|clean\s+-[a-zA-Z]*f)/,
    reason: 'Destructive git operation discards uncommitted code changes.',
    reasonFa: 'دستور مخرب گیت که تغییرات ذخیره‌نشده را برای همیشه پاک می‌کند.',
    suggestedAlternative: 'Use `git stash` before resetting to keep uncommitted changes safe.',
  },
  {
    regex: /\b(chmod|chown)\b/,
    reason: 'Modifying file permissions or user ownership.',
    reasonFa: 'تغییر مجوز یا دسترسی فایل‌ها.',
  },
  {
    regex: /\bsudo\b/,
    reason: 'Command requests elevated superuser (root) privileges.',
    reasonFa: 'دستور نیاز به دسترسی کاربر ریشه (sudo) دارد.',
  },
  {
    regex: /\bcurl\b.*\|\s*(bash|sh)\b/,
    reason: 'Piping remote web scripts directly into shell execution is a security risk.',
    reasonFa: 'اجرای مستقیم اسکریپت دانلود شده از وب در شل خطر امنیتی دارد.',
    suggestedAlternative: 'Download script to file first (`curl -o install.sh ...`), inspect it, then run.',
  },
];

export const SAFE_INSPECTION_PATTERNS: RegExp[] = [
  /^ls(\s+-[a-zA-Z0-9]+)*(\s+[^\s;&|]+)?$/,
  /^cat(\s+-[a-zA-Z0-9]+)*(\s+[^\s;&|]+)?$/,
  /^head(\s+-[a-zA-Z0-9]+)*(\s+[^\s;&|]+)?$/,
  /^tail(\s+-[a-zA-Z0-9]+)*(\s+[^\s;&|]+)?$/,
  /^grep(\s+-[a-zA-Z0-9]+)*(\s+[^\s;&|]+)*$/,
  /^df(\s+-[a-zA-Z0-9]+)*$/,
  /^du(\s+-[a-zA-Z0-9]+)*(\s+[^\s;&|]+)?$/,
  /^free(\s+-[a-zA-Z0-9]+)*$/,
  /^uptime$/,
  /^uname(\s+-[a-zA-Z0-9]+)*$/,
  /^pwd$/,
  /^whoami$/,
  /^ps(\s+-[a-zA-Z0-9]+)*$/,
  /^top(\s+-[a-zA-Z0-9]+)*$/,
  /^ss(\s+-[a-zA-Z0-9]+)*$/,
  /^netstat(\s+-[a-zA-Z0-9]+)*$/,
  /^ip(\s+-[a-zA-Z0-9]+)*\s+(addr|link|route|neigh)$/,
  /^systemctl\s+status\s+[a-zA-Z0-9@_.-]+$/,
  /^systemctl\s+is-active\s+[a-zA-Z0-9@_.-]+$/,
  /^journalctl(\s+-[a-zA-Z0-9]+)*$/,
  /^docker\s+(ps|images|version|info)$/,
  /^git\s+(status|log|diff|branch|remote)$/,
];

export function analyzeCommand(cmd: string): SafetyAssessment {
  const trimmed = cmd.trim();

  // Check BLOCKED first
  for (const item of BLOCKED_PATTERNS) {
    if (item.regex.test(trimmed)) {
      return {
        level: 'BLOCKED',
        reasons: [item.reason],
        isBlocked: true,
        requiresConfirmation: true,
        suggestedSafeAlternative: item.suggestedAlternative,
      };
    }
  }

  // Check DANGEROUS
  for (const item of DANGEROUS_PATTERNS) {
    if (item.regex.test(trimmed)) {
      return {
        level: 'DANGEROUS',
        reasons: [item.reason],
        isBlocked: false,
        requiresConfirmation: true,
        suggestedSafeAlternative: item.suggestedAlternative,
      };
    }
  }

  // Check CAUTION
  const cautionReasons: string[] = [];
  let suggestedAlt: string | undefined;
  for (const item of CAUTION_PATTERNS) {
    if (item.regex.test(trimmed)) {
      cautionReasons.push(item.reason);
      if (!suggestedAlt && item.suggestedAlternative) {
        suggestedAlt = item.suggestedAlternative;
      }
    }
  }
  if (cautionReasons.length > 0) {
    return {
      level: 'CAUTION',
      reasons: cautionReasons,
      isBlocked: false,
      requiresConfirmation: true,
      suggestedSafeAlternative: suggestedAlt,
    };
  }

  // Check if matches known safe inspection
  for (const safeRegex of SAFE_INSPECTION_PATTERNS) {
    if (safeRegex.test(trimmed)) {
      return {
        level: 'SAFE',
        reasons: ['Recognized read-only inspection command with no state mutations.'],
        isBlocked: false,
        requiresConfirmation: false,
      };
    }
  }

  // Default: if it doesn't match known safe, treat as Safe or Caution based on pipes / operators
  if (trimmed.includes(';') || trimmed.includes('&&') || trimmed.includes('|')) {
    return {
      level: 'CAUTION',
      reasons: ['Command composition with pipes or logical operators requires review.'],
      isBlocked: false,
      requiresConfirmation: true,
    };
  }

  return {
    level: 'SAFE',
    reasons: ['Standard execution command without high-risk indicators.'],
    isBlocked: false,
    requiresConfirmation: false,
  };
}
