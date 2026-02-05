#!/usr/bin/env python3
"""
Threads Feed Extractor
用 browser evaluate 在頁面端直接提取結構化數據，省 90% token。

用法（在 Moltbot session 裡）：
1. browser navigate → threads.net
2. browser act → evaluate，貼入 EXTRACT_FEED_JS
3. 拿到精簡 JSON：[{a: author, t: time, c: content, l: likes, r: replies, rp: reposts, s: shares}]

關鍵發現：
- Threads 的按鈕是 div[role="button"] 不是 <button>
- Feed 容器是 class 含 "x78zum5 xdt5ytf x1iyjqo2 x1n2onr6" 且 children > 5 的 div
- 每篇貼文在 :scope > div > div 裡，用 a[href*="/post/"] 定位
- 內容文字用 [dir="auto"] 選擇器提取
"""

# 完整版提取器（含互動數）
EXTRACT_FEED_JS = r"""
() => {
    const feed = document.querySelectorAll('div[class*="x78zum5 xdt5ytf x1iyjqo2 x1n2onr6"]');
    let bigDiv = null;
    feed.forEach(d => { if (d.children.length > 5) bigDiv = d; });
    if (!bigDiv) return '[]';

    const posts = bigDiv.querySelectorAll(':scope > div > div');
    const result = [];

    posts.forEach((el) => {
        const postLink = el.querySelector('a[href*="/post/"]');
        if (!postLink) return;

        const href = postLink.getAttribute('href');
        const authorMatch = href.match(/\/@([\w._]+)/);
        const timeEl = el.querySelector('time');

        // 提取內容（用 dir="auto" 找文字塊）
        const dirTexts = el.querySelectorAll('[dir="auto"]');
        let content = '';
        dirTexts.forEach(d => {
            const t = d.textContent.trim();
            if (t.length > 10 && !t.match(/^[\w._]+$/) && content.length < 5) content = t;
        });
        if (content.length < 5) return;

        // 提取互動數（Threads 用 div[role="button"]）
        const btns = el.querySelectorAll('div[role="button"]');
        let l=0, r=0, rp=0, s=0;
        btns.forEach(btn => {
            const t = btn.textContent.trim();
            const n = parseInt((t.match(/[\d,]+/) || ['0'])[0].replace(/,/g, '')) || 0;
            const wan = t.includes('萬');
            const num = wan ? parseFloat(t.match(/[\d.]+/)?.[0] || 0) * 10000 : n;
            if (t.startsWith('讚')) l = num;
            else if (t.startsWith('回覆')) r = num;
            else if (t.startsWith('轉發')) rp = num;
            else if (t.startsWith('分享')) s = num;
        });

        result.push({
            a: authorMatch?.[1] || '?',
            t: timeEl?.textContent?.trim() || '',
            c: content.substring(0, 200),
            l, r, rp, s
        });
    });

    return JSON.stringify(result.slice(0, 20));
}
"""

# 輕量版（只提取文字，不含互動數）
EXTRACT_TEXT_ONLY_JS = r"""
() => {
    const feed = document.querySelectorAll('div[class*="x78zum5 xdt5ytf x1iyjqo2 x1n2onr6"]');
    let bigDiv = null;
    feed.forEach(d => { if (d.children.length > 5) bigDiv = d; });
    if (!bigDiv) return '[]';

    const posts = bigDiv.querySelectorAll(':scope > div > div');
    const result = [];

    posts.forEach((el) => {
        const postLink = el.querySelector('a[href*="/post/"]');
        if (!postLink) return;
        const href = postLink.getAttribute('href');
        const authorMatch = href.match(/\/@([\w._]+)/);
        const timeEl = el.querySelector('time');
        const dirTexts = el.querySelectorAll('[dir="auto"]');
        let content = '';
        dirTexts.forEach(d => {
            const t = d.textContent.trim();
            if (t.length > 10 && !t.match(/^[\w._]+$/) && content.length < 5) content = t;
        });
        if (content.length < 5) return;
        result.push({
            a: authorMatch?.[1] || '?',
            t: timeEl?.textContent?.trim() || '',
            c: content.substring(0, 150)
        });
    });

    return JSON.stringify(result.slice(0, 20));
}
"""
