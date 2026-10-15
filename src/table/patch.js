// Writing the table's parts without rebuilding what has not changed (Build 3.2
// hotfix, the family test 12.10.2026: „mrygają grafiki Pokémonów”, the game
// slows down while a pawn walks).
//
// The table renders its parts after every step of the game. Writing the same
// HTML again rebuilt every element: each Pokémon picture became a new <img>
// that showed its type colours until the browser decoded the picture again —
// the blinking — and the work cost frames. Now:
// - a part is written only when its HTML changed (setHtml);
// - a picture still there after a change (the same src) keeps its element:
//   already decoded, it is moved into the new markup, never shown blank;
// - the board's places are patched one by one (patchKeyed): a place whose
//   markup did not change keeps its elements.
// Presentation only: the game, its rules and its saves never see this.

const written = new WeakMap();

// Keep the decoded <img> elements of `from` for the same pictures in `to`.
function keepPictures(oldImgs, root) {
  if (!oldImgs.size) return;
  for (const img of [...root.querySelectorAll('img[src]')]) {
    const prev = oldImgs.get(img.getAttribute('src'))?.shift();
    if (!prev) continue;
    for (const name of [...prev.getAttributeNames()]) if (!img.hasAttribute(name)) prev.removeAttribute(name);
    for (const name of img.getAttributeNames()) if (prev.getAttribute(name) !== img.getAttribute(name)) prev.setAttribute(name, img.getAttribute(name));
    img.replaceWith(prev);
  }
}

function picturesOf(root) {
  const byUrl = new Map();
  for (const img of root.querySelectorAll('img[src]')) {
    const url = img.getAttribute('src');
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(img);
  }
  return byUrl;
}

// Write `html` into `el` unless it is what is there already. → true when written.
export function setHtml(el, html) {
  if (!el || written.get(el) === html) return false;
  const old = picturesOf(el);
  el.innerHTML = html;
  written.set(el, html);
  keepPictures(old, el);
  return true;
}

// Forget what was written (the next setHtml writes for sure).
export function resetHtml(el) {
  if (el) written.delete(el);
}

// Children of `parent` keyed by `attr` (e.g. data-node): `items` = [{ key, html }]
// in order. A child whose html is unchanged stays as it is; a changed one is
// replaced; when the set of keys changes, everything is written again.
// `wrap(html)` → a container the html is parsed in (SVG children need an <svg>).
export function patchKeyed(parent, items, attr, wrap) {
  const memo = written.get(parent);
  const keys = items.map((i) => i.key).join('|');
  if (!memo || memo.keys !== keys || parent.children.length !== items.length) {
    const box = wrap(items.map((i) => i.html).join(''));
    parent.replaceChildren(...box.childNodes);
    written.set(parent, { keys, html: new Map(items.map((i) => [i.key, i.html])) });
    return items.length;
  }
  let changed = 0;
  items.forEach((item, i) => {
    if (memo.html.get(item.key) === item.html) return;
    const box = wrap(item.html);
    const next = box.firstElementChild;
    if (next) parent.children[i].replaceWith(next);
    memo.html.set(item.key, item.html);
    changed += 1;
  });
  return changed;
}
