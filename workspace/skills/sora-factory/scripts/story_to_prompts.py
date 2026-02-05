#!/usr/bin/env python3
"""
Story to Sora Prompts Converter
將 project.yaml 劇本轉換為 Sora 最佳化的 prompt 檔案
"""

import yaml
import os
import sys
from pathlib import Path
from typing import Dict, Any

def load_project(yaml_path: str) -> dict:
    """載入專案配置"""
    with open(yaml_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def build_character_anchor(char_config: dict) -> str:
    """建立角色視覺錨點描述"""
    parts = []
    if 'appearance' in char_config:
        parts.append(char_config['appearance'])
    if 'trait' in char_config:
        parts.append(f"Expression conveys: {char_config['trait']}")
    return '. '.join(parts)

def build_scene_anchor(scene_config: dict) -> str:
    """建立場景視覺錨點描述"""
    parts = []
    if 'description' in scene_config:
        parts.append(scene_config['description'])
    if 'lighting' in scene_config:
        parts.append(f"Lighting: {scene_config['lighting']}")
    return '. '.join(parts)

def load_template_and_library() -> Dict[str, Any]:
    assets_dir = Path(__file__).parent.parent / "assets"
    template_path = assets_dir / "prompt_template.md"
    library_path = assets_dir / "success_library.yaml"
    template = None
    library = {}
    if template_path.exists():
        template = template_path.read_text(encoding="utf-8")
    if library_path.exists():
        with open(library_path, "r", encoding="utf-8") as f:
            library = yaml.safe_load(f) or {}
    return {"template": template, "library": library}

def render_template(template: str, data: dict) -> str:
    output = template
    for key, value in data.items():
        output = output.replace(f"{{{{{key}}}}}", str(value))
    return output

def generate_sora_prompt(shot: dict, project: dict) -> str:
    """
    生成單個鏡頭的 Sora prompt
    
    結構：
    1. 場景設定
    2. 角色描述（帶錨點）
    3. 動作描述
    4. 鏡頭/運鏡
    5. 情緒/氛圍
    6. 連貫性關鍵詞
    7. 技術參數
    """
    parts = []
    
    # 1. 全局風格
    style = project.get('project', {}).get('style', 'cinematic, high quality')
    
    # 2. 場景描述
    scene_name = shot.get('scene')
    if scene_name and scene_name in project.get('scenes', {}):
        scene_anchor = build_scene_anchor(project['scenes'][scene_name])
        parts.append(f"Setting: {scene_anchor}")
    
    # 3. 角色描述
    char_names = shot.get('characters', [])
    char_descriptions = []
    for char_name in char_names:
        if char_name in project.get('characters', {}):
            char_config = project['characters'][char_name]
            display_name = char_config.get('name', char_name)
            anchor = build_character_anchor(char_config)
            char_descriptions.append(f"{display_name}: {anchor}")
    
    if char_descriptions:
        parts.append("Characters: " + "; ".join(char_descriptions))
    
    # 4. 動作描述
    if 'action' in shot:
        parts.append(f"Action: {shot['action']}")
    
    # 5. 鏡頭運鏡
    if 'camera' in shot:
        parts.append(f"Camera: {shot['camera']}")
    
    # 6. 情緒氛圍
    if 'emotion' in shot:
        parts.append(f"Mood: {shot['emotion']}")
    
    # 7. 連貫性關鍵詞（關鍵！）
    continuity_keywords = [
        "consistent character design throughout",
        "maintaining visual continuity",
        "cinematic continuity",
        "same lighting and color grade"
    ]
    parts.append(f"Style: {style}. {'. '.join(continuity_keywords)}.")
    
    # 8. 時長提示
    duration = shot.get('duration', 5)
    parts.append(f"Duration: approximately {duration} seconds.")
    
    return "\n\n".join(parts)

def _normalize_shot_id(raw_id, fallback: int) -> int:
    """Normalize shot id to int for filename usage."""
    if raw_id is None:
        return fallback
    try:
        return int(raw_id)
    except (ValueError, TypeError):
        return fallback

def main():
    if len(sys.argv) < 2:
        print("Usage: python story_to_prompts.py <project.yaml>")
        print("       python story_to_prompts.py <project.yaml> --output <dir>")
        sys.exit(1)
    
    yaml_path = sys.argv[1]
    output_dir = "shots"
    
    # 解析 --output 參數
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_dir = sys.argv[idx + 1]
    
    # 載入專案
    project = load_project(yaml_path)
    template_bundle = load_template_and_library()
    template = template_bundle["template"]
    library = template_bundle["library"]
    
    # 建立輸出目錄
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # 生成每個鏡頭的 prompt
    shots = project.get('shots', [])
    
    if not shots:
        print("⚠️ 沒有找到 shots 定義")
        sys.exit(1)
    
    print(f"📋 解析 {len(shots)} 個鏡頭...")
    
    manifest = []
    
    for idx, shot in enumerate(shots, start=1):
        raw_id = shot.get('id')
        shot_id = _normalize_shot_id(raw_id, idx)
        filename = f"shot_{shot_id:03d}.txt"
        filepath = Path(output_dir) / filename
        
        base_prompt = generate_sora_prompt(shot, project)
        if template:
            scene_anchor = ""
            scene_name = shot.get("scene")
            if scene_name and scene_name in project.get("scenes", {}):
                scene_anchor = build_scene_anchor(project["scenes"][scene_name])
            char_names = shot.get("characters", [])
            char_descriptions = []
            for char_name in char_names:
                if char_name in project.get("characters", {}):
                    char_config = project["characters"][char_name]
                    display_name = char_config.get("name", char_name)
                    anchor = build_character_anchor(char_config)
                    char_descriptions.append(f"{display_name}: {anchor}")
            character_anchor = "; ".join(char_descriptions)
            data = {
                "action": shot.get("action", ""),
                "scene_anchor": scene_anchor,
                "character_anchor": character_anchor,
                "camera": shot.get("camera", ""),
                "lighting": project.get("scenes", {}).get(scene_name, {}).get("lighting", ""),
                "emotion": shot.get("emotion", ""),
                "style": project.get("project", {}).get("style", ""),
                "duration": shot.get("duration", 5),
                "color_palette": (library.get("color_palette") or [""])[0],
            }
            prompt = render_template(template, data).strip()
        else:
            prompt = base_prompt
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(prompt)
        
        manifest.append({
            'id': shot_id,
            'source_id': raw_id if raw_id is not None else shot_id,
            'file': filename,
            'duration': shot.get('duration', 5),
            'scene': shot.get('scene', 'unknown'),
            'style': project.get("project", {}).get("style", ""),
            'color_palette': (library.get("color_palette") or [""])[0],
            'template_used': bool(template),
        })
        
        print(f"  ✅ {filename} ({shot.get('duration', 5)}s)")
    
    # 寫入 manifest
    manifest_path = Path(output_dir) / "manifest.yaml"
    with open(manifest_path, 'w', encoding='utf-8') as f:
        yaml.dump({'shots': manifest, 'total_duration': sum(s['duration'] for s in manifest)}, f, allow_unicode=True)
    
    total_duration = sum(s.get('duration', 5) for s in shots)
    print(f"\n✅ 完成！共 {len(shots)} 個 prompts，預估總時長 {total_duration} 秒")
    print(f"📁 輸出目錄: {output_dir}/")
    print(f"📋 Manifest: {manifest_path}")

if __name__ == "__main__":
    main()
