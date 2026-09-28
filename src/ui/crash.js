// Error screen shown when a frame throws (spec §9): the message, a hint to the console, and a reload button.
export function showCrash(err) {
  console.error(err);
  const div = document.createElement('div');
  div.className = 'fatal';
  div.innerHTML = '<div><h2>Something went wrong</h2><p class="msg"></p><p>Details are in the browser console.</p><button>Reload</button></div>';
  div.querySelector('.msg').textContent = err?.message ?? String(err);
  div.querySelector('button').addEventListener('click', () => location.reload());
  document.getElementById('ui').appendChild(div);
}
