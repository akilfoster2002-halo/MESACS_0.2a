"""A reader for Maya ASCII: the nodes (type, name, parent), the values set on them, and what is connected to
what. Nothing in the file is run; it is only read. python3 -I ma.py <file.ma>"""
import re, sys, json

def commands(text):
    out, buf, q, i, n = [], [], False, 0, len(text)
    start = 0
    while i < n:
        c = text[i]
        if q:
            if c == '\\': i += 2; continue
            if c == '"': q = False
        else:
            if c == '"': q = True
            elif c == ';':
                out.append(text[start:i].strip()); start = i + 1
            elif c == '/' and text.startswith('//', i):
                j = text.find('\n', i); j = n if j < 0 else j
                if text[start:i].strip(): pass
                else: start = j
                i = j; continue
        i += 1
    return out

def tokens(cmd):
    return re.findall(r'"(?:\\.|[^"\\])*"|\S+', cmd)

class Node:
    def __init__(s, typ, name, parent): s.type, s.name, s.parent, s.attrs = typ, name, parent, []

def load(path):
    text = open(path, encoding='latin-1').read()
    nodes, conns, cur = [], [], None
    for cmd in commands(text):
        t = tokens(cmd)
        if not t: continue
        if t[0] == 'createNode':
            typ = t[1]; name = parent = None
            for k in range(2, len(t)):
                if t[k] == '-n': name = t[k + 1].strip('"')
                if t[k] == '-p': parent = t[k + 1].strip('"')
            cur = Node(typ, name, parent); nodes.append(cur)
        elif t[0] == 'setAttr' and cur is not None:
            # setAttr [-k ..] [-s N] [-type T] ".attr" values...
            k = 1; typ = None
            while k < len(t) and t[k].startswith('-'):
                if t[k] == '-type': typ = t[k + 1].strip('"')
                k += 2 if t[k] in ('-k', '-s', '-type', '-l', '-cb', '-av', '-ch', '-c') else 1
            if k >= len(t): continue
            rest = t[k + 1:]
            while len(rest) >= 2 and rest[0] == '-type': typ = rest[1].strip('"'); rest = rest[2:]
            cur.attrs.append((t[k].strip('"'), typ, rest))
        elif t[0] == 'connectAttr':
            a = [x.strip('"') for x in t[1:] if not x.startswith('-')]
            if len(a) >= 2: conns.append((a[0], a[1]))
        elif t[0] in ('select', 'rename', 'requires', 'fileInfo', 'currentUnit', 'file', 'relationship', 'lockNode', 'dataStructure'):
            if t[0] == 'select': cur = None
    return nodes, conns

if __name__ == '__main__':
    nodes, conns = load(sys.argv[1])
    print(len(nodes), 'nodes', len(conns), 'connections')
