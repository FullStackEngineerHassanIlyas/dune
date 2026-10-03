// Placeholder until phase 3 builds this scene: says so and reports ready, so links and smoke runs do not hang.
export async function start() {
  const note = document.createElement('div');
  note.className = 'fatal';
  note.textContent = 'Campaign missions are not built yet.';
  document.getElementById('ui').appendChild(note);
  window.__dune = { ready: true, scene: 'mission' };
}
