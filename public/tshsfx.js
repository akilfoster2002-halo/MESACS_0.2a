/* =====================================================================
   TSH — THE SOUNDS. Which recorded sound effect each cue plays.

   tsh.js's cue(kind) is a shaped tone or a burst of noise made on the spot
   — a placeholder for every kind of sound the night makes. A kind listed
   here plays a recording from public/tsh/sfx/ instead (one of the files at
   random, a touch faster or slower each time, so ten punches are not ten of
   the same punch); a kind not listed, or whose files have not loaded yet,
   keeps its tone. So recordings can arrive a few at a time.

     files: { kind: ['file.mp3', ...] }    vol: { kind: 0..1 } (default 0.8)
   ===================================================================== */
window.TSHSFX = {
  files: {},
  vol: {}
};
