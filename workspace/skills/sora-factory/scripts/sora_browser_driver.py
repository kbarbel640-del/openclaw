#!/usr/bin/env python3
"""
Sora Browser Driver (CDP)
Connects to an existing Chrome instance (CDP) and performs scripted actions
for Sora: submit prompts, poll status, and capture download URLs.

This is a best-effort automation layer. You MUST tune selectors and JS in
assets/sora_browser_config.yaml to match the current Sora UI.
"""

import asyncio
import json
import time
import urllib.request
import urllib.parse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import yaml
import websockets


@dataclass
class DriverConfig:
    cdp_base_url: str
    new_target_url: str
    submit_url: str
    library_url: str
    prompt_selector: str
    generate_selector: str
    new_prompt_selector: Optional[str]
    status_js: str
    download_js: str
    capture_mime_types: List[str]
    capture_url_substrings: List[str]
    wait_after_submit_sec: int
    poll_interval_sec: int
    download_dir: Optional[str]


class CDPConnection:
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self._ws = None
        self._next_id = 1
        self._pending: Dict[int, asyncio.Future] = {}
        self._handlers: Dict[str, List[Callable[[Dict[str, Any]], None]]] = {}
        self._recv_task = None

    async def connect(self):
        self._ws = await websockets.connect(self.ws_url, max_size=32 * 1024 * 1024)
        self._recv_task = asyncio.create_task(self._recv_loop())

    async def close(self):
        if self._recv_task:
            self._recv_task.cancel()
        if self._ws:
            await self._ws.close()

    async def _recv_loop(self):
        try:
            async for message in self._ws:
                data = json.loads(message)
                if "id" in data:
                    fut = self._pending.pop(data["id"], None)
                    if fut and not fut.done():
                        fut.set_result(data)
                elif "method" in data:
                    for handler in self._handlers.get(data["method"], []):
                        handler(data)
        except asyncio.CancelledError:
            return

    def on(self, method: str, handler: Callable[[Dict[str, Any]], None]):
        self._handlers.setdefault(method, []).append(handler)

    async def call(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if params is None:
            params = {}
        msg_id = self._next_id
        self._next_id += 1
        payload = {"id": msg_id, "method": method, "params": params}
        fut = asyncio.get_event_loop().create_future()
        self._pending[msg_id] = fut
        await self._ws.send(json.dumps(payload))
        resp = await fut
        if "error" in resp:
            raise RuntimeError(resp["error"])
        return resp.get("result", {})


class SoraBrowserDriver:
    def __init__(self, config: DriverConfig):
        self.config = config
        self.conn: Optional[CDPConnection] = None
        self.captured_urls: List[str] = []

    @staticmethod
    def _http_json(url: str) -> Dict[str, Any]:
        with urllib.request.urlopen(url) as resp:
            return json.loads(resp.read().decode("utf-8"))

    @classmethod
    def from_config_file(cls, path: str) -> "SoraBrowserDriver":
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        cfg = DriverConfig(
            cdp_base_url=data["cdp"]["base_url"],
            new_target_url=data["cdp"].get("new_target_url", "about:blank"),
            submit_url=data["sora"]["submit_url"],
            library_url=data["sora"]["library_url"],
            prompt_selector=data["selectors"]["prompt"],
            generate_selector=data["selectors"]["generate"],
            new_prompt_selector=data["selectors"].get("new_prompt"),
            status_js=data["scripts"].get("status_js", "return []"),
            download_js=data["scripts"].get("download_js", "return []"),
            capture_mime_types=data["network"].get("capture_mime_types", ["video/mp4"]),
            capture_url_substrings=data["network"].get("capture_url_substrings", [".mp4"]),
            wait_after_submit_sec=data.get("timing", {}).get("wait_after_submit_sec", 8),
            poll_interval_sec=data.get("timing", {}).get("poll_interval_sec", 20),
            download_dir=(data.get("downloads", {}) or {}).get("download_dir") or None,
        )
        return cls(cfg)

    async def _create_target(self) -> str:
        # Try create new target; fallback to existing tab if blocked
        encoded = urllib.parse.quote(self.config.new_target_url, safe="")
        candidates = [
            f"{self.config.cdp_base_url}/json/new?{encoded}",
            f"{self.config.cdp_base_url}/json/new?{self.config.new_target_url}",
        ]
        for url in candidates:
            try:
                data = self._http_json(url)
                if isinstance(data, dict) and data.get("webSocketDebuggerUrl"):
                    return data["webSocketDebuggerUrl"]
            except Exception:
                pass

        # Fallback: pick an existing page
        pages = self._http_json(f"{self.config.cdp_base_url}/json/list")
        if isinstance(pages, list) and pages:
            for page in pages:
                if page.get("type") == "page" and page.get("webSocketDebuggerUrl"):
                    return page["webSocketDebuggerUrl"]
        raise RuntimeError("No available CDP page target")

    async def _attach(self):
        ws_url = await self._create_target()
        self.conn = CDPConnection(ws_url)
        await self.conn.connect()
        await self.conn.call("Page.enable")
        await self.conn.call("Runtime.enable")
        await self.conn.call("Network.enable")
        self.conn.on("Network.responseReceived", self._on_response)

        # Make downloads deterministic if configured.
        if self.config.download_dir:
            dl = str(Path(self.config.download_dir).expanduser())
            try:
                # Newer Chromium
                await self.conn.call("Browser.setDownloadBehavior", {"behavior": "allow", "downloadPath": dl})
            except Exception:
                try:
                    # Older Chromium
                    await self.conn.call("Page.setDownloadBehavior", {"behavior": "allow", "downloadPath": dl})
                except Exception:
                    pass

    def _on_response(self, evt: Dict[str, Any]):
        res = evt.get("params", {}).get("response", {})
        url = res.get("url", "")
        mime = res.get("mimeType", "")
        if any(url_sub in url for url_sub in self.config.capture_url_substrings) or mime in self.config.capture_mime_types:
            if url not in self.captured_urls:
                self.captured_urls.append(url)
        # Try to extract signed video URLs from JSON responses
        if "application/json" in mime:
            try:
                asyncio.get_event_loop().create_task(self._extract_urls_from_response(evt))
            except Exception:
                pass

    async def _extract_urls_from_response(self, evt: Dict[str, Any]):
        if not self.conn:
            return
        req_id = evt.get("params", {}).get("requestId")
        if not req_id:
            return
        try:
            body = await self.conn.call("Network.getResponseBody", {"requestId": req_id})
        except Exception:
            return
        text = body.get("body", "") if isinstance(body, dict) else ""
        if not text:
            return
        matches = re.findall(r"https://videos\.openai\.com[^\"']+", text)
        for m in matches:
            if m not in self.captured_urls:
                self.captured_urls.append(m)

    async def _navigate(self, url: str):
        assert self.conn
        await self.conn.call("Page.navigate", {"url": url})
        try:
            await self._wait_event("Page.loadEventFired", timeout=20)
        except asyncio.TimeoutError:
            pass

    async def _wait_event(self, method: str, timeout: int = 30):
        fut = asyncio.get_event_loop().create_future()

        def handler(evt):
            if not fut.done():
                fut.set_result(evt)

        assert self.conn
        self.conn.on(method, handler)
        return await asyncio.wait_for(fut, timeout=timeout)

    async def _eval(self, expression: str) -> Any:
        assert self.conn
        result = await self.conn.call("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
        })
        return result.get("result", {}).get("value")

    async def _wait_for_selector(self, selector: str, timeout: int = 20):
        start = time.time()
        while time.time() - start < timeout:
            found = await self._eval(f"Boolean(document.querySelector({json.dumps(selector)}))")
            if found:
                return True
            await asyncio.sleep(0.5)
        return False

    async def _click(self, selector: str) -> bool:
        if selector.startswith("text="):
            text = selector.replace("text=", "", 1).strip()
            return bool(await self._eval(
                f"(function(){{const els=[...document.querySelectorAll('button,div,span')]; const el=els.find(e=>e.innerText && e.innerText.includes({json.dumps(text)})); if(!el) return false; el.click(); return true;}})()"
            ))
        return bool(await self._eval(
            f"(function(){{const el=document.querySelector({json.dumps(selector)}); if(!el) return false; el.click(); return true;}})()"
        ))

    async def _type(self, selector: str, text: str) -> bool:
        return bool(await self._eval(
            f"(function(){{const el=document.querySelector({json.dumps(selector)}); if(!el) return false; el.focus(); if(el.isContentEditable){{el.innerText={json.dumps(text)};}} else {{el.value={json.dumps(text)};}} el.dispatchEvent(new Event('input',{{bubbles:true}})); return true;}})()"
        ))

    async def submit_prompt(self, prompt_text: str) -> bool:
        if not self.conn:
            await self._attach()
        await self._navigate(self.config.submit_url)
        if self.config.new_prompt_selector:
            await self._click(self.config.new_prompt_selector)
        ok = await self._wait_for_selector(self.config.prompt_selector, timeout=30)
        if not ok:
            return False
        if not await self._type(self.config.prompt_selector, prompt_text):
            return False
        clicked = await self._click(self.config.generate_selector)
        if not clicked:
            # fallback: try Ctrl/Cmd+Enter on input
            _ = await self._eval(
                f"(function(){{const el=document.querySelector({json.dumps(self.config.prompt_selector)}); if(!el) return false; const evt=new KeyboardEvent('keydown',{{key:'Enter',code:'Enter',keyCode:13,which:13,ctrlKey:true,metaKey:true,bubbles:true}}); el.dispatchEvent(evt); return true;}})()"
            )
        await asyncio.sleep(self.config.wait_after_submit_sec)
        return True

    async def click_download(self) -> Dict[str, Any]:
        """Run download_js once; returns result dict."""
        if not self.conn:
            await self._attach()
        result = await self._eval(self.config.download_js or "return {clicked:null};")
        return result if isinstance(result, dict) else {"result": result}

    async def download_from_urls(self, urls: List[str], per_url_attempts: int = 6, sleep_between_sec: float = 1.0) -> List[Dict[str, Any]]:
        """Navigate to each draft URL and trigger download (best-effort)."""
        if not self.conn:
            await self._attach()
        outcomes: List[Dict[str, Any]] = []
        for url in urls:
            await self._navigate(url)
            ok = False
            last = None
            for _ in range(per_url_attempts):
                last = await self.click_download()
                # after opening menu, a subsequent attempt should click Download
                if isinstance(last, dict) and last.get('clicked') == 'download':
                    ok = True
                    break
                await asyncio.sleep(0.6)
            outcomes.append({"url": url, "ok": ok, "last": last})
            await asyncio.sleep(sleep_between_sec)
        return outcomes

    async def poll_status(self) -> List[Dict[str, Any]]:
        if not self.conn:
            await self._attach()
        await self._navigate(self.config.library_url)
        js = f"(function(){{{self.config.status_js}}})()"
        result = await self._eval(js)
        return result or []

    async def trigger_downloads(self) -> List[str]:
        if not self.conn:
            await self._attach()
        await self._navigate(self.config.library_url)
        js = f"(function(){{{self.config.download_js}}})()"
        _ = await self._eval(js)
        return self.captured_urls

    async def download_urls(self, urls: List[str], download_dir: str):
        if not self.conn:
            await self._attach()
        # Try both Page and Browser download behavior APIs
        try:
            await self.conn.call("Page.setDownloadBehavior", {
                "behavior": "allow",
                "downloadPath": download_dir
            })
        except Exception:
            pass
        try:
            await self.conn.call("Browser.setDownloadBehavior", {
                "behavior": "allow",
                "downloadPath": download_dir
            })
        except Exception:
            pass
        # Ensure we are on library page for correct session context
        await self._navigate(self.config.library_url)
        for url in urls:
            await self._download_via_cdp(url, download_dir)
            await asyncio.sleep(2)

    async def _download_via_cdp(self, url: str, download_dir: str):
        """Download a URL by capturing response body via CDP."""
        assert self.conn
        done = asyncio.get_event_loop().create_future()

        async def handler(evt):
            res = evt.get("params", {}).get("response", {})
            if res.get("url") != url:
                return
            req_id = evt.get("params", {}).get("requestId")
            if not req_id:
                return
            try:
                body = await self.conn.call("Network.getResponseBody", {"requestId": req_id})
            except Exception:
                if not done.done():
                    done.set_result(False)
                return
            data = body.get("body", "")
            is_b64 = body.get("base64Encoded", False)
            if not data:
                if not done.done():
                    done.set_result(False)
                return
            import base64
            raw = base64.b64decode(data) if is_b64 else data.encode("utf-8")
            Path(download_dir).mkdir(parents=True, exist_ok=True)
            fname = "video_" + str(int(time.time() * 1000)) + ".mp4"
            out = Path(download_dir) / fname
            with open(out, "wb") as f:
                f.write(raw)
            if not done.done():
                done.set_result(True)

        def _on(evt):
            asyncio.create_task(handler(evt))

        self.conn.on("Network.responseReceived", _on)
        await self._navigate(url)
        try:
            await asyncio.wait_for(done, timeout=20)
        except asyncio.TimeoutError:
            pass

    async def capture_urls(self, seconds: int = 120) -> List[str]:
        if not self.conn:
            await self._attach()
        # Ensure library page is open to trigger network fetches
        await self._navigate(self.config.library_url)
        start = time.time()
        while time.time() - start < seconds:
            await asyncio.sleep(1)
        return list(self.captured_urls)


def _load_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    sub = parser.add_subparsers(dest="cmd")

    p_submit = sub.add_parser("submit")
    p_submit.add_argument("--prompt-file", required=True)

    p_poll = sub.add_parser("poll")

    p_capture = sub.add_parser("capture")
    p_capture.add_argument("--seconds", type=int, default=120)
    p_capture.add_argument("--out", default="output/raw/captured_urls.json")

    args = parser.parse_args()

    driver = SoraBrowserDriver.from_config_file(args.config)

    async def _run():
        if args.cmd == "submit":
            prompt = _load_text(args.prompt_file)
            ok = await driver.submit_prompt(prompt)
            print("ok" if ok else "failed")
        elif args.cmd == "poll":
            result = await driver.poll_status()
            print(json.dumps(result, ensure_ascii=False, indent=2))
        elif args.cmd == "capture":
            urls = await driver.capture_urls(seconds=args.seconds)
            Path(args.out).parent.mkdir(parents=True, exist_ok=True)
            with open(args.out, "w", encoding="utf-8") as f:
                json.dump({"urls": urls}, f, ensure_ascii=False, indent=2)
            print(f"captured: {len(urls)}")
        else:
            parser.print_help()

    asyncio.run(_run())


if __name__ == "__main__":
    main()
