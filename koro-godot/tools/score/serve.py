#!/usr/bin/env python3
"""THE SCORE EDITOR for TSH: serves tools/score/index.html, the score sheet (data/tsh_score.json) and the songs
(assets/tsh/music). The page reads and writes the sheet; the game reads it again whenever it changes, so an edit is
heard at the next cue in a running game.

    python3 koro-godot/tools/score/serve.py            # then open http://localhost:8765
"""
import json, os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse, parse_qs

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))      # koro-godot
SHEET = os.path.join(ROOT, "data", "tsh_score.json")
MUSIC = os.path.join(ROOT, "assets", "tsh", "music")
PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
SONG_EXT = (".mp3", ".ogg", ".wav")
TYPES = {".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav"}


class Handler(SimpleHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            return self._send(200, open(PAGE, "rb").read(), "text/html; charset=utf-8")
        if path == "/api/sheet":
            return self._send(200, open(SHEET, "rb").read())
        if path == "/api/tracks":
            songs = sorted(f for f in os.listdir(MUSIC) if f.lower().endswith(SONG_EXT))
            return self._send(200, json.dumps([{"name": os.path.splitext(f)[0], "file": f} for f in songs]))
        if path.startswith("/music/"):
            f = os.path.basename(unquote(path[len("/music/"):]))
            full = os.path.join(MUSIC, f)
            if not f.lower().endswith(SONG_EXT) or not os.path.isfile(full):
                return self._send(404, "{}")
            return self._send(200, open(full, "rb").read(), TYPES[os.path.splitext(f)[1].lower()])
        return self._send(404, "{}")

    def do_PUT(self):
        if urlparse(self.path).path != "/api/sheet":
            return self._send(404, "{}")
        try:
            sheet = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            assert isinstance(sheet.get("cues"), dict)
        except Exception as e:
            return self._send(400, json.dumps({"error": str(e)}))
        tmp = SHEET + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(sheet, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp, SHEET)
        return self._send(200, '{"ok": true}')

    def do_POST(self):
        """a new song, dropped on the page: into assets/tsh/music under a safe name"""
        u = urlparse(self.path)
        if u.path != "/api/upload":
            return self._send(404, "{}")
        name = parse_qs(u.query).get("name", [""])[0]
        stem, ext = os.path.splitext(os.path.basename(name))
        stem = re.sub(r"[^a-z0-9_-]+", "_", stem.lower()).strip("_") or "song"
        if ext.lower() not in SONG_EXT:
            return self._send(400, json.dumps({"error": "mp3, ogg or wav only"}))
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        with open(os.path.join(MUSIC, stem + ext.lower()), "wb") as fh:
            fh.write(data)
        return self._send(200, json.dumps({"name": stem, "file": stem + ext.lower()}))

    def log_message(self, fmt, *args):
        if not self.path.startswith("/music/"):
            sys.stderr.write("score: " + fmt % args + "\n")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    print(f"TSH score editor: http://localhost:{port}  (sheet: {os.path.relpath(SHEET)})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
