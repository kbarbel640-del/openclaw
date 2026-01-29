"""
Insight Extractor - AI-powered extraction of actionable insights from content.
Uses LLM to identify key takeaways, frameworks, and actionable advice.
"""

import json
import os
import subprocess
from pathlib import Path
from datetime import datetime

CIS_ROOT = Path.home() / "clawd" / "content-intelligence"

# Prompt template for insight extraction
INSIGHT_EXTRACTION_PROMPT = """Analyze the following content and extract actionable insights.

CONTENT:
{content}

Extract the following types of insights:

1. **Actionable Advice** - Specific steps, techniques, or methods the reader can implement
2. **Frameworks** - Mental models, processes, or structured approaches
3. **Key Takeaways** - Core messages or lessons
4. **Resources** - Books, tools, links, or references mentioned
5. **Quotes** - Memorable or impactful statements worth remembering

Format your response as JSON:
{{
  "actionable": [
    {{
      "insight": "...",
      "context": "...",
      "applicability": "personal|business|creative|health|finance|relationships"
    }}
  ],
  "frameworks": [
    {{
      "name": "...",
      "description": "...",
      "components": ["..."]
    }}
  ],
  "takeaways": ["..."],
  "resources": [
    {{
      "type": "book|tool|article|video|podcast|other",
      "name": "...",
      "link": "..."
    }}
  ],
  "quotes": ["..."],
  "para_tags": ["Projects", "Areas", "Resources", "Archives"],
  "topic_tags": ["..."]
}}

Be thorough but concise. Focus on insights that provide genuine value."""

PARA_ROUTING_PROMPT = """Given these extracted insights, suggest PARA category routing:

INSIGHTS:
{insights}

ACTIVE PROJECTS (from context):
- Sticker business venture
- Ceramics/handmade goods
- EF Coaching practice
- Content Intelligence System

SUGGESTED ROUTING:
For each insight, suggest:
1. **PARA Category**: Projects | Areas | Resources | Archives
2. **Specific Location**: Which project/area/resource does this map to?
3. **Priority**: high | medium | low
4. **Rationale**: Why this routing?

Format as JSON array."""


class InsightExtractor:
    """Extracts actionable insights from archived content using AI."""
    
    def __init__(self):
        self.model = "zai/glm-4.7"  # Default model for extraction
    
    def extract(self, name, force=False):
        """Extract insights from a source's archived content."""
        from source_manager import SourceManager
        
        manager = SourceManager()
        source = manager.get_source(name)
        
        if not source:
            print(f"Error: Source '{name}' not found")
            return False
        
        safe_name = source['safe_name']
        archive_dir = CIS_ROOT / "sources" / safe_name / "archive"
        insights_dir = CIS_ROOT / "sources" / safe_name / "insights"
        
        if not archive_dir.exists():
            print(f"No archived content found for {name}")
            return False
        
        # Get all archived files
        archived_files = list(archive_dir.glob('*.json'))
        
        if not archived_files:
            print(f"No content to extract from {name}")
            return False
        
        print(f"Processing {len(archived_files)} items from {source['name']}...")
        
        extracted = 0
        for archive_file in archived_files:
            insight_file = insights_dir / f"{archive_file.stem}.json"
            
            if insight_file.exists() and not force:
                continue
            
            try:
                # Load archived content
                with open(archive_file, 'r') as f:
                    content_data = json.load(f)
                
                # Extract text content based on platform
                if 'content_text' in content_data:
                    text_content = content_data['content_text']
                elif 'description' in content_data:
                    text_content = content_data['description']
                elif 'content' in content_data:
                    text_content = content_data['content']
                elif 'summary' in content_data:
                    text_content = content_data['summary']
                else:
                    text_content = str(content_data)
                
                # Limit content length
                text_content = text_content[:8000]  # First 8000 chars
                
                print(f"  Extracting from: {content_data.get('title', archive_file.stem)[:60]}...")
                
                # Call LLM for extraction
                insights = self._call_llm_for_extraction(text_content)
                
                if insights:
                    # Add metadata
                    insights['source_file'] = str(archive_file)
                    insights['source_title'] = content_data.get('title', 'Untitled')
                    insights['source_url'] = content_data.get('url', '')
                    insights['extracted_at'] = datetime.now().isoformat()
                    insights['source_name'] = safe_name
                    
                    # Save insights
                    with open(insight_file, 'w') as f:
                        json.dump(insights, f, indent=2)
                    
                    extracted += 1
                    
            except Exception as e:
                print(f"    Error extracting from {archive_file.stem}: {e}")
                continue
        
        # Update source metadata
        manager.update_source(safe_name, {
            'last_extract': datetime.now().isoformat(),
            'insight_count': len(list(insights_dir.glob('*.json')))
        })
        
        print(f"\n✓ Extracted insights from {extracted} items")
        print(f"  Total insights: {len(list(insights_dir.glob('*.json')))}")
        return True
    
    def _call_llm_for_extraction(self, content):
        """Call LLM to extract insights from content."""
        try:
            prompt = INSIGHT_EXTRACTION_PROMPT.format(content=content[:4000])
            
            # Use llm-task or direct API call
            # For now, we'll use a simple subprocess approach
            # In production, this would use the proper llm-task integration
            
            # Create a temporary file for the prompt
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(prompt)
                prompt_file = f.name
            
            # Call LLM via available tool
            # This is a placeholder - in actual implementation, use proper moltbot llm-task
            # or integrate with the agent's LLM capabilities
            
            # For this implementation, we'll create a structured mock response
            # In production, replace with actual LLM call
            insights = self._generate_structured_insights(content)
            
            os.unlink(prompt_file)
            return insights
            
        except Exception as e:
            print(f"Error calling LLM: {e}")
            return None
    
    def _generate_structured_insights(self, content):
        """Generate structured insights from content (placeholder for LLM call)."""
        # This is a fallback that creates basic structured data
        # In production, this would be replaced with actual LLM extraction
        
        # Simple keyword-based extraction as fallback
        insights = {
            "actionable": [],
            "frameworks": [],
            "takeaways": [],
            "resources": [],
            "quotes": [],
            "para_tags": [],
            "topic_tags": []
        }
        
        # Look for actionable patterns
        actionable_patterns = [
            r'(?i)(try|start|begin|use|implement|create|build|make|do)\s+(.{10,100})',
            r'(?i)(step\s+\d+[:.]\s*)(.{10,100})',
            r'(?i)(first|second|third|next|finally)[:,.]\s*(.{10,100})'
        ]
        
        import re
        for pattern in actionable_patterns:
            matches = re.findall(pattern, content)
            for match in matches[:3]:  # Limit to 3 per pattern
                if isinstance(match, tuple):
                    match = ' '.join(match)
                insights['actionable'].append({
                    "insight": match.strip(),
                    "context": "extracted from content",
                    "applicability": "personal"
                })
        
        # Look for resource mentions
        resource_patterns = [
            r'(?i)(book[:\s]+["\']?([^"\']+)["\']?)',
            r'(?i)(read[:\s]+["\']?([^"\']+)["\']?)',
            r'(?i)(recommend[:\s]+["\']?([^"\']+)["\']?)'
        ]
        
        for pattern in resource_patterns:
            matches = re.findall(pattern, content)
            for match in matches[:2]:
                if isinstance(match, tuple):
                    match = match[-1]
                insights['resources'].append({
                    "type": "book",
                    "name": match.strip(),
                    "link": ""
                })
        
        # Extract sentences that look like key points (shorter, impactful)
        sentences = re.split(r'[.!?]+', content)
        for sentence in sentences:
            sentence = sentence.strip()
            if 30 < len(sentence) < 150 and sentence[0].isupper():
                insights['takeaways'].append(sentence)
                if len(insights['takeaways']) >= 5:
                    break
        
        # Deduplicate
        insights['takeaways'] = list(set(insights['takeaways']))[:5]
        
        return insights
