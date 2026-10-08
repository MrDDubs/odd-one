import os
from fpdf import FPDF
from fpdf.enums import XPos, YPos

class PDFReport(FPDF):
    def __init__(self):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.set_auto_page_break(auto=True, margin=16)
        self.set_margins(15, 12, 15)

    def header(self):
        if self.page_no() > 1:
            self.set_font('Helvetica', 'I', 8)
            self.set_text_color(120, 130, 145)
            self.cell(100, 6, "Ally's Stream Hub - Oracle Cloud Always Free Hosting Guide")
            self.cell(80, 6, f"Page {self.page_no()}", align='R', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_draw_color(226, 232, 240)
            self.set_line_width(0.3)
            self.line(15, 19, 195, 19)
            self.set_y(22)

    def footer(self):
        self.set_y(-12)
        self.set_font('Helvetica', '', 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 8, "Mr D Dubs | TikTok Live Gaming Suite | Free 24/7 Cloud Deployment", align='C')

    def chapter_title(self, num, title):
        # Prevent orphan headers at bottom of page
        if self.get_y() > 245:
            self.add_page()
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(30, 41, 59)
        self.set_fill_color(241, 245, 249) # Slate 100
        cur_y = self.get_y()
        self.rect(15, cur_y, 180, 7.5, 'F')
        self.set_xy(18, cur_y + 1)
        self.cell(174, 5.5, f"Step {num}: {title}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_y(cur_y + 9.5)

    def section_heading(self, title):
        if self.get_y() > 250:
            self.add_page()
        self.set_font('Helvetica', 'B', 10.5)
        self.set_text_color(30, 41, 59)
        self.cell(0, 5.5, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)

    def body_text(self, text):
        self.set_font('Helvetica', '', 9)
        self.set_text_color(51, 65, 85)
        self.multi_cell(180, 4.4, text)
        self.ln(1.5)

    def bullet_point(self, label, text):
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(30, 41, 59)
        lbl_str = f"- {label}: "
        lbl_w = self.get_string_width(lbl_str) + 1
        self.set_x(17)
        self.cell(lbl_w, 4.4, lbl_str)
        self.set_font('Helvetica', '', 9)
        self.set_text_color(71, 85, 105)
        rem_w = 195 - self.get_x()
        self.multi_cell(rem_w, 4.4, text)
        self.ln(1)

    def code_block(self, code_lines):
        lines = code_lines.strip().split('\n')
        h = len(lines) * 4.2 + 3.5
        if self.get_y() + h > 265:
            self.add_page()

        self.set_font('Courier', '', 8.2)
        self.set_text_color(30, 41, 59)
        self.set_fill_color(248, 250, 252)
        self.set_draw_color(203, 213, 225)
        self.set_line_width(0.2)
        
        cur_y = self.get_y()
        self.rect(15, cur_y, 180, h, 'DF')
        self.set_xy(18, cur_y + 1.8)
        for line in lines:
            self.set_x(18)
            self.cell(174, 4.2, line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_xy(15, cur_y + h + 2.5)

    def note_box(self, title, text, box_type="info"):
        if box_type == "warning":
            bg = (254, 242, 242)
            border = (239, 68, 68)
            t_col = (153, 27, 27)
        elif box_type == "tip":
            bg = (240, 253, 244)
            border = (34, 197, 94)
            t_col = (20, 83, 45)
        else:
            bg = (239, 246, 255)
            border = (59, 130, 246)
            t_col = (30, 58, 138)
            
        self.set_fill_color(*bg)
        self.set_draw_color(*border)
        self.set_line_width(0.3)
        
        # Calculate text height
        self.set_font('Helvetica', '', 8.2)
        lines_count = len(text.split('\n')) + 2
        h = max(13.0, lines_count * 4.0 + 4)
        if self.get_y() + h > 265:
            self.add_page()
            
        cur_y = self.get_y()
        self.rect(15, cur_y, 180, h, 'DF')
        
        self.set_xy(18, cur_y + 1.8)
        self.set_font('Helvetica', 'B', 8.5)
        self.set_text_color(*t_col)
        self.cell(174, 4.0, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        self.set_xy(18, cur_y + 6.0)
        self.set_font('Helvetica', '', 8.2)
        self.multi_cell(174, 3.8, text)
        self.set_xy(15, cur_y + h + 2.5)

def generate_guide():
    pdf = PDFReport()
    pdf.add_page()

    # --- Title Banner ---
    pdf.set_fill_color(30, 41, 59) # Slate 800
    pdf.rect(15, 12, 180, 28, 'F')
    
    pdf.set_xy(20, 16)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(170, 7, "Ally's Stream Hub", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_xy(20, 24)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_text_color(147, 197, 253) # Light Blue
    pdf.cell(170, 5, "24/7 Free Cloud Hosting Guide (Oracle Cloud Always Free)", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    pdf.set_xy(20, 30)
    pdf.set_font('Helvetica', 'I', 8)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(170, 4.5, "Host your TikTok Live game suite online with zero server fees, SSL, and PM2.", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_y(44)

    # --- Introduction / Overview ---
    pdf.section_heading("Overview & Prerequisites")
    pdf.body_text(
        "Host Ally's Stream Hub on Oracle Cloud Infrastructure (OCI) using their Always Free tier. "
        "Your server runs 24/7 online, accessible by OBS and mobile browsers anywhere in the world "
        "without keeping your personal computer running."
    )
    
    pdf.bullet_point("Oracle Cloud Account", "An active OCI account (credit card verified during signup, but $0 billed).")
    pdf.bullet_point("SSH Client", "PowerShell (built into Windows 10/11) or Windows Terminal.")
    pdf.bullet_point("Git Repository", "Your code at https://github.com/MrDDubs/odd-one.git")
    pdf.ln(1)

    # --- Step 1 ---
    pdf.chapter_title(1, "Create Free Compute Instance in Oracle Cloud")
    pdf.body_text("1. Sign in to your Oracle Cloud Console at https://cloud.oracle.com/")
    pdf.body_text("2. From the navigation menu (top-left hamburger), select Compute -> Instances.")
    pdf.body_text("3. Click Create Instance and configure the following parameters:")
    
    pdf.bullet_point("Name", "ally-stream-hub")
    pdf.bullet_point("Image", "Click 'Edit' -> select Canonical Ubuntu -> choose Ubuntu 22.04 or 24.04.")
    pdf.bullet_point("Shape", "Ampere ARM (VM.Standard.A1.Flex, 2 OCPUs, 12 GB RAM) - Always Free eligible.\n(If ARM capacity is temporarily full in your region, choose AMD VM.Standard.E2.1.Micro, 1 GB RAM).")
    pdf.bullet_point("Networking", "Leave default VCN. Confirm 'Assign a public IPv4 address' is checked.")
    pdf.bullet_point("SSH Keys", "Select 'Generate a key pair for me' -> click 'Save Private Key'. Store this .key file safely on your PC (e.g. C:\\Users\\Dwaynne\\oci_key.key).")
    
    pdf.body_text("4. Click Create at the bottom. Wait 1-2 minutes until status turns green (Running).")
    pdf.body_text("5. Copy your Public IP Address shown on the instance screen (e.g. 140.238.xx.xx).")
    pdf.ln(1)

    # --- Step 2 ---
    pdf.chapter_title(2, "Open Ports in Oracle Cloud Network (VCN Security List)")
    pdf.body_text("Oracle Cloud blocks incoming traffic by default. Open ports 80 (HTTP), 443 (HTTPS), and 4000 (Stream Hub):")
    pdf.body_text("1. On the Instance page, scroll down to Primary VNIC and click the Subnet link.")
    pdf.body_text("2. Under Security Lists, click on Default Security List for...")
    pdf.body_text("3. Click Add Ingress Rules and fill in:")
    pdf.bullet_point("Source CIDR", "0.0.0.0/0")
    pdf.bullet_point("IP Protocol", "TCP")
    pdf.bullet_point("Destination Port Range", "80, 443, 4000")
    pdf.bullet_point("Description", "Allow Web, HTTPS, and Stream Hub traffic")
    pdf.body_text("4. Click Add Ingress Rules.")
    pdf.ln(1)

    # --- Step 3 ---
    pdf.chapter_title(3, "Connect to your Server via SSH")
    pdf.body_text("Open PowerShell on your Windows PC and run:")
    pdf.code_block('ssh -i "C:\\path\\to\\your_saved_key.key" ubuntu@YOUR_PUBLIC_IP')
    pdf.body_text("Type 'yes' when prompted to accept the host key. You are now inside your cloud Ubuntu server!")

    # --- Page 2: Step 4, 5, 6 ---
    pdf.add_page()
    pdf.chapter_title(4, "Configure Ubuntu Firewall & Install Dependencies")
    pdf.note_box(
        "CRITICAL ORACLE LINUX STEP",
        "Ubuntu images in Oracle Cloud include restrictive internal iptables rules that drop ports even after opening them in the web console. You must run the commands below to allow traffic through.",
        "warning"
    )
    
    pdf.body_text("Run these commands inside your SSH terminal:")
    pdf.code_block(
        "# 1. Update system packages\n"
        "sudo apt update && sudo apt upgrade -y\n\n"
        "# 2. Open ports in Ubuntu's internal firewall\n"
        "sudo iptables -I INPUT 1 -m state --state NEW -p tcp --dport 80 -j ACCEPT\n"
        "sudo iptables -I INPUT 1 -m state --state NEW -p tcp --dport 443 -j ACCEPT\n"
        "sudo iptables -I INPUT 1 -m state --state NEW -p tcp --dport 4000 -j ACCEPT\n"
        "sudo apt install -y iptables-persistent\n"
        "sudo netfilter-persistent save\n\n"
        "# 3. Install Node.js 22 LTS, Git, and Nginx\n"
        "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -\n"
        "sudo apt install -y nodejs git nginx\n\n"
        "# 4. Install PM2 (Process Manager to keep app running 24/7)\n"
        "sudo npm install -g pm2"
    )

    # --- Step 5 ---
    pdf.chapter_title(5, "Clone and Launch Ally's Stream Hub")
    pdf.body_text("Clone your repository from GitHub and install production dependencies:")
    pdf.code_block(
        "# Clone repository\n"
        "git clone https://github.com/MrDDubs/odd-one.git stream-hub\n"
        "cd stream-hub\n\n"
        "# Install production dependencies\n"
        "npm install --omit=dev\n\n"
        "# Launch server with PM2\n"
        "pm2 start server.js --name \"stream-hub\"\n\n"
        "# Configure PM2 to auto-restart on system reboot\n"
        "pm2 save\n"
        "pm2 startup"
    )
    pdf.body_text("Note: If 'pm2 startup' displays a command starting with 'sudo env PATH=...', copy and run it.")
    pdf.ln(1)

    # --- Page 3: Step 6, 7 ---
    pdf.add_page()
    pdf.chapter_title(6, "Set Up Nginx Reverse Proxy with WebSocket Support")
    pdf.body_text(
        "Nginx routes incoming web and WebSocket traffic directly into your Stream Hub Node.js process "
        "without needing to specify port :4000 in your URLs."
    )
    pdf.body_text("1. Create an Nginx site configuration:  sudo nano /etc/nginx/sites-available/stream-hub")
    pdf.body_text("2. Paste this configuration block:")
    pdf.code_block(
        "server {\n"
        "    listen 80;\n"
        "    server_name _;\n\n"
        "    location / {\n"
        "        proxy_pass http://localhost:4000;\n"
        "        proxy_http_version 1.1;\n"
        "        proxy_set_header Upgrade $http_upgrade;\n"
        "        proxy_set_header Connection \"upgrade\";\n"
        "        proxy_set_header Host $host;\n"
        "        proxy_cache_bypass $http_upgrade;\n"
        "        proxy_set_header X-Real-IP $remote_addr;\n"
        "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
        "    }\n"
        "}"
    )
    pdf.body_text("Save and exit: Press Ctrl+O, Enter, then Ctrl+X.")
    pdf.body_text("3. Enable the site and restart Nginx:")
    pdf.code_block(
        "sudo ln -s /etc/nginx/sites-available/stream-hub /etc/nginx/sites-enabled/\n"
        "sudo rm -f /etc/nginx/sites-enabled/default\n"
        "sudo nginx -t && sudo systemctl restart nginx"
    )

    # --- Step 7 ---
    pdf.chapter_title(7, "Accessing Your Live Stream Hub Online")
    pdf.body_text("Your server is live online 24/7! You can access all endpoints immediately using your Public IP:")
    
    # Table of URLs
    pdf.set_fill_color(241, 245, 249)
    pdf.set_font('Helvetica', 'B', 8.8)
    pdf.cell(42, 6.5, "Destination", border=1, fill=True)
    pdf.cell(78, 6.5, "URL", border=1, fill=True)
    pdf.cell(60, 6.5, "Usage", border=1, fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    
    endpoints = [
        ("OBS Stream Overlay", "http://YOUR_PUBLIC_IP/overlay.html", "OBS Browser Source (1080x1920)"),
        ("Host Controls", "http://YOUR_PUBLIC_IP/admin-overlay.html", "Phone, Tablet, or PC Control Room"),
        ("Hub Home / Launcher", "http://YOUR_PUBLIC_IP/", "Game Selector & Status"),
        ("Raw Node Port (Optional)", "http://YOUR_PUBLIC_IP:4000/", "Direct Socket.IO & API Port")
    ]
    
    for title, url, usage in endpoints:
        pdf.set_font('Helvetica', '', 8.5)
        pdf.cell(42, 6.0, title, border=1)
        pdf.set_font('Courier', '', 7.8)
        pdf.cell(78, 6.0, url, border=1)
        pdf.set_font('Helvetica', '', 8.5)
        pdf.cell(60, 6.0, usage, border=1, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(3)

    # --- Page 4: Step 8, 9 ---
    pdf.add_page()
    pdf.chapter_title(8, "Optional: Free Domain & HTTPS/SSL (Let's Encrypt)")
    pdf.body_text(
        "Modern browsers and OBS overlays often require HTTPS / WSS for camera, secure assets, or permissions. "
        "You can configure a completely free custom domain and SSL certificate:"
    )
    pdf.body_text("1. Get a free domain or subdomain (e.g., at DuckDNS.org or Cloudflare pointing to your Public IP).")
    pdf.body_text("2. Update /etc/nginx/sites-available/stream-hub and change 'server_name _;' to 'server_name yourname.duckdns.org;'.")
    pdf.body_text("3. Install Certbot and generate an automated SSL certificate:")
    pdf.code_block(
        "sudo apt install -y certbot python3-certbot-nginx\n"
        "sudo certbot --nginx -d yourname.duckdns.org"
    )
    pdf.body_text("Certbot automatically handles certificate renewals forever via background systemd timers.")
    pdf.ln(2)

    # --- Step 9: Maintenance Cheat Sheet ---
    pdf.chapter_title(9, "Maintenance & Quick Update Cheat Sheet")
    pdf.note_box(
        "UPDATING YOUR HUB IN 10 SECONDS",
        "Whenever you push code updates or new games to GitHub, SSH into your server and run:\n"
        "cd ~/stream-hub && git pull origin master && pm2 restart stream-hub",
        "tip"
    )
    
    pdf.body_text("Useful PM2 diagnostic commands:")
    pdf.code_block(
        "# View live logs in real time\n"
        "pm2 logs stream-hub\n\n"
        "# View CPU and RAM usage dashboard\n"
        "pm2 monit\n\n"
        "# Restart or stop the hub\n"
        "pm2 restart stream-hub\n"
        "pm2 stop stream-hub\n\n"
        "# Check status and uptime\n"
        "pm2 status"
    )

    output_path = os.path.join(os.getcwd(), "Oracle_Cloud_Hosting_Guide.pdf")
    pdf.output(output_path)
    print(f"PDF successfully generated at: {output_path}")

if __name__ == "__main__":
    generate_guide()
