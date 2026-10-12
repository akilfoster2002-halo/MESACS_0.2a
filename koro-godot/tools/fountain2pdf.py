"""A screenplay in Fountain (docs/script/*.fountain) as a properly formatted PDF: Courier 12, 1.5in left margin,
sluglines, action, centred character cues, dialogue and parentheticals at their indents, transitions right.
Rendered through headless Chrome.   python3 tools/fountain2pdf.py <file.fountain>"""
import html, os, re, subprocess, sys
src = sys.argv[1]; txt = open(src).read()
head, _, body = txt.partition('\n====\n')
meta = dict(re.findall(r'^(\w[\w ]*):\s*(.*)$', head, re.M))
lines = body.strip('\n').split('\n')
out = []; i = 0
def nxt(j):
    while j < len(lines) and not lines[j].strip(): j += 1
    return j
while i < len(lines):
    l = lines[i].rstrip(); s = l.strip()
    if not s: i += 1; continue
    e = html.escape(s)
    up = s == s.upper() and re.search('[A-Z]', s)
    if re.match(r'^(INT\.|EXT\.|INT/EXT)', s): out.append(f'<p class="slug">{e}</p>')
    elif s in ('FADE IN:',): out.append(f'<p class="fadein">{e}</p>')
    elif up and (s.endswith('TO:') or s in ('CUT TO BLACK.',)): out.append(f'<p class="trans">{e}</p>')
    elif s.startswith('END OF'): out.append(f'<p class="end">{e}</p>')
    elif up and s.startswith(('INSERT', 'BACK TO SCENE', 'SUPER:')): out.append(f'<p class="slug sub">{e}</p>')
    elif up and i + 1 < len(lines) and lines[i + 1].strip() and not s.endswith(('.', '!', '?', ':')):
        out.append(f'<p class="cue">{e}</p>'); i += 1
        while i < len(lines) and lines[i].strip():
            d = lines[i].strip()
            out.append(f'<p class="paren">{html.escape(d)}</p>' if d.startswith('(') else f'<p class="dia">{html.escape(d)}</p>'); i += 1
        continue
    else: out.append(f'<p class="action">{e}</p>')
    i += 1
title = html.escape(meta.get('Title', 'Untitled'))
page = f'''<!doctype html><html><head><meta charset="utf-8"><title>{title}</title><style>
@page {{ size: Letter; margin: 1in 1in 1in 1.5in; }}
body {{ font: 12pt/1.0 "Courier Prime", "Courier New", Courier, monospace; color: #000; margin: 0; }}
p {{ margin: 0 0 12pt 0; }}
.titlepage {{ height: 9in; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; }}
.titlepage h1 {{ font-size: 12pt; font-weight: normal; text-transform: uppercase; margin: 0 0 24pt; }}
.titlepage .meta {{ margin-top: 2in; text-align: left; font-size: 12pt; }}
.slug {{ text-transform: uppercase; font-weight: bold; margin-top: 24pt; page-break-after: avoid; }}
.slug.sub {{ font-weight: normal; margin-top: 12pt; }}
.fadein {{ margin-bottom: 24pt; }}
.action {{ max-width: 6in; }}
.cue {{ margin: 0 0 0 2.2in; text-transform: uppercase; page-break-after: avoid; }}
.paren {{ margin: 0 0 0 1.6in; max-width: 2in; }}
.dia {{ margin: 0 0 12pt 1.0in; max-width: 3.5in; }}
.paren + .dia, .dia + .dia {{ margin-top: 0; }}
.cue + .dia {{ margin-top: 0; }}
.trans {{ text-align: right; margin-top: 12pt; }}
.end {{ text-align: center; margin-top: 36pt; text-decoration: underline; }}
</style></head><body>
<div class="titlepage"><h1>{title}</h1><div>{html.escape(meta.get("Credit", ""))}</div><div class="meta">{html.escape(meta.get("Draft date", ""))}<br>{html.escape(meta.get("Notes", ""))}</div></div>
{chr(10).join(out)}
</body></html>'''
h = os.path.splitext(src)[0] + '.html'; open(h, 'w').write(page)
pdf = os.path.splitext(src)[0] + '.pdf'
chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
subprocess.run([chrome, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', f'--print-to-pdf={pdf}', 'file://' + os.path.abspath(h)], check=True, capture_output=True)
print(pdf, os.path.getsize(pdf))
