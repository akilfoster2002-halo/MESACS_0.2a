/* Passwords and sessions with nothing but node's own crypto.
   scrypt for hashing, an HMAC-signed cookie for the session. */
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DAY = 24*60*60*1000;

function hash(password, salt){
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function makeHash(password){
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, pass_hash: hash(password, salt) };
}
function verify(password, salt, expected){
  const got = Buffer.from(hash(password, salt), 'hex');
  const want = Buffer.from(expected, 'hex');
  return got.length===want.length && crypto.timingSafeEqual(got, want);
}
function sign(payload){
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac  = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body+'.'+mac;
}
function read(token){
  if(!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const want = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if(mac.length!==want.length) return null;
  if(!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try{
    const p = JSON.parse(Buffer.from(body,'base64url').toString());
    if(p.exp && Date.now() > p.exp) return null;
    return p;
  }catch(e){ return null; }
}
function setCookie(res, payload){
  const token = sign({ ...payload, exp: Date.now()+30*DAY });
  res.setHeader('Set-Cookie',
    `mq=${token}; HttpOnly; Path=/; Max-Age=${30*24*60*60}; SameSite=Lax` +
    (process.env.NODE_ENV==='production' ? '; Secure' : ''));
}
function clearCookie(res){
  res.setHeader('Set-Cookie','mq=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}
function fromReq(req){
  const raw = req.headers.cookie || '';
  const m = raw.split(';').map(s=>s.trim()).find(s=>s.startsWith('mq='));
  return m ? read(m.slice(3)) : null;
}
module.exports = { makeHash, verify, setCookie, clearCookie, fromReq, sign, read };
