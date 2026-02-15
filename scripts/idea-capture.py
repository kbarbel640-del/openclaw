#!/usr/bin/env python3
"""
Idea Capture — автоматический захват идей из сообщений
Встроенный в OpenClaw/Molt Telegram чат
"""

import sys
import json
import re
import os
from datetime import datetime
from pathlib import Path

# Эвристики для определения идей
IDEA_MARKERS = [
    r'\b(надо|нужно|стоит)\b',
    r'\b(сделать|создать|построить|придумать|автоматизировать|запилить)\b',
    r'\b(система|инструмент|бот|приложение|скрипт)\b',
    r'\b(идея|мысль|надо)\s*:',
]

IDEA_PREFIXES = ['✨', '🎯', '💡']

CONFIDENCE_MARKERS = {
    'high': [r'\b(круто|охуенно|пиздато|классная)\b', r'!{2,}'],  # энтузиазм
    'medium': [r'\b(надо|нужно)\b', r'\?\s*$'],  # намерение или вопрос
}

def extract_title(text: str, max_words: int = 10) -> str:
    """Извлекает заголовок из текста"""
    # Убираем префиксы
    for prefix in IDEA_PREFIXES:
        text = text.replace(prefix, '', 1)
    
    # Берём первые N слов
    words = text.strip().split()[:max_words]
    title = ' '.join(words)
    
    # Ограничиваем длину
    if len(title) > 60:
        title = title[:57] + '...'
    
    return title.strip()

def calculate_confidence(text: str) -> int:
    """Оценивает уверенность что это идея (0-10)"""
    score = 0
    text_lower = text.lower()
    
    # Базовые маркеры (+2 за каждый)
    for pattern in IDEA_MARKERS:
        if re.search(pattern, text_lower):
            score += 2
    
    # Префиксы явные (+3)
    for prefix in IDEA_PREFIXES:
        if text.startswith(prefix):
            score += 3
    
    # Высокая энергия/энтузиазм (+2)
    for pattern in CONFIDENCE_MARKERS['high']:
        if re.search(pattern, text_lower):
            score += 2
    
    # Длина — короткие реже полные идеи (-1 если < 10 слов)
    words_count = len(text.split())
    if words_count < 5:
        score -= 1
    elif words_count > 20:
        score += 1  # развёрнутое описание = зрелая идея
    
    return min(max(score, 0), 10)

def is_idea(text: str) -> bool:
    """Определяет является ли текст идеей"""
    if not text or len(text.strip()) < 5:
        return False
    
    confidence = calculate_confidence(text)
    return confidence >= 4  # порог "это идея"

def create_slug(title: str) -> str:
    """Создаёт slug из заголовка"""
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[\s-]+', '-', slug)
    return slug[:30]

def save_idea(text: str, confidence: int) -> str:
    """Сохраняет идеу в PARA-структуру"""
    # Директория для идей
    ideas_dir = Path('/Users/vladdick/moltbot/notes/ideas')
    ideas_dir.mkdir(parents=True, exist_ok=True)
    
    title = extract_title(text)
    slug = create_slug(title)
    date = datetime.now().strftime('%Y-%m-%d')
    timestamp = datetime.now().isoformat()
    
    filename = f"{date}-{slug}.md"
    filepath = ideas_dir / filename
    
    # Frontmatter
    content = f"""---
title: "{title}"
date: {date}
timestamp: {timestamp}
status: Seed
confidence: {confidence}
source: telegram
tags: []
---

# {title}

## Raw Idea
{text}

## Clarification Notes
<!-- AI уточняет здесь -->

## Next Steps
- [ ] Определить зону (PARA)
- [ ] Связать с существующими идеями
- [ ] Установить инкубационный срок

## Links
<!-- Ссылки на связанные идеи -->
"""
    
    # Не перезаписывать если существует
    counter = 1
    while filepath.exists():
        filepath = ideas_dir / f"{date}-{slug}-{counter}.md"
        counter += 1
    
    filepath.write_text(content, encoding='utf-8')
    return str(filepath)

def main():
    """Основная логика"""
    text = sys.stdin.read().strip()
    
    if not text:
        print(json.dumps({"is_idea": False, "reason": "empty"}))
        return
    
    confidence = calculate_confidence(text)
    
    if confidence >= 4:
        if confidence >= 8:
            # Высокая уверенность — сохраняем сразу
            filepath = save_idea(text, confidence)
            result = {
                "is_idea": True,
                "confidence": confidence,
                "confidence_level": "high",
                "title": extract_title(text),
                "action": "saved",
                "filepath": filepath
            }
        else:
            # Средняя уверенность — нужно уточнение
            result = {
                "is_idea": True,
                "confidence": confidence,
                "confidence_level": "medium",
                "title": extract_title(text),
                "action": "needs_clarification",
                "reason": "Требуется уточнение перед сохранением"
            }
    else:
        result = {
            "is_idea": False,
            "confidence": confidence,
            "confidence_level": "low",
            "reason": "Похоже не на идею, а на рефлексию/болтовню"
        }
    
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
