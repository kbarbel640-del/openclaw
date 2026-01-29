#!/usr/bin/env python3
"""
PurelyMail Admin API CLI

Manage domains, users, and routing for PurelyMail via API.
API docs: https://news.purelymail.com/api/index.html
"""

import argparse
import json
import os
import sys
import subprocess
import secrets
import string

# API Configuration
API_BASE = "https://purelymail.com/api/v0"

def get_api_key():
    """Get API key from env or 1Password."""
    key = os.environ.get("PURELYMAIL_API_KEY")
    if key:
        return key
    
    # Try to get from 1Password via op-safe tmux session
    try:
        result = subprocess.run(
            ["tmux", "send-keys", "-t", "op-safe", 
             'op item get "moltbot skill: purelymail admin api" --fields notesPlain', "Enter"],
            capture_output=True, text=True, timeout=5
        )
        import time
        time.sleep(2)
        result = subprocess.run(
            ["tmux", "capture-pane", "-t", "op-safe", "-p", "-S", "-5"],
            capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.strip().split('\n'):
            if line.startswith('pm-live-'):
                return line.strip()
    except Exception:
        pass
    
    print("Error: PURELYMAIL_API_KEY not set", file=sys.stderr)
    print("Set it via: export PURELYMAIL_API_KEY='pm-live-...'", file=sys.stderr)
    sys.exit(1)

def api_call(endpoint: str, data: dict = None):
    """Make API call to PurelyMail."""
    import urllib.request
    import urllib.error
    
    url = f"{API_BASE}/{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Purelymail-Api-Token": get_api_key()
    }
    
    body = json.dumps(data or {}).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            if result.get("type") == "error":
                print(f"API Error: {result.get('message', 'Unknown error')}", file=sys.stderr)
                sys.exit(1)
            return result.get("result", result)
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

def generate_password(length=16):
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# ============ Commands ============

def cmd_list_domains(args):
    """List all domains."""
    result = api_call("listDomains")
    domains = result.get("domains", [])
    
    if args.json:
        print(json.dumps(domains, indent=2))
        return
    
    if not domains:
        print("No domains found")
        return
    
    print(f"{'Domain':<35} {'MX':>4} {'SPF':>4} {'DKIM':>5} {'DMARC':>5}")
    print("-" * 60)
    for d in domains:
        dns = d.get("dnsSummary", {})
        mx = "✓" if dns.get("passesMx") else "✗"
        spf = "✓" if dns.get("passesSpf") else "✗"
        dkim = "✓" if dns.get("passesDkim") else "✗"
        dmarc = "✓" if dns.get("passesDmarc") else "✗"
        print(f"{d['name']:<35} {mx:>4} {spf:>4} {dkim:>5} {dmarc:>5}")

def cmd_add_domain(args):
    """Add a new domain."""
    result = api_call("addDomain", {"domainName": args.domain})
    print(f"✓ Domain '{args.domain}' added successfully")
    print("\nNext steps:")
    print("1. Add MX record: @ → mx.purelymail.com (priority 10)")
    print("2. Add SPF TXT: @ → v=spf1 include:_spf.purelymail.com ~all")
    print("3. Add DKIM (check PurelyMail dashboard for domain-specific key)")
    print("4. Add DMARC TXT: _dmarc → v=DMARC1; p=quarantine; rua=mailto:dmarc@purelymail.com")

def cmd_list_users(args):
    """List all users."""
    result = api_call("listUser")
    users = result.get("users", [])
    
    if args.json:
        print(json.dumps(users, indent=2))
        return
    
    if not users:
        print("No users found")
        return
    
    # Group by domain
    by_domain = {}
    for u in users:
        if '@' in u:
            local, domain = u.rsplit('@', 1)
            by_domain.setdefault(domain, []).append(local)
        else:
            by_domain.setdefault('unknown', []).append(u)
    
    for domain in sorted(by_domain.keys()):
        print(f"\n{domain}:")
        for local in sorted(by_domain[domain]):
            print(f"  {local}@{domain}")

def cmd_create_user(args):
    """Create a new user/mailbox."""
    if '@' not in args.email:
        print("Error: Email must be in format user@domain.com", file=sys.stderr)
        sys.exit(1)
    
    local, domain = args.email.rsplit('@', 1)
    password = args.password or generate_password()
    
    data = {
        "userName": local,
        "domainName": domain,
        "password": password,
        "enablePasswordReset": args.enable_reset,
        "enableSearchIndexing": True,
        "sendWelcomeEmail": False
    }
    
    if args.recovery_email:
        data["recoveryEmail"] = args.recovery_email
    
    result = api_call("createUser", data)
    
    print(f"✓ User '{args.email}' created successfully")
    print(f"\nCredentials:")
    print(f"  Email: {args.email}")
    print(f"  Password: {password}")
    print(f"\nIMAP: imap.purelymail.com:993 (SSL)")
    print(f"SMTP: smtp.purelymail.com:465 (SSL)")

def cmd_delete_user(args):
    """Delete a user."""
    if '@' not in args.email:
        print("Error: Email must be in format user@domain.com", file=sys.stderr)
        sys.exit(1)
    
    local, domain = args.email.rsplit('@', 1)
    
    if not args.force:
        confirm = input(f"Delete user '{args.email}'? [y/N] ")
        if confirm.lower() != 'y':
            print("Cancelled")
            return
    
    result = api_call("deleteUser", {"userName": local, "domainName": domain})
    print(f"✓ User '{args.email}' deleted")

def cmd_list_routing(args):
    """List routing rules."""
    result = api_call("listRoutingRules")
    rules = result.get("rules", [])
    
    if args.json:
        print(json.dumps(rules, indent=2))
        return
    
    if not rules:
        print("No routing rules found")
        return
    
    for r in rules:
        match = r.get("matchUser", "*") or "*"
        targets = ", ".join(r.get("targetAddresses", []))
        catchall = " (catchall)" if r.get("catchall") else ""
        print(f"{match}@{r['domainName']} → {targets}{catchall}")

def cmd_add_routing(args):
    """Add a routing rule."""
    data = {
        "domainName": args.domain,
        "matchUser": args.match or "",
        "targetAddresses": args.targets,
        "prefix": args.prefix,
        "catchall": args.catchall
    }
    result = api_call("addRoutingRule", data)
    print(f"✓ Routing rule added for {args.domain}")

def cmd_setup_project(args):
    """Set up email for a new project (domain + standard users)."""
    domain = args.domain
    
    print(f"Setting up email for project: {domain}")
    print("=" * 50)
    
    # Check if domain exists
    result = api_call("listDomains")
    existing = [d["name"] for d in result.get("domains", [])]
    
    if domain not in existing:
        print(f"\n1. Adding domain '{domain}'...")
        api_call("addDomain", {"domainName": domain})
        print(f"   ✓ Domain added")
    else:
        print(f"\n1. Domain '{domain}' already exists ✓")
    
    # Create standard users
    users_to_create = args.users or ["noreply", "hello"]
    created = []
    
    print(f"\n2. Creating users...")
    result = api_call("listUser")
    existing_users = result.get("users", [])
    
    for user in users_to_create:
        email = f"{user}@{domain}"
        if email in existing_users:
            print(f"   {email} - already exists")
            continue
        
        password = generate_password()
        data = {
            "userName": user,
            "domainName": domain,
            "password": password,
            "enablePasswordReset": True,
            "enableSearchIndexing": True,
            "sendWelcomeEmail": False
        }
        api_call("createUser", data)
        created.append({"email": email, "password": password})
        print(f"   ✓ {email}")
    
    # Summary
    print(f"\n{'=' * 50}")
    print("Setup complete!")
    
    if created:
        print(f"\nNew credentials (save these!):")
        for c in created:
            print(f"  {c['email']}: {c['password']}")
    
    print(f"\nDNS records needed for {domain}:")
    print("  MX: @ → mx.purelymail.com (priority 10)")
    print("  TXT (SPF): @ → v=spf1 include:_spf.purelymail.com ~all")
    print("  TXT (DMARC): _dmarc → v=DMARC1; p=quarantine")
    print("  (Check PurelyMail dashboard for DKIM keys)")

def main():
    parser = argparse.ArgumentParser(
        description="PurelyMail Admin API CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # domains
    p = subparsers.add_parser("domains", help="List all domains")
    p.add_argument("--json", action="store_true", help="Output as JSON")
    p.set_defaults(func=cmd_list_domains)
    
    # add-domain
    p = subparsers.add_parser("add-domain", help="Add a new domain")
    p.add_argument("domain", help="Domain name to add")
    p.set_defaults(func=cmd_add_domain)
    
    # users
    p = subparsers.add_parser("users", help="List all users")
    p.add_argument("--json", action="store_true", help="Output as JSON")
    p.set_defaults(func=cmd_list_users)
    
    # create-user
    p = subparsers.add_parser("create-user", help="Create a new user")
    p.add_argument("email", help="Email address (user@domain.com)")
    p.add_argument("--password", "-p", help="Password (generated if not provided)")
    p.add_argument("--recovery-email", help="Recovery email address")
    p.add_argument("--enable-reset", action="store_true", default=True,
                   help="Enable password reset (default: true)")
    p.set_defaults(func=cmd_create_user)
    
    # delete-user
    p = subparsers.add_parser("delete-user", help="Delete a user")
    p.add_argument("email", help="Email address to delete")
    p.add_argument("--force", "-f", action="store_true", help="Skip confirmation")
    p.set_defaults(func=cmd_delete_user)
    
    # routing
    p = subparsers.add_parser("routing", help="List routing rules")
    p.add_argument("--json", action="store_true", help="Output as JSON")
    p.set_defaults(func=cmd_list_routing)
    
    # add-routing
    p = subparsers.add_parser("add-routing", help="Add a routing rule")
    p.add_argument("domain", help="Domain name")
    p.add_argument("--match", help="User to match (empty for catchall)")
    p.add_argument("--targets", nargs="+", required=True, help="Target addresses")
    p.add_argument("--prefix", action="store_true", help="Match as prefix")
    p.add_argument("--catchall", action="store_true", help="Make this a catchall rule")
    p.set_defaults(func=cmd_add_routing)
    
    # setup-project
    p = subparsers.add_parser("setup-project", help="Set up email for a new project")
    p.add_argument("domain", help="Domain name")
    p.add_argument("--users", nargs="+", default=["noreply", "hello"],
                   help="Users to create (default: noreply, hello)")
    p.set_defaults(func=cmd_setup_project)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    args.func(args)

if __name__ == "__main__":
    main()
