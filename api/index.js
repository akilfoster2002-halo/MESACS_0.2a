/* =====================================================================
   THE SAME SERVER, AS A FUNCTION.

   Vercel has no long-running process to give this app. It hands each
   request to a function, which lives for the length of that request and
   then goes. So there is nothing here but the Express app out of
   server/index.js: same routes, same handlers, same everything, minus
   the part that takes a port.

   WHAT DOES NOT SURVIVE THE TRIP, and cannot be made to: the WebSocket
   at /ws. Rooms, seeing anybody else move, shared objects, the chat, the
   teacher's mute and clear, and the Mech League all ride on one socket
   held open for as long as somebody is standing in a room. A function
   that exists for one request has nowhere to hold it. The game itself —
   every mission, the ring, Pong, the editor, the tutor, sign-in and the
   arcade — is request-shaped and works.

   THE STATIC HALF NEVER REACHES HERE. public/** is served straight off
   Vercel's CDN, which is what it should have been all along: 36MB of
   models and audio does not want to come out of a Node process. Express
   still has its own express.static for `npm start`, and on Vercel it
   simply never matches, because those requests are answered before the
   function is woken up.
   ===================================================================== */
module.exports = require('../server/index.js').app;
