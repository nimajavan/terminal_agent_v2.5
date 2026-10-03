# راهنمای جامع راه‌اندازی و دیپلوی استودیوی ایجنت ترمینال لینوکس (LTA Pro) روی سرور

این راهنما مراحل گام‌به‌گام برای راه‌اندازی و اجرای پایدار پروژه **Linux Terminal Agent (LTA Pro Studio)** روی سرورهای لینوکسی (Ubuntu 20.04/22.04/24.04، Debian 11/12، CentOS/RHEL/AlmaLinux) را آموزش می‌دهد.

---

## فهرست مطالب
1. [پیش‌نیازهای سیستم](#۱-پیش‌نیازهای-سیستم)
2. [آماده‌سازی اولیه سرور و نصب ابزارها](#۲-آماده‌سازی-اولیه-سرور-و-نصب-ابزارها)
3. [دریافت پروژه و نصب وابستگی‌ها](#۳-دریافت-پروژه-و-نصب-وابستگی‌ها)
4. [پیکربندی متغیرهای محیطی (`.env`)](#۴-پیکربندی-متغیرهای-محیطی-env)
5. [روش اول: استقرار مستقیم به عنوان سرویس سیستمی (Systemd Service) - توصیه شده](#۵-روش-اول-استقرار-مستقیم-با-systemd)
6. [روش دوم: استقرار با کانتینر داکر (Docker & Docker Compose)](#۶-روش-دوم-استقرار-با-داکر-docker)
7. [پیکربندی وب‌سرور Nginx به عنوان Reverse Proxy](#۷-پیکربندی-وب‌سرور-nginx-و-ssl)
8. [فعال‌سازی رایگان گواهینامه امنیتی SSL (Let's Encrypt)](#۸-فعال‌سازی-گواهینامه-ssl)
9. [تنظیم فایروال سرور (UFW / Firewalld)](#۹-تنظیم-فایروال-سرور)
10. [پایش لاگ‌ها، عیب‌یابی و آپدیت خودکار](#۱۰-پایش-لاگ‌ها-و-عیب‌یابی)

---

## ۱. پیش‌نیازهای سیستم

* **سیستم‌عامل:** لینوکس (ترجیحاً Ubuntu 22.04 LTS به بالا یا Debian 12)
* **سخت‌افزار حداقلی:**
  * پردازنده (CPU): ۲ هسته
  * رم (RAM): ۲ گیگابایت (۴ گیگابایت برای استفاده‌های پرمصرف)
  * فضای دیسک: ۱۰ گیگابایت حافظه آزاد SSD
* **دسترسی:** کاربر با دسترسی `sudo` یا کاربر `root`
* **نسخه‌های نرم‌افزاری مورد نیاز:**
  * Node.js نسخه 20.x یا 22.x LTS
  * NPM نسخه 10 به بالا
  * Python نسخه 3.8 به بالا (برای استفاده همزمان از ماژول‌های پایتونی LTA CLI)
  * Git

---

## ۲. آماده‌سازی اولیه سرور و نصب ابزارها

ابتدا مخازن سیستم را به‌روزرسانی کرده و ابزارهای پایه را نصب کنید:

```bash
# بروزرسانی مخازن لینوکس
sudo apt update && sudo apt upgrade -y

# نصب ابزارهای ضروری
sudo apt install -y curl wget git build-essential ufw nginx python3 python3-pip python3-venv
```

### نصب Node.js 22 LTS:
```bash
# اضافه کردن مخزن رسمی NodeSource برای نسخه 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# نصب Node.js و npm
sudo apt install -y nodejs

# بررسی نسخه‌های نصب‌شده
node -v   # باید v20.x یا v22.x باشد
npm -v    # باید 10.x به بالا باشد
```

---

## ۳. دریافت پروژه و نصب وابستگی‌ها

پروژه را درون دایرکتوری مناسب (مثلاً `/var/www/lta-agent` یا دایرکتوری خانگی کاربر) کلون کنید:

```bash
# ایجاد دایرکتوری اختصاصی برای برنامه
sudo mkdir -p /var/www/terminal_agent
sudo chown -R $USER:$USER /var/www/terminal_agent

# ورود به پوشه
cd /var/www/terminal_agent

# کلون مخزن (در صورت داشتن ریپازیتوری گیت‌هاب)
git clone https://github.com/nimajavan/terminal_agent.git .

# نصب تمام وابستگی‌های پروژه
npm install
```

---

## ۴. پیکربندی متغیرهای محیطی (`.env`)

فایل نمونه تنظیمات را به عنوان فایل اصلی محیطی کپی کرده و مقادیر لازم را وارد کنید:

```bash
cp .env.example .env
nano .env
```

محتوای فایل `.env`:
```env
# کلید API هوش مصنوعی جمینای (اختیاری در صورت استفاده از حالت لوکال یا Rule-Based)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# پورت اجرای برنامه روی سرور (پیش‌فرض: 3000)
PORT=3000

# آدرس دامنه سرور شما
APP_URL="https://terminal.yourdomain.com"

# حالت محیطی
NODE_ENV="production"
```
*نکته:* برای ذخیره در nano از `Ctrl + O` و سپس اینتر، و برای خروج از `Ctrl + X` استفاده کنید.

---

## ۵. روش اول: استقرار مستقیم با Systemd (توصیه شده)

استفاده از سرویس Systemd تضمین می‌کند که برنامه پس از ریبوت سرور یا بروز کرش، به طور خودکار دوباره اجرا شود.

### ۵.۱. کامپایل و بیلد نسخه پروداکشن
```bash
cd /var/www/terminal_agent
npm run build
```

### ۵.۲. ساخت فایل سرویس Systemd
یک فایل سرویس جدید در مسیر سیستم‌دی بسازید:
```bash
sudo nano /etc/systemd/system/lta.service
```

محتوای زیر را درون آن قرار دهید (نام کاربری `your_username` را با کاربر خودتان جایگزین کنید):
```ini
[Unit]
Description=Linux Terminal Agent Studio (LTA Pro)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/terminal_agent
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=lta-agent
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/var/www/terminal_agent/.env

[Install]
WantedBy=multi-user.target
```

### ۵.۳. فعال‌سازی و اجرای سرویس
```bash
# بارگذاری مجدد دیمن سیستم‌دی
sudo systemctl daemon-reload

# فعال‌سازی اجرای خودکار هنگام بوت
sudo systemctl enable lta.service

# شروع اجرای سرویس
sudo systemctl start lta.service

# بررسی وضعیت اجرا
sudo systemctl status lta.service
```

اگر خروجی سبز رنگ `active (running)` مشاهده کردید، سرویس با موفقیت فعال شده است.

---

## ۶. روش دوم: استقرار با داکر (Docker & Docker Compose)

در صورتی که می‌خواهید پروژه را در یک کانتینر مجزا اجرا کنید:

### ۶.۱. ساخت فایل `Dockerfile`:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache bash procps iproute2 curl util-linux
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]
```

### ۶.۲. ساخت فایل `docker-compose.yml`:
```yaml
version: '3.8'

services:
  lta-agent:
    build: .
    container_name: lta-studio
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    volumes:
      - lta-backups:/app/.lta_backups

volumes:
  lta-backups:
```

### ۶.۳. بیلد و اجرا:
```bash
docker compose up -d --build
docker compose ps
```

---

## ۷. پیکربندی وب‌سرور Nginx و SSL

برای ارائه امن وب‌سایت از طریق دامنه (مثلاً `terminal.yourdomain.com`) به جای پورت مستقیم ۳۰۰۰، از Nginx به عنوان Reverse Proxy استفاده کنید:

```bash
sudo nano /etc/nginx/sites-available/lta.conf
```

محتوای کانفیگ Nginx:
```nginx
server {
    listen 80;
    server_name terminal.yourdomain.com; # دامنه یا IP سرور خود را بگذارید

    # افزایش سقف حجم آپلود فایل‌ها برای انتقال اسناد و فایل‌های لاگ
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # تنظیم هدرها برای پشتیبانی از وب‌سوکت و رویدادهای زنده (SSE)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # تنظیم تایم‌اوت برای خروجی‌های طولانی دستورات شل
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

فعال‌سازی کانفیگ و تست صحت:
```bash
# ایجاد لینک به sites-enabled
sudo ln -s /etc/nginx/sites-available/lta.conf /etc/nginx/sites-enabled/

# تست سینتکس کانفیگ Nginx
sudo nginx -t

# ریلود Nginx در صورت سلامت سینتکس
sudo systemctl reload nginx
```

---

## ۸. فعال‌سازی گواهینامه SSL رایگان (Let's Encrypt)

پس از ثبت رکورد A دامنه در DNS سرور، دستور زیر را اجرا کنید تا گواهینامه HTTPS خودکار روی Nginx تنظیم شود:

```bash
# نصب Certbot و پلاگین Nginx
sudo apt install -y certbot python3-certbot-nginx

# دریافت و اعمال خودکار گواهی SSL
sudo certbot --nginx -d terminal.yourdomain.com
```
دستور بالا کانفیگ Nginx را به طور خودکار به پورت امن ۴۴۳ و ریدایرکت HTTPS مجهز می‌کند.

---

## ۹. تنظیم فایروال سرور (UFW)

برای امنیت کامل سرور، پورت‌های غیرضروری را بسته و تنها پورت‌های استاندارد را باز بگذارید:

```bash
# اجازه دسترسی به SSH (بسیار مهم: از دست ندادن دسترسی به سرور)
sudo ufw allow ssh

# اجازه دسترسی به وب‌سرور HTTP و HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# در صورتی که می‌خواهید مستقیماً پورت 3000 در دسترس باشد (اختیاری)
# sudo ufw allow 3000/tcp

# فعال‌سازی فایروال
sudo ufw enable

# بررسی وضعیت
sudo ufw status
```

---

## ۱۰. پایش لاگ‌ها، عیب‌یابی و آپدیت خودکار

### مشاهده لاگ‌های زنده برنامه:
```bash
# مشاهده لاگ‌های سرویس سیستم‌دی به صورت زنده
sudo journalctl -u lta.service -f -n 100

# ریستارت سریع سرویس
sudo systemctl restart lta.service
```

### تست سلامت از داخل سرور:
```bash
curl -I http://127.0.0.1:3000
curl -s http://127.0.0.1:3000/api/system/status | head -c 200
```

### نحوه آپدیت نسخه جدید پروژه:
```bash
cd /var/www/terminal_agent
git pull origin main
npm install
npm run build
sudo systemctl restart lta.service
```

اکنون استودیوی خودمختار **Linux Terminal Agent** با بالاترین پایداری و امنیت روی سرور شما در حال کار است.
