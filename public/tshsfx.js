/* =====================================================================
   TSH — THE SOUNDS. Which recorded sound effect each cue plays.

   tsh.js's cue(kind) is a shaped tone or a burst of noise made on the spot
   — a placeholder for every kind of sound the night makes. A kind listed
   here plays a recording from public/tsh/sfx/ instead (one of the files at
   random, a touch faster or slower each time, so ten punches are not ten of
   the same punch); a kind not listed, or whose files have not loaded yet,
   keeps its tone. So recordings can arrive a few at a time.

     files: { kind: ['file.mp3', ...] }    vol: { kind: 0..1 } (default 0.8)

   The recordings are Kenney's Impact, Sci-fi and Interface sound packs
   (kenney.nl, CC0 — see tsh/sfx/LICENSE-kenney.txt), cut and made mono.
   The suspense (sus, sting, rise) is made in tsh.js's cue(), not recorded.
   ===================================================================== */
window.TSHSFX = {
  files: {
    blast: ['blast-0.mp3', 'blast-1.mp3', 'blast-2.mp3', 'blast-3.mp3'],
    boom: ['boom-0.mp3', 'boom-1.mp3', 'boom-2.mp3', 'boom-3.mp3'],
    clang: ['clang-0.mp3', 'clang-1.mp3', 'clang-2.mp3', 'clang-3.mp3'],
    door: ['door-0.mp3', 'door-1.mp3', 'door-2.mp3', 'door-3.mp3'],
    fail: ['fail-0.mp3', 'fail-1.mp3', 'fail-2.mp3'],
    flash: ['flash-0.mp3', 'flash-1.mp3', 'flash-2.mp3'],
    gear: ['gear-0.mp3', 'gear-1.mp3', 'gear-2.mp3'],
    grab: ['grab-0.mp3', 'grab-1.mp3', 'grab-2.mp3'],
    hangup: ['hangup-0.mp3', 'hangup-1.mp3'],
    hurt: ['hurt-0.mp3', 'hurt-1.mp3', 'hurt-2.mp3', 'hurt-3.mp3'],
    kick: ['kick-0.mp3', 'kick-1.mp3', 'kick-2.mp3', 'kick-3.mp3'],
    launch: ['launch-0.mp3', 'launch-1.mp3'],
    lock: ['lock-0.mp3', 'lock-1.mp3'],
    pick: ['pick-0.mp3', 'pick-1.mp3'],
    punch: ['punch-0.mp3', 'punch-1.mp3', 'punch-2.mp3', 'punch-3.mp3', 'punch-4.mp3'],
    step: ['step-0.mp3', 'step-1.mp3', 'step-2.mp3', 'step-3.mp3', 'step-4.mp3'],
    ui: ['ui-0.mp3', 'ui-1.mp3', 'ui-2.mp3'],
    win: ['win-0.mp3', 'win-1.mp3', 'win-2.mp3']
  },
  vol: { blast:0.9, boom:1.0, clang:0.7, door:0.6, fail:0.5, flash:0.6, gear:0.5, grab:0.5, hangup:0.5, hurt:0.9, kick:0.8, launch:0.6, lock:0.35, pick:0.5, punch:0.9, step:0.35, ui:0.4, win:0.5 }
};
