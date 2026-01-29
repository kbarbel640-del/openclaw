"""
PARA Router - Routes extracted insights to PARA categories.
Integrates with the existing PARA system at ~/clawd/memory/para.sqlite
"""

import json
import sqlite3
from pathlib import Path
from datetime import datetime

CIS_ROOT = Path.home() / "clawd" / "content-intelligence"
PARA_DB = Path.home() / "clawd" / "memory" / "para.sqlite"

# Active project mappings for context
ACTIVE_PROJECTS = {
    "sticker-business": {
        "name": "Sticker Business Venture",
        "tags": ["sticker", "vinyl", "business", "ecommerce", "etsy"],
        "para_category": "Projects"
    },
    "ceramics": {
        "name": "Ceramics/Handmade Goods",
        "tags": ["ceramics", "pottery", "clay", "handmade", "craft"],
        "para_category": "Projects"
    },
    "ef-coaching": {
        "name": "EF Coaching Practice",
        "tags": ["coaching", "executive function", "adhd", "productivity", "focus"],
        "para_category": "Projects"
    },
    "content-intelligence": {
        "name": "Content Intelligence System",
        "tags": ["content", "curation", "automation", "intelligence"],
        "para_category": "Projects"
    }
}

# Area mappings
ACTIVE_AREAS = {
    "business-development": {
        "name": "Business Development",
        "tags": ["business", "marketing", "sales", "growth", "strategy"]
    },
    "creative-practice": {
        "name": "Creative Practice",
        "tags": ["art", "design", "creativity", "craft", "making"]
    },
    "personal-productivity": {
        "name": "Personal Productivity",
        "tags": ["productivity", "focus", "habits", "routines", "systems"]
    },
    "learning-development": {
        "name": "Learning & Development",
        "tags": ["learning", "education", "skills", "growth", "development"]
    }
}


class PARARouter:
    """Routes insights to appropriate PARA categories."""
    
    def __init__(self):
        self.para_db = PARA_DB
    
    def route_insights(self, name, dry_run=False):
        """Route insights from a source to PARA categories."""
        from source_manager import SourceManager
        
        manager = SourceManager()
        
        if name == 'all':
            sources = manager.list_sources()
            for source_name in sources:
                print(f"\n--- Routing insights for: {source_name} ---")
                self._route_source_insights(source_name, dry_run)
            return 0
        else:
            return self._route_source_insights(name, dry_run)
    
    def _route_source_insights(self, name, dry_run=False):
        """Route insights for a single source."""
        from source_manager import SourceManager
        
        manager = SourceManager()
        source = manager.get_source(name)
        
        if not source:
            print(f"Error: Source '{name}' not found")
            return 1
        
        safe_name = source['safe_name']
        insights_dir = CIS_ROOT / "sources" / safe_name / "insights"
        
        if not insights_dir.exists():
            print(f"No insights found for {name}. Run 'extract' first.")
            return 1
        
        insight_files = list(insights_dir.glob('*.json'))
        
        if not insight_files:
            print(f"No insights to route for {name}")
            return 1
        
        print(f"Routing {len(insight_files)} insight files from {source['name']}...")
        
        routed = 0
        routing_log = []
        
        for insight_file in insight_files:
            try:
                with open(insight_file, 'r') as f:
                    insights = json.load(f)
                
                # Route each type of insight
                routes = self._determine_routes(insights)
                
                for route in routes:
                    routing_entry = {
                        'source': safe_name,
                        'source_title': insights.get('source_title', 'Unknown'),
                        'source_url': insights.get('source_url', ''),
                        'insight_type': route['type'],
                        'insight_content': route['content'],
                        'para_category': route['category'],
                        'para_target': route['target'],
                        'rationale': route['rationale'],
                        'routed_at': datetime.now().isoformat()
                    }
                    routing_log.append(routing_entry)
                    
                    if not dry_run:
                        self._save_to_para(routing_entry)
                
                routed += len(routes)
                
            except Exception as e:
                print(f"  Error routing {insight_file.stem}: {e}")
                continue
        
        # Save routing log
        log_file = CIS_ROOT / "sources" / safe_name / "metadata" / "para_routing.json"
        with open(log_file, 'w') as f:
            json.dump(routing_log, f, indent=2)
        
        if dry_run:
            print(f"\n[DRY RUN] Would route {routed} insights:")
            for entry in routing_log[:10]:  # Show first 10
                print(f"  → {entry['para_category']}/{entry['para_target']}: {entry['insight_content'][:60]}...")
            if len(routing_log) > 10:
                print(f"  ... and {len(routing_log) - 10} more")
        else:
            print(f"\n✓ Routed {routed} insights to PARA")
            print(f"  Routing log saved to: {log_file}")
        
        return 0
    
    def _determine_routes(self, insights):
        """Determine PARA routing for extracted insights."""
        routes = []
        
        # Route actionable insights
        for actionable in insights.get('actionable', []):
            category, target, rationale = self._classify_actionable(actionable)
            routes.append({
                'type': 'actionable',
                'content': actionable.get('insight', ''),
                'category': category,
                'target': target,
                'rationale': rationale
            })
        
        # Route frameworks to Resources
        for framework in insights.get('frameworks', []):
            routes.append({
                'type': 'framework',
                'content': framework.get('name', ''),
                'category': 'Resources',
                'target': 'Mental Models & Frameworks',
                'rationale': 'Frameworks are reference material'
            })
        
        # Route resources
        for resource in insights.get('resources', []):
            routes.append({
                'type': 'resource',
                'content': resource.get('name', ''),
                'category': 'Resources',
                'target': self._classify_resource_type(resource.get('type', 'other')),
                'rationale': f"{resource.get('type', 'Resource')} mentioned in content"
            })
        
        # Route takeaways
        for takeaway in insights.get('takeaways', []):
            category, target = self._classify_takeaway(takeaway)
            routes.append({
                'type': 'takeaway',
                'content': takeaway,
                'category': category,
                'target': target,
                'rationale': 'Key insight from content'
            })
        
        return routes
    
    def _classify_actionable(self, actionable):
        """Classify an actionable insight to PARA category."""
        insight_text = actionable.get('insight', '').lower()
        applicability = actionable.get('applicability', 'personal')
        
        # Check against active projects
        for project_id, project in ACTIVE_PROJECTS.items():
            for tag in project['tags']:
                if tag in insight_text:
                    return 'Projects', project['name'], f"Matches {project_id} project tags"
        
        # Check against areas
        for area_id, area in ACTIVE_AREAS.items():
            for tag in area['tags']:
                if tag in insight_text:
                    return 'Areas', area['name'], f"Matches {area_id} area tags"
        
        # Default routing based on applicability
        if applicability == 'business':
            return 'Areas', 'Business Development', 'Business applicability'
        elif applicability in ['personal', 'health']:
            return 'Areas', 'Personal Productivity', 'Personal applicability'
        else:
            return 'Resources', 'General Insights', 'General reference material'
    
    def _classify_resource_type(self, resource_type):
        """Classify resource type to PARA target."""
        type_mapping = {
            'book': 'Books & Reading',
            'tool': 'Tools & Software',
            'article': 'Articles & Papers',
            'video': 'Videos & Courses',
            'podcast': 'Podcasts & Audio',
            'other': 'General Resources'
        }
        return type_mapping.get(resource_type, 'General Resources')
    
    def _classify_takeaway(self, takeaway):
        """Classify a takeaway to PARA category."""
        takeaway_lower = takeaway.lower()
        
        # Check against active projects
        for project_id, project in ACTIVE_PROJECTS.items():
            for tag in project['tags']:
                if tag in takeaway_lower:
                    return 'Projects', project['name']
        
        # Check against areas
        for area_id, area in ACTIVE_AREAS.items():
            for tag in area['tags']:
                if tag in takeaway_lower:
                    return 'Areas', area['name']
        
        return 'Resources', 'Key Insights'
    
    def _save_to_para(self, routing_entry):
        """Save routing entry to PARA database."""
        try:
            if not self.para_db.exists():
                print(f"Warning: PARA database not found at {self.para_db}")
                return
            
            conn = sqlite3.connect(self.para_db)
            cursor = conn.cursor()
            
            # Check if cis_routing table exists, create if not
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cis_routing (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT,
                    source_title TEXT,
                    source_url TEXT,
                    insight_type TEXT,
                    insight_content TEXT,
                    para_category TEXT,
                    para_target TEXT,
                    rationale TEXT,
                    routed_at TEXT
                )
            ''')
            
            # Insert routing entry
            cursor.execute('''
                INSERT INTO cis_routing 
                (source, source_title, source_url, insight_type, insight_content, 
                 para_category, para_target, rationale, routed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                routing_entry['source'],
                routing_entry['source_title'],
                routing_entry['source_url'],
                routing_entry['insight_type'],
                routing_entry['insight_content'],
                routing_entry['para_category'],
                routing_entry['para_target'],
                routing_entry['rationale'],
                routing_entry['routed_at']
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"Error saving to PARA: {e}")
