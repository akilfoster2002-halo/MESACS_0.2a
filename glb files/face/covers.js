/* each garment's `covers` (one bit per body vertex) grown to the body's new count: the vertices added at the mouth
   are appended at the end, and nothing covers a mouth */
const fs = require('fs'), N = +process.argv[2];
for(const f of process.argv.slice(3)){
  const b = fs.readFileSync(f), len = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + len));
  let n = 0;
  for(const node of j.nodes) if(node.extras && node.extras.covers){
    const old = Buffer.from(node.extras.covers, 'base64'), out = Buffer.alloc(Math.ceil(N/8)); old.copy(out, 0, 0, Math.min(old.length, out.length));
    // clear any bits past the old count (padding in its last byte)
    const was = node.extras.coversOf; for(let i = was; i < Math.min(N, old.length*8); i++) out[i >> 3] &= ~(1 << (i & 7));
    node.extras.covers = out.toString('base64'); node.extras.coversOf = N; n++; }
  let js = Buffer.from(JSON.stringify(j)); const pad = (4 - js.length % 4) % 4; js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const rest = b.slice(20 + len), head = Buffer.alloc(20); b.copy(head, 0, 0, 20);
  head.writeUInt32LE(20 + js.length + rest.length, 8); head.writeUInt32LE(js.length, 12);
  fs.writeFileSync(f, Buffer.concat([head, js, rest])); console.log(f, n, 'garment nodes');
}
