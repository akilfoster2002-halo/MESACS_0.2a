#!/usr/bin/env python3
"""Generate 3D models with Tripo's API and save them as .glb.

  python3 tools/tripo/tripo.py balance
  python3 tools/tripo/tripo.py text "a dented subway vending machine" -o out.glb
  python3 tools/tripo/tripo.py image photo.png -o out.glb [--no-texture] [--hd]

The key is TRIPO_API_KEY, read from the environment or from .env in the repo root.
"""
import argparse, json, mimetypes, os, sys, time, urllib.request, uuid
from pathlib import Path

API = "https://api.tripo3d.ai/v2/openapi"
ROOT = Path(__file__).resolve().parents[2]


def key():
    k = os.environ.get("TRIPO_API_KEY")
    if not k:
        for name in (".env", ".env.local"):
            p = ROOT / name
            if p.exists():
                for line in p.read_text().splitlines():
                    if line.startswith("TRIPO_API_KEY="):
                        k = line.split("=", 1)[1].strip().strip('"')
    if not k:
        sys.exit("TRIPO_API_KEY is not set (add it to .env)")
    return k


def call(method, path, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body else None)
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"Authorization": f"Bearer {key()}", "Content-Type": ctype})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            res = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Tripo {e.code}: {e.read().decode()}")
    if res.get("code") != 0:
        sys.exit(f"Tripo error: {res}")
    return res["data"]


def upload(path):
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{Path(path).name}\"\r\n"
            f"Content-Type: {mimetypes.guess_type(path)[0] or 'image/png'}\r\n\r\n").encode()
    body += Path(path).read_bytes() + f"\r\n--{b}--\r\n".encode()
    return call("POST", "/upload", raw=body, ctype=f"multipart/form-data; boundary={b}")["image_token"]


def run(task, out):
    tid = call("POST", "/task", task)["task_id"]
    print(f"task {tid}", file=sys.stderr)
    while True:
        d = call("GET", f"/task/{tid}")
        st = d["status"]
        print(f"  {st} {d.get('progress', 0)}%", file=sys.stderr)
        if st == "success":
            break
        if st in ("failed", "cancelled", "unknown", "banned", "expired"):
            sys.exit(f"task {st}")
        time.sleep(4)
    o = d["output"]
    url = o.get("pbr_model") or o.get("model") or o.get("base_model")
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, out)
    print(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["text", "image", "balance"])
    ap.add_argument("input", nargs="?")
    ap.add_argument("-o", "--out", default="tripo.glb")
    ap.add_argument("--no-texture", action="store_true")
    ap.add_argument("--hd", action="store_true")
    a = ap.parse_args()
    if a.mode == "balance":
        print(call("GET", "/user/balance"))
        return
    task = {"texture": not a.no_texture, "pbr": not a.no_texture}
    if a.hd:
        task["texture_quality"] = "detailed"
    if a.mode == "text":
        task.update(type="text_to_model", prompt=a.input)
    else:
        task.update(type="image_to_model", file={"type": Path(a.input).suffix.lstrip(".").lower().replace("jpeg", "jpg"), "file_token": upload(a.input)})
    run(task, a.out)


if __name__ == "__main__":
    main()
