#!/usr/bin/env python3
"""
EMMA CLI - Municipal bond data retrieval for CCRC engagements.

Usage:
    emma.py search <query> [--state STATE]
    emma.py issue <issue_id>
    emma.py docs <issue_id>
    emma.py download <issue_id> [--output DIR] [--types TYPES]
    emma.py extract <issue_id> [--from-dir DIR]
    emma.py sync <issue_id> --twenty-id ID [--sharepoint-path PATH]
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from datetime import datetime

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Install dependencies: pip install requests beautifulsoup4 lxml", file=sys.stderr)
    sys.exit(1)

EMMA_BASE = "https://emma.msrb.org"
SESSION_FILE = Path.home() / ".emma-session"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

def parse_emma_url_or_id(url_or_id: str) -> str:
    """Extract issue ID from EMMA URL or return ID as-is."""
    # Handle full URLs like https://emma.msrb.org/IssueView/Details/P2415140
    if "emma.msrb.org" in url_or_id:
        match = re.search(r'/Details/([A-Z0-9]+)', url_or_id)
        if match:
            return match.group(1)
        # Try other URL patterns
        match = re.search(r'[?&]id=([A-Z0-9]+)', url_or_id)
        if match:
            return match.group(1)
    # Assume it's already an issue ID
    return url_or_id.strip()


class EmmaClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self._load_session()
        # Always ensure terms are accepted
        self._accept_terms()

    def _load_session(self):
        """Load cached session cookies."""
        if SESSION_FILE.exists():
            try:
                cookies = json.loads(SESSION_FILE.read_text())
                for name, value in cookies.items():
                    self.session.cookies.set(name, value, domain=".emma.msrb.org")
            except Exception:
                pass

    def _save_session(self):
        """Cache session cookies."""
        cookies = {c.name: c.value for c in self.session.cookies}
        SESSION_FILE.write_text(json.dumps(cookies))

    def _accept_terms(self):
        """Accept EMMA Terms of Use."""
        # Visit home page to get initial cookies
        self.session.get(f"{EMMA_BASE}/Home/Index")
        # Set the disclaimer cookie (try both domain formats)
        self.session.cookies.set("Disclaimer6", "msrborg", domain="emma.msrb.org")
        self.session.cookies.set("Disclaimer6", "msrborg", domain=".emma.msrb.org")
        self._save_session()

    def _get(self, url, **kwargs):
        """GET with auto Terms acceptance."""
        resp = self.session.get(url, **kwargs)
        if "UserAgreement" in resp.url or "Disclaimer" in resp.text[:1000]:
            self._accept_terms()
            resp = self.session.get(url, **kwargs)
        return resp

    def search(self, query: str, state: str = None) -> list:
        """Search for issues."""
        params = {"q": query}
        if state:
            params["state"] = state.upper()
        
        # Use advanced search
        resp = self._get(f"{EMMA_BASE}/Search/Search.aspx", params=params)
        soup = BeautifulSoup(resp.text, "lxml")
        
        results = []
        # Parse search results (simplified - EMMA search is complex)
        for link in soup.select("a[href*='/IssueView/Details/']"):
            issue_id = link["href"].split("/")[-1]
            results.append({
                "issue_id": issue_id,
                "description": link.get_text(strip=True)[:200]
            })
        return results[:20]  # Limit results

    def get_issue(self, issue_id: str) -> dict:
        """Get issue details."""
        url = f"{EMMA_BASE}/IssueView/Details/{issue_id}"
        resp = self._get(url)
        soup = BeautifulSoup(resp.text, "lxml")
        
        # Extract basic info
        info = {"issue_id": issue_id, "url": url}
        
        # Title/description - find the bond title, not sidebar
        for h3 in soup.select("h3"):
            text = h3.get_text(strip=True)
            if "BOND" in text.upper() or "REVENUE" in text.upper():
                info["title"] = text
                break
        
        # Dates
        for item in soup.select("li"):
            text = item.get_text()
            if "Dated Date:" in text:
                info["dated_date"] = text.replace("Dated Date:", "").strip()
            elif "Closing Date:" in text:
                info["closing_date"] = text.replace("Closing Date:", "").strip()
        
        return info

    def get_documents(self, issue_id: str) -> list:
        """Get list of available documents."""
        url = f"{EMMA_BASE}/IssueView/Details/{issue_id}"
        resp = self._get(url)
        soup = BeautifulSoup(resp.text, "lxml")
        
        docs = []
        seen_urls = set()
        
        # Find all PDF links and their surrounding context
        for link in soup.select("a[href*='.pdf']"):
            href = link.get("href", "")
            if not href.endswith(".pdf"):
                continue
            
            full_url = f"{EMMA_BASE}{href}" if href.startswith("/") else href
            if full_url in seen_urls:
                continue
            seen_urls.add(full_url)
            
            # Get text from link and parent row/cell for context
            text = link.get_text(strip=True)
            parent = link.find_parent("td") or link.find_parent("tr")
            if parent:
                parent_text = parent.get_text(" ", strip=True)
                if len(parent_text) > len(text):
                    text = parent_text
            
            doc = {
                "url": full_url,
                "description": text[:300],
                "filename": href.split("/")[-1]
            }
            
            # Categorize based on description
            text_lower = text.lower()
            if "official statement" in text_lower:
                doc["type"] = "official_statement"
            elif "quarterly financial" in text_lower:
                doc["type"] = "quarterly"
            elif "occupancy" in text_lower:
                doc["type"] = "occupancy"
            elif "audited" in text_lower:
                doc["type"] = "audited_financial"
            elif "presale" in text_lower or "marketing" in text_lower or "upgrades" in text_lower:
                doc["type"] = "presale_marketing"
            elif "redemption" in text_lower or "bond call" in text_lower:
                doc["type"] = "event_notice"
            elif "amendment" in text_lower or "covenant" in text_lower:
                doc["type"] = "covenant_amendment"
            else:
                doc["type"] = "other"
            
            # Extract date if present
            date_match = re.search(r"(\d{1,2}/\d{1,2}/\d{4})", text)
            if date_match:
                doc["date"] = date_match.group(1)
            
            docs.append(doc)
        
        return docs

    def download_document(self, url: str, output_path: Path) -> bool:
        """Download a PDF document."""
        try:
            resp = self._get(url, stream=True)
            if resp.status_code == 200 and b"%PDF" in resp.content[:10]:
                output_path.write_bytes(resp.content)
                return True
        except Exception as e:
            print(f"Error downloading {url}: {e}", file=sys.stderr)
        return False

    def download_all(self, issue_id: str, output_dir: Path, types: list = None) -> list:
        """Download documents for an issue."""
        output_dir.mkdir(parents=True, exist_ok=True)
        docs = self.get_documents(issue_id)
        
        downloaded = []
        for doc in docs:
            if types and doc.get("type") not in types:
                continue
            
            filename = f"{doc['type']}_{doc['filename']}"
            output_path = output_dir / filename
            
            print(f"Downloading {doc['type']}: {doc['filename']}...", file=sys.stderr)
            if self.download_document(doc["url"], output_path):
                downloaded.append({
                    "type": doc["type"],
                    "path": str(output_path),
                    "url": doc["url"]
                })
                time.sleep(0.5)  # Rate limiting
        
        return downloaded


def extract_from_official_statement(pdf_path: Path) -> dict:
    """Extract key data from Official Statement PDF."""
    try:
        import subprocess
        result = subprocess.run(
            ["pdftotext", "-layout", str(pdf_path), "-"],
            capture_output=True, text=True
        )
        text = result.stdout
    except Exception:
        return {"error": "pdftotext not available"}
    
    data = {}
    
    # Total bonds
    match = re.search(r"\$([0-9,]+),000\s*\n.*REVENUE BONDS", text)
    if match:
        data["total_bonds"] = int(match.group(1).replace(",", "")) * 1000
    
    # Unit counts
    il_match = re.search(r"(\d+)\s+independent\s+living", text, re.I)
    if il_match:
        data["il_units"] = int(il_match.group(1))
    
    almc_match = re.search(r"(\d+)\s+(?:assisted\s+living|memory\s+care|supported)", text, re.I)
    if almc_match:
        data["almc_units"] = int(almc_match.group(1))
    
    # DSCR covenant
    dscr_match = re.search(r"Debt Service Coverage Ratio.*?(\d+\.\d+)\s+to\s+1", text, re.I | re.S)
    if dscr_match:
        data["dscr_required"] = float(dscr_match.group(1))
    
    # Days cash
    cash_match = re.search(r"(\d+)\s+Days.*Cash\s+on\s+Hand", text, re.I)
    if cash_match:
        data["days_cash_required"] = int(cash_match.group(1))
    
    return data


def extract_from_occupancy(pdf_path: Path) -> dict:
    """Extract latest occupancy from report."""
    try:
        import subprocess
        result = subprocess.run(
            ["pdftotext", "-layout", str(pdf_path), "-"],
            capture_output=True, text=True
        )
        text = result.stdout
    except Exception:
        return {"error": "pdftotext not available"}
    
    lines = text.strip().split("\n")
    data = {}
    
    # Find last data line (date, IL count, IL%, ALMC count, ALMC%)
    for line in reversed(lines):
        match = re.search(r"(\d+/\d+/\d+)\s+(\d+)\s+([\d.]+)%\s+(\d+)\s+([\d.]+)%", line)
        if match:
            data = {
                "date": match.group(1),
                "il_occupied": int(match.group(2)),
                "il_pct": float(match.group(3)),
                "almc_occupied": int(match.group(4)),
                "almc_pct": float(match.group(5))
            }
            break
    
    return data


def search_twenty_engagement(project_name: str) -> dict:
    """Search Twenty CRM for matching engagement by project name."""
    import subprocess
    
    twenty_script = Path(__file__).parent.parent.parent / "twenty" / "scripts" / "twenty.py"
    if not twenty_script.exists():
        return {"error": "twenty.py not found"}
    
    try:
        # Get all engagements (request 200 to ensure we get all)
        cmd = ["uv", "run", str(twenty_script), "custom", "engagements", "-n", "200", "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=twenty_script.parent.parent)
        
        if result.returncode != 0:
            return {"error": result.stderr[:200]}
        
        # Parse JSON - handle nested structure
        data = json.loads(result.stdout)
        if isinstance(data, dict):
            engagements = data.get("data", {}).get("engagements", [])
        else:
            engagements = data
        
        # Clean and extract meaningful search terms
        # Skip common words that aren't distinctive
        skip_words = {'the', 'at', 'of', 'and', 'in', 'for', 'project', 'senior', 'living', 
                      'community', 'retirement', 'care', 'commons', 'village', 'center'}
        search_terms = [w.lower() for w in project_name.split() if len(w) > 2 and w.lower() not in skip_words]
        
        best_match = None
        best_score = 0
        
        for eng in engagements:
            name = (eng.get("name") or "").lower()
            # Count matching significant words
            score = sum(2 for term in search_terms if term in name)
            # Bonus for exact substring match
            if project_name.lower() in name or name in project_name.lower():
                score += 5
            # Bonus for key identifiers (proper nouns typically)
            for term in search_terms:
                if term in name and term[0].isupper() if term else False:
                    score += 1
            
            if score > best_score:
                best_score = score
                best_match = eng
        
        # Require at least score of 2 to avoid false matches
        if best_match and best_score >= 2:
            return {
                "id": best_match.get("id"),
                "name": best_match.get("name"),
                "score": best_score
            }
        
        return {"error": f"No matching engagement found for '{project_name}' (best score: {best_score})"}
        
    except Exception as e:
        return {"error": str(e)}


def cmd_auto(args):
    """Fully automated: EMMA URL → Download → Extract → Sync to Twenty."""
    import subprocess
    
    # Parse URL to get issue ID
    issue_id = parse_emma_url_or_id(args.url)
    print(f"Issue ID: {issue_id}", file=sys.stderr)
    
    # Create output directory
    output_dir = Path(args.output) if args.output else Path(f"./emma-{issue_id}")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Step 1: Get issue info and download docs
    print(f"Downloading documents to {output_dir}...", file=sys.stderr)
    client = EmmaClient()
    
    # Download key documents
    docs = client.get_documents(issue_id)
    downloaded = []
    for doc in docs:
        doc_type = doc.get("type", "other")
        if doc_type in ["official_statement", "quarterly", "occupancy", "audited_financial"]:
            filename = f"{doc_type}_{doc['filename']}"
            output_path = output_dir / filename
            print(f"  Downloading {doc_type}...", file=sys.stderr)
            if client.download_document(doc["url"], output_path):
                downloaded.append({"type": doc_type, "path": str(output_path)})
                time.sleep(0.5)
    
    if not downloaded:
        print("No documents downloaded!", file=sys.stderr)
        return
    
    # Step 2: Extract metrics
    print("Extracting metrics...", file=sys.stderr)
    data = {"issue_id": issue_id}
    
    # Extract from Official Statement
    for pdf in output_dir.glob("official_statement*.pdf"):
        if pdf.stat().st_size > 500_000:
            os_data = extract_from_official_statement(pdf)
            data.update(os_data)
            break
    
    # Extract from occupancy
    occ_files = list(output_dir.glob("occupancy*.pdf"))
    if occ_files:
        occ_data = extract_from_occupancy(occ_files[-1])
        data["latest_occupancy"] = occ_data
    
    # Step 3: Determine engagement/community ID
    engagement_id = args.engagement
    community_id = args.community
    link_type = None
    link_id = None
    
    # If ID provided directly, use it
    if engagement_id:
        link_type = "engagement"
        link_id = engagement_id
        print(f"Using provided engagement: {engagement_id}", file=sys.stderr)
    elif community_id:
        link_type = "community"
        link_id = community_id
        print(f"Using provided community: {community_id}", file=sys.stderr)
    else:
        # Search by name (user-provided or from EMMA)
        search_name = args.name
        if not search_name:
            # Fall back to EMMA project name
            issue_info = client.get_issue(issue_id)
            if issue_info.get("title"):
                search_name = issue_info["title"]
                name_match = re.search(r'\(([^)]+)\)', search_name)
                if name_match:
                    search_name = name_match.group(1)
                search_name = re.sub(r'(?i)(project|the|at|revenue|bonds?|senior|living)', '', search_name).strip()
        
        if search_name:
            data["search_name"] = search_name
            print(f"Searching Twenty for '{search_name}'...", file=sys.stderr)
            match = search_twenty_engagement(search_name)
            if match.get("id"):
                engagement_id = match["id"]
                link_type = "engagement"
                link_id = engagement_id
                print(f"  Found: {match.get('name')} (score: {match.get('score')})", file=sys.stderr)
            else:
                print(f"  {match.get('error', 'No match found')}", file=sys.stderr)
    
    # Step 4: Create note in Twenty
    results = {"extracted": data, "twenty": None, "sharepoint": []}
    
    if link_id:
        note_lines = [
            f"# EMMA Bond Data - {issue_id}",
            f"",
            f"**EMMA URL:** https://emma.msrb.org/IssueView/Details/{issue_id}",
            f"",
            f"## Unit Mix",
            f"- Independent Living: {data.get('il_units', 'N/A')} units",
            f"- AL/Memory Care: {data.get('almc_units', 'N/A')} units",
            f"",
            f"## Covenants",
            f"- DSCR Required: {data.get('dscr_required', 'N/A')}",
            f"- Days Cash Required: {data.get('days_cash_required', 'N/A')}",
        ]
        
        if data.get("latest_occupancy"):
            occ = data["latest_occupancy"]
            note_lines.extend([
                f"",
                f"## Latest Occupancy ({occ.get('date', 'N/A')})",
                f"- IL: {occ.get('il_occupied', 'N/A')} ({occ.get('il_pct', 'N/A')}%)",
                f"- AL/MC: {occ.get('almc_occupied', 'N/A')} ({occ.get('almc_pct', 'N/A')}%)",
            ])
        
        note_body = "\n".join(note_lines)
        
        twenty_script = Path(__file__).parent.parent.parent / "twenty" / "scripts" / "twenty.py"
        try:
            cmd = [
                "uv", "run", str(twenty_script),
                "add-note",
                "--title", f"EMMA: {issue_id}",
                "--body", note_body,
                f"--{link_type}", link_id,
                "--json"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=twenty_script.parent.parent)
            if result.returncode == 0:
                results["twenty"] = {"status": "success", "linked_to": f"{link_type}:{link_id}"}
                print(f"✓ Note synced to Twenty {link_type}", file=sys.stderr)
            else:
                results["twenty"] = {"status": "error", "error": result.stderr[:200]}
        except Exception as e:
            results["twenty"] = {"status": "error", "error": str(e)}
    else:
        results["twenty"] = {"status": "skipped", "reason": "No engagement/community specified or found"}
        print("⚠ No engagement/community - note not created", file=sys.stderr)
        print("  Provide --name 'Edgewood Baldwin' or --engagement <id>", file=sys.stderr)
    
    # Step 5: Upload to SharePoint (if configured)
    if args.sharepoint_drive and args.sharepoint_folder:
        sharepoint_script = Path(__file__).parent.parent.parent / "sharepoint" / "scripts" / "sharepoint.py"
        if sharepoint_script.exists():
            for doc in downloaded:
                doc_path = doc.get("path")
                if doc_path and Path(doc_path).exists():
                    try:
                        cmd = [
                            "uv", "run", str(sharepoint_script),
                            "upload", args.sharepoint_drive, doc_path,
                            "--folder", args.sharepoint_folder
                        ]
                        result = subprocess.run(cmd, capture_output=True, text=True, cwd=sharepoint_script.parent.parent)
                        if result.returncode == 0:
                            results["sharepoint"].append({"file": Path(doc_path).name, "status": "uploaded"})
                            print(f"✓ Uploaded {Path(doc_path).name} to SharePoint", file=sys.stderr)
                        else:
                            results["sharepoint"].append({"file": Path(doc_path).name, "status": "error", "error": result.stderr[:100]})
                    except Exception as e:
                        results["sharepoint"].append({"file": Path(doc_path).name, "status": "error", "error": str(e)})
    
    results["downloaded"] = downloaded
    print(json.dumps(results, indent=2))


def cmd_search(args):
    client = EmmaClient()
    results = client.search(args.query, args.state)
    print(json.dumps(results, indent=2))


def cmd_issue(args):
    client = EmmaClient()
    info = client.get_issue(args.issue_id)
    print(json.dumps(info, indent=2))


def cmd_docs(args):
    client = EmmaClient()
    docs = client.get_documents(args.issue_id)
    print(json.dumps(docs, indent=2))


def cmd_download(args):
    client = EmmaClient()
    output_dir = Path(args.output) if args.output else Path(f"./emma-{args.issue_id}")
    types = args.types.split(",") if args.types else None
    
    downloaded = client.download_all(args.issue_id, output_dir, types)
    print(json.dumps(downloaded, indent=2))


def cmd_extract(args):
    """Extract metrics from downloaded documents."""
    if args.from_dir:
        doc_dir = Path(args.from_dir)
    else:
        doc_dir = Path(f"./emma-{args.issue_id}")
    
    data = {"issue_id": args.issue_id}
    
    # Find and parse Official Statement (flexible naming)
    os_patterns = ["official*statement*.pdf", "official*.pdf", "*OS*.pdf"]
    for pattern in os_patterns:
        for pdf in doc_dir.glob(pattern):
            if pdf.stat().st_size > 1_000_000:  # OS typically > 1MB
                os_data = extract_from_official_statement(pdf)
                data.update(os_data)
                data["official_statement_file"] = pdf.name
                break
        if "official_statement_file" in data:
            break
    
    # Find and parse latest occupancy (flexible naming)
    occ_patterns = ["*occupancy*.pdf", "*census*.pdf"]
    occupancy_files = []
    for pattern in occ_patterns:
        occupancy_files.extend(doc_dir.glob(pattern))
    
    # Filter to "real" files if both exist, prefer larger/real ones
    real_files = [f for f in occupancy_files if "real" in f.name.lower()]
    if real_files:
        occupancy_files = real_files
    
    if occupancy_files:
        # Sort by name (which typically includes date)
        occupancy_files = sorted(occupancy_files, key=lambda f: f.name)
        occ_data = extract_from_occupancy(occupancy_files[-1])
        data["latest_occupancy"] = occ_data
        data["occupancy_file"] = occupancy_files[-1].name
    
    print(json.dumps(data, indent=2))


def cmd_sync(args):
    """Sync to Twenty CRM and/or SharePoint."""
    import subprocess
    
    if args.from_dir:
        doc_dir = Path(args.from_dir)
    else:
        doc_dir = Path(f"./emma-{args.issue_id}")
    
    # First extract the data
    data = {"issue_id": args.issue_id}
    
    # Find and parse Official Statement
    os_patterns = ["official*statement*.pdf", "official*.pdf", "*OS*.pdf"]
    for pattern in os_patterns:
        for pdf in doc_dir.glob(pattern):
            if pdf.stat().st_size > 1_000_000:
                os_data = extract_from_official_statement(pdf)
                data.update(os_data)
                data["official_statement_file"] = str(pdf)
                break
        if "official_statement_file" in data:
            break
    
    # Find and parse latest occupancy
    occ_patterns = ["*occupancy*.pdf", "*census*.pdf"]
    occupancy_files = []
    for pattern in occ_patterns:
        occupancy_files.extend(doc_dir.glob(pattern))
    real_files = [f for f in occupancy_files if "real" in f.name.lower()]
    if real_files:
        occupancy_files = real_files
    if occupancy_files:
        occupancy_files = sorted(occupancy_files, key=lambda f: f.name)
        occ_data = extract_from_occupancy(occupancy_files[-1])
        data["latest_occupancy"] = occ_data
    
    results = {"extracted": data, "twenty": None, "sharepoint": []}
    
    # Determine which Twenty object to link to
    twenty_link_type = None
    twenty_link_id = None
    if args.engagement:
        twenty_link_type = "engagement"
        twenty_link_id = args.engagement
    elif args.community:
        twenty_link_type = "community"
        twenty_link_id = args.community
    elif args.twenty_id:
        twenty_link_type = "company"
        twenty_link_id = args.twenty_id
    
    # Sync to Twenty CRM
    if twenty_link_id:
        # Build note body
        note_lines = [
            f"# EMMA Bond Data - {args.issue_id}",
            f"",
            f"**EMMA URL:** https://emma.msrb.org/IssueView/Details/{args.issue_id}",
            f"",
            f"## Unit Mix",
            f"- Independent Living: {data.get('il_units', 'N/A')} units",
            f"- AL/Memory Care: {data.get('almc_units', 'N/A')} units",
            f"",
            f"## Covenants",
            f"- DSCR Required: {data.get('dscr_required', 'N/A')}",
            f"- Days Cash Required: {data.get('days_cash_required', 'N/A')}",
        ]
        
        if "latest_occupancy" in data and data["latest_occupancy"]:
            occ = data["latest_occupancy"]
            note_lines.extend([
                f"",
                f"## Latest Occupancy ({occ.get('date', 'N/A')})",
                f"- IL: {occ.get('il_occupied', 'N/A')} ({occ.get('il_pct', 'N/A')}%)",
                f"- AL/MC: {occ.get('almc_occupied', 'N/A')} ({occ.get('almc_pct', 'N/A')}%)",
            ])
        
        note_body = "\n".join(note_lines)
        
        # Call twenty.py add-note
        twenty_script = Path(__file__).parent.parent.parent / "twenty" / "scripts" / "twenty.py"
        if twenty_script.exists():
            try:
                cmd = [
                    "uv", "run", str(twenty_script),
                    "add-note",
                    "--title", f"EMMA: {args.issue_id}",
                    "--body", note_body,
                    f"--{twenty_link_type}", twenty_link_id,
                    "--json"
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, cwd=twenty_script.parent.parent)
                if result.returncode == 0:
                    results["twenty"] = {"status": "success", "linked_to": f"{twenty_link_type}:{twenty_link_id}", "output": result.stdout[:500]}
                    print(f"✓ Note added to Twenty {twenty_link_type} {twenty_link_id}", file=sys.stderr)
                else:
                    results["twenty"] = {"status": "error", "error": result.stderr[:500]}
                    print(f"✗ Twenty note failed: {result.stderr[:200]}", file=sys.stderr)
            except Exception as e:
                results["twenty"] = {"status": "error", "error": str(e)}
        else:
            results["twenty"] = {"status": "skipped", "reason": "twenty.py not found"}
    
    # Sync to SharePoint
    if args.sharepoint_path and args.sharepoint_drive:
        sharepoint_script = Path(__file__).parent.parent.parent / "sharepoint" / "scripts" / "sharepoint.py"
        if sharepoint_script.exists():
            # Upload each PDF
            for pdf in doc_dir.glob("*.pdf"):
                if "real" in pdf.name.lower() or pdf.stat().st_size > 100_000:
                    try:
                        cmd = [
                            "uv", "run", str(sharepoint_script),
                            "upload",
                            args.sharepoint_drive,
                            str(pdf),
                            "--folder", args.sharepoint_path,
                            "--json"
                        ]
                        result = subprocess.run(cmd, capture_output=True, text=True)
                        if result.returncode == 0:
                            results["sharepoint"].append({"file": pdf.name, "status": "uploaded"})
                            print(f"✓ Uploaded {pdf.name} to SharePoint", file=sys.stderr)
                        else:
                            results["sharepoint"].append({"file": pdf.name, "status": "error", "error": result.stderr[:200]})
                            print(f"✗ Upload failed: {pdf.name}", file=sys.stderr)
                    except Exception as e:
                        results["sharepoint"].append({"file": pdf.name, "status": "error", "error": str(e)})
        else:
            results["sharepoint"] = [{"status": "skipped", "reason": "sharepoint.py not found"}]
    
    print(json.dumps(results, indent=2))


def main():
    parser = argparse.ArgumentParser(description="EMMA municipal bond data CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # auto - the main command, does everything from EMMA URL
    p = subparsers.add_parser("auto", help="Fully automated: EMMA URL → Download → Extract → Sync to Twenty/SharePoint")
    p.add_argument("url", help="EMMA URL or issue ID (e.g., https://emma.msrb.org/IssueView/Details/P2415140)")
    p.add_argument("--name", "-n", help="Community/engagement name to search for (e.g., 'Edgewood Baldwin')")
    p.add_argument("--engagement", help="Twenty engagement ID (if known)")
    p.add_argument("--community", help="Twenty community ID (if known)")
    p.add_argument("--sharepoint-drive", help="SharePoint drive ID for upload")
    p.add_argument("--sharepoint-folder", help="SharePoint folder path (e.g., 'IT Advisory/EMMA Reports')")
    p.add_argument("--output", "-o", help="Output directory for downloaded docs")
    p.set_defaults(func=cmd_auto)
    
    # search
    p = subparsers.add_parser("search", help="Search for issues")
    p.add_argument("query", help="Search query")
    p.add_argument("--state", help="Filter by state (e.g., NH)")
    p.set_defaults(func=cmd_search)
    
    # issue
    p = subparsers.add_parser("issue", help="Get issue details")
    p.add_argument("issue_id", help="EMMA issue ID (e.g., P2415140)")
    p.set_defaults(func=cmd_issue)
    
    # docs
    p = subparsers.add_parser("docs", help="List available documents")
    p.add_argument("issue_id", help="EMMA issue ID")
    p.set_defaults(func=cmd_docs)
    
    # download
    p = subparsers.add_parser("download", help="Download documents")
    p.add_argument("issue_id", help="EMMA issue ID")
    p.add_argument("--output", "-o", help="Output directory")
    p.add_argument("--types", help="Comma-separated types: official_statement,quarterly,occupancy,audited_financial,presale_marketing")
    p.set_defaults(func=cmd_download)
    
    # extract
    p = subparsers.add_parser("extract", help="Extract key metrics from downloaded docs")
    p.add_argument("issue_id", help="EMMA issue ID")
    p.add_argument("--from-dir", help="Directory with downloaded docs")
    p.set_defaults(func=cmd_extract)
    
    # sync
    p = subparsers.add_parser("sync", help="Sync to Twenty CRM and SharePoint")
    p.add_argument("issue_id", help="EMMA issue ID")
    p.add_argument("--engagement", help="Twenty CRM engagement ID (preferred)")
    p.add_argument("--community", help="Twenty CRM community ID")
    p.add_argument("--twenty-id", help="Twenty CRM company ID (legacy)")
    p.add_argument("--sharepoint-drive", help="SharePoint drive ID")
    p.add_argument("--sharepoint-path", help="SharePoint folder path")
    p.add_argument("--from-dir", help="Directory with downloaded docs")
    p.set_defaults(func=cmd_sync)
    
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
