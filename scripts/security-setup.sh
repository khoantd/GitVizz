#!/bin/bash

# GitVizz Security Hardening Script
# This script hardens the VPS for production deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="gitviz.sutools.app"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root for system-level security hardening."
        print_status "Please run: sudo $0"
        exit 1
    fi
}

# Function to update system packages
update_system_packages() {
    print_status "Updating system packages..."
    
    apt-get update
    apt-get upgrade -y
    
    print_success "System packages updated"
}

# Function to install security tools
install_security_tools() {
    print_status "Installing security tools..."
    
    # Install fail2ban
    apt-get install -y fail2ban
    
    # Install UFW firewall
    apt-get install -y ufw
    
    # Install unattended-upgrades
    apt-get install -y unattended-upgrades
    
    # Install logwatch for log monitoring
    apt-get install -y logwatch
    
    # Install rkhunter for rootkit detection
    apt-get install -y rkhunter
    
    # Install chkrootkit for rootkit detection
    apt-get install -y chkrootkit
    
    print_success "Security tools installed"
}

# Function to configure fail2ban
configure_fail2ban() {
    print_status "Configuring fail2ban..."
    
    # Create custom jail for GitVizz
    cat > /etc/fail2ban/jail.d/gitvizz.conf << 'EOF'
[gitvizz-nginx]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600
findtime = 600

[gitvizz-ssh]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600

[gitvizz-docker]
enabled = true
port = http,https
filter = docker
logpath = /var/log/syslog
maxretry = 5
bantime = 1800
findtime = 600
EOF

    # Start and enable fail2ban
    systemctl enable fail2ban
    systemctl start fail2ban
    
    print_success "fail2ban configured"
}

# Function to configure UFW firewall
configure_ufw_firewall() {
    print_status "Configuring UFW firewall..."
    
    # Reset UFW to defaults
    ufw --force reset
    
    # Set default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow Docker network (if needed)
    ufw allow from 172.16.0.0/12
    
    # Enable UFW
    ufw --force enable
    
    print_success "UFW firewall configured"
}

# Function to configure automatic security updates
configure_automatic_updates() {
    print_status "Configuring automatic security updates..."
    
    # Configure unattended-upgrades
    cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
EOF

    # Enable automatic updates
    cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

    # Start and enable unattended-upgrades
    systemctl enable unattended-upgrades
    systemctl start unattended-upgrades
    
    print_success "Automatic security updates configured"
}

# Function to harden SSH configuration
harden_ssh() {
    print_status "Hardening SSH configuration..."
    
    # Backup original SSH config
    cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
    
    # Configure SSH security
    cat > /etc/ssh/sshd_config << 'EOF'
# SSH Security Configuration
Port 22
Protocol 2
AddressFamily inet

# Authentication
LoginGraceTime 2m
PermitRootLogin no
StrictModes yes
MaxAuthTries 3
MaxSessions 10

# Key-based authentication
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PasswordAuthentication no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
KerberosAuthentication no
GSSAPIAuthentication no

# Host-based authentication
HostbasedAuthentication no
IgnoreRhosts yes
IgnoreUserKnownHosts no

# Logging
SyslogFacility AUTH
LogLevel INFO

# Connection settings
TCPKeepAlive yes
ClientAliveInterval 300
ClientAliveCountMax 2
Compression no

# Security settings
X11Forwarding no
X11DisplayOffset 10
PrintMotd no
PrintLastLog yes
UsePAM yes
UseDNS no

# Ciphers and MACs
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,hmac-sha2-256,hmac-sha2-512
KexAlgorithms curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512,diffie-hellman-group14-sha256

# Subsystems
Subsystem sftp /usr/lib/openssh/sftp-server
EOF

    # Restart SSH service
    systemctl restart sshd
    
    print_success "SSH configuration hardened"
}

# Function to create deployment user
create_deployment_user() {
    print_status "Creating deployment user..."
    
    local deploy_user="gitvizz"
    
    # Create user if it doesn't exist
    if ! id "$deploy_user" &>/dev/null; then
        useradd -m -s /bin/bash "$deploy_user"
        print_success "Deployment user '$deploy_user' created"
    else
        print_warning "Deployment user '$deploy_user' already exists"
    fi
    
    # Add user to docker group
    usermod -aG docker "$deploy_user"
    
    # Add user to sudo group
    usermod -aG sudo "$deploy_user"
    
    # Create .ssh directory
    mkdir -p "/home/$deploy_user/.ssh"
    chmod 700 "/home/$deploy_user/.ssh"
    chown "$deploy_user:$deploy_user" "/home/$deploy_user/.ssh"
    
    print_success "Deployment user configured"
}

# Function to configure log monitoring
configure_log_monitoring() {
    print_status "Configuring log monitoring..."
    
    # Configure logwatch
    cat > /etc/logwatch/conf/logwatch.conf << 'EOF'
LogDir = /var/log
TmpDir = /var/cache/logwatch
MailTo = root
MailFrom = Logwatch
Print = No
Save = /var/cache/logwatch/logwatch
Range = yesterday
Detail = Med
Service = All
Format = text
Encode = none
EOF

    # Create logwatch cron job
    echo "0 6 * * * /usr/sbin/logwatch --output mail --mailto root --detail high" | crontab -
    
    print_success "Log monitoring configured"
}

# Function to configure system limits
configure_system_limits() {
    print_status "Configuring system limits..."
    
    # Configure limits for deployment user
    cat > /etc/security/limits.d/gitvizz.conf << 'EOF'
gitvizz soft nofile 65536
gitvizz hard nofile 65536
gitvizz soft nproc 32768
gitvizz hard nproc 32768
EOF

    # Configure kernel parameters
    cat > /etc/sysctl.d/99-gitvizz-security.conf << 'EOF'
# Network security
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_rfc1337 = 1

# Memory protection
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
kernel.yama.ptrace_scope = 1

# File system security
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0
EOF

    # Apply sysctl settings
    sysctl -p /etc/sysctl.d/99-gitvizz-security.conf
    
    print_success "System limits configured"
}

# Function to configure Docker security
configure_docker_security() {
    print_status "Configuring Docker security..."
    
    # Create Docker daemon configuration
    mkdir -p /etc/docker
    
    cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true,
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ]
}
EOF

    # Restart Docker service
    systemctl restart docker
    
    print_success "Docker security configured"
}

# Function to run security scans
run_security_scans() {
    print_status "Running security scans..."
    
    # Update rkhunter database
    rkhunter --update
    
    # Run rkhunter scan
    rkhunter --check --skip-keypress
    
    # Run chkrootkit scan
    chkrootkit
    
    print_success "Security scans completed"
}

# Function to show security summary
show_security_summary() {
    print_success "Security hardening completed!"
    echo ""
    echo "🔒 Security Configuration Summary:"
    echo "  - System packages updated"
    echo "  - fail2ban configured for intrusion prevention"
    echo "  - UFW firewall configured (ports 22, 80, 443)"
    echo "  - Automatic security updates enabled"
    echo "  - SSH hardened (root login disabled, key-only auth)"
    echo "  - Deployment user created: gitvizz"
    echo "  - Log monitoring configured"
    echo "  - System limits configured"
    echo "  - Docker security hardened"
    echo ""
    echo "🛡️  Security Status:"
    echo "  Firewall: $(ufw status | head -1)"
    echo "  fail2ban: $(systemctl is-active fail2ban)"
    echo "  SSH: $(systemctl is-active sshd)"
    echo "  Docker: $(systemctl is-active docker)"
    echo ""
    echo "⚠️  Important Security Notes:"
    echo "  1. SSH root login is disabled"
    echo "  2. SSH password authentication is disabled"
    echo "  3. Only key-based SSH authentication is allowed"
    echo "  4. Make sure to add your SSH public key to /home/gitvizz/.ssh/authorized_keys"
    echo "  5. Test SSH access before disconnecting"
    echo ""
    echo "🔧 Management Commands:"
    echo "  Check firewall: ufw status"
    echo "  Check fail2ban: fail2ban-client status"
    echo "  Check SSH: systemctl status sshd"
    echo "  View logs: journalctl -f"
    echo "  Security scan: rkhunter --check"
    echo ""
    echo "📋 Next Steps:"
    echo "  1. Add your SSH public key to /home/gitvizz/.ssh/authorized_keys"
    echo "  2. Test SSH access as gitvizz user"
    echo "  3. Run the deployment script as gitvizz user"
    echo "  4. Monitor security logs regularly"
}

# Function to cleanup on error
cleanup() {
    print_error "Security setup failed. Please check the configuration manually."
    exit 1
}

# Main function
main() {
    print_status "GitVizz Security Hardening"
    print_status "==========================="
    print_status "Domain: $DOMAIN"
    print_status "Project Root: $PROJECT_ROOT"
    echo ""
    
    # Set up error handling
    trap cleanup ERR
    
    # Check if running as root
    check_root
    
    # Update system packages
    update_system_packages
    
    # Install security tools
    install_security_tools
    
    # Configure fail2ban
    configure_fail2ban
    
    # Configure UFW firewall
    configure_ufw_firewall
    
    # Configure automatic updates
    configure_automatic_updates
    
    # Harden SSH
    harden_ssh
    
    # Create deployment user
    create_deployment_user
    
    # Configure log monitoring
    configure_log_monitoring
    
    # Configure system limits
    configure_system_limits
    
    # Configure Docker security
    configure_docker_security
    
    # Run security scans
    run_security_scans
    
    # Show security summary
    show_security_summary
}

# Run main function with all arguments
main "$@"
