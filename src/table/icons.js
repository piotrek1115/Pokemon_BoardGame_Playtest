// Icons of the family table (Build 2.4): Lucide (lucide-static 0.469.0, ISC licence —
// assets/icons/lucide-LICENSE.txt), one flat line style instead of emoji. Only the shapes
// are kept here (copied from the package SVGs); icon() wraps them in the 24 × 24 frame.
// Another Lucide shape: copy the inside of its <svg> from lucide-static@0.469.0/icons/.
const I = {
  'anchor': '<path d="M12 22V8" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" /><circle cx="12" cy="5" r="3" />',
  'arrow-left-right': '<path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" />',
  'arrow-right': '<path d="M5 12h14" /><path d="m12 5 7 7-7 7" />',
  'backpack': '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M8 10h8" /><path d="M8 18h8" /><path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />',
  'bed': '<path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" />',
  'biceps-flexed': '<path d="M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1" /><path d="M15 14a5 5 0 0 0-7.584 2" /><path d="M9.964 6.825C8.019 7.977 9.5 13 8 15" />',
  'book-open': '<path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />',
  'bug': '<path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />',
  'building-2': '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />',
  'cat': '<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z" /><path d="M8 14v.5" /><path d="M16 14v.5" /><path d="M11.25 16.25h1.5L12 17l-.75-.75Z" />',
  'check': '<path d="M20 6 9 17l-5-5" />',
  'chevron-down': '<path d="m6 9 6 6 6-6" />',
  'chevron-up': '<path d="m18 15-6-6-6 6" />',
  'circle-alert': '<circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />',
  'circle-dot': '<circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" />',
  'circle-help': '<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />',
  'circle-x': '<circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />',
  'circle': '<circle cx="12" cy="12" r="10" />',
  'coins': '<circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" />',
  'compass': '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" /><circle cx="12" cy="12" r="10" />',
  'crown': '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" />',
  'diamond': '<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z" />',
  'dice-1': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M12 12h.01" />',
  'dice-2': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M15 9h.01" /><path d="M9 15h.01" />',
  'dice-3': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M16 8h.01" /><path d="M12 12h.01" /><path d="M8 16h.01" />',
  'dice-4': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M16 8h.01" /><path d="M8 8h.01" /><path d="M8 16h.01" /><path d="M16 16h.01" />',
  'dice-5': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M16 8h.01" /><path d="M8 8h.01" /><path d="M8 16h.01" /><path d="M16 16h.01" /><path d="M12 12h.01" />',
  'dice-6': '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M16 8h.01" /><path d="M16 12h.01" /><path d="M16 16h.01" /><path d="M8 8h.01" /><path d="M8 12h.01" /><path d="M8 16h.01" />',
  'dices': '<rect width="12" height="12" x="2" y="10" rx="2" ry="2" /><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6" /><path d="M6 18h.01" /><path d="M10 14h.01" /><path d="M15 6h.01" /><path d="M18 9h.01" />',
  'door-open': '<path d="M13 4h3a2 2 0 0 1 2 2v14" /><path d="M2 20h3" /><path d="M13 20h9" /><path d="M10 12v.01" /><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" />',
  'droplet': '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />',
  'dumbbell': '<path d="M14.4 14.4 9.6 9.6" /><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" /><path d="m21.5 21.5-1.4-1.4" /><path d="M3.9 3.9 2.5 2.5" /><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />',
  'eye': '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />',
  'fast-forward': '<polygon points="13 19 22 12 13 5 13 19" /><polygon points="2 19 11 12 2 5 2 19" />',
  'feather': '<path d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z" /><path d="M16 8 2 22" /><path d="M17.5 15H9" />',
  'fish': '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" /><path d="M18 12v.5" /><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86" /><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33" /><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4" /><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98" />',
  'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />',
  'flask-conical': '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" /><path d="M6.453 15h11.094" /><path d="M8.5 2h7" />',
  'footprints': '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" /><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" /><path d="M16 17h4" /><path d="M4 13h4" />',
  'gem': '<path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" />',
  'ghost': '<path d="M9 10h.01" /><path d="M15 10h.01" /><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />',
  'gift': '<rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />',
  'hand-heart': '<path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" /><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" /><path d="m2 15 6 6" /><path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z" />',
  'hand': '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" /><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" /><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />',
  'heart-crack': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="m12 13-1-1 2-2-3-3 2-2" />',
  'heart-pulse': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />',
  'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />',
  'hexagon': '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />',
  'hourglass': '<path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />',
  'info': '<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />',
  'landmark': '<line x1="3" x2="21" y1="22" y2="22" /><line x1="6" x2="6" y1="18" y2="11" /><line x1="10" x2="10" y1="18" y2="11" /><line x1="14" x2="14" y1="18" y2="11" /><line x1="18" x2="18" y1="18" y2="11" /><polygon points="12 2 20 7 4 7" />',
  'leaf': '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />',
  'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />',
  'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" />',
  'medal': '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" /><path d="M11 12 5.12 2.2" /><path d="m13 12 5.88-9.8" /><path d="M8 7h8" /><circle cx="12" cy="17" r="5" /><path d="M12 18v-2h-.5" />',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />',
  'mountain': '<path d="m8 3 4 8 5-5 5 15H2L8 3z" />',
  'package': '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /><path d="M12 22V12" /><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" /><path d="m7.5 4.27 9 5.15" />',
  'pause': '<rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" />',
  'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />',
  'play': '<polygon points="6 3 20 12 6 21 6 3" />',
  'plus': '<path d="M5 12h14" /><path d="M12 5v14" />',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />',
  'ribbon': '<path d="M12 11.22C11 9.997 10 9 10 8a2 2 0 0 1 4 0c0 1-.998 2.002-2.01 3.22" /><path d="m12 18 2.57-3.5" /><path d="M6.243 9.016a7 7 0 0 1 11.507-.009" /><path d="M9.35 14.53 12 11.22" /><path d="M9.35 14.53C7.728 12.246 6 10.221 6 7a6 5 0 0 1 12 0c-.005 3.22-1.778 5.235-3.43 7.5l3.557 4.527a1 1 0 0 1-.203 1.43l-1.894 1.36a1 1 0 0 1-1.384-.215L12 18l-2.679 3.593a1 1 0 0 1-1.39.213l-1.865-1.353a1 1 0 0 1-.203-1.422z" />',
  'rocket': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />',
  'scroll': '<path d="M19 17V5a2 2 0 0 0-2-2H4" /><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />',
  'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />',
  'ship': '<path d="M12 10.189V14" /><path d="M12 2v3" /><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" /><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76" /><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />',
  'skip-forward': '<polygon points="5 4 15 12 5 20 5 4" /><line x1="19" x2="19" y1="5" y2="19" />',
  'skull': '<path d="m12.5 17-.5-1-.5 1h1z" /><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="12" r="1" />',
  'snowflake': '<path d="m10 20-1.25-2.5L6 18" /><path d="M10 4 8.75 6.5 6 6" /><path d="m14 20 1.25-2.5L18 18" /><path d="m14 4 1.25 2.5L18 6" /><path d="m17 21-3-6h-4" /><path d="m17 3-3 6 1.5 3" /><path d="M2 12h6.5L10 9" /><path d="m20 10-1.5 2 1.5 2" /><path d="M22 12h-6.5L14 15" /><path d="m4 10 1.5 2L4 14" /><path d="m7 21 3-6-1.5-3" /><path d="m7 3 3 6h4" />',
  'sparkles': '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" />',
  'sprout': '<path d="M7 20h10" /><path d="M10 20c5.5-2.5.8-6.4 3-10" /><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />',
  'square': '<rect width="18" height="18" x="3" y="3" rx="2" />',
  'star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />',
  'store': '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />',
  'swords': '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" x2="19" y1="19" y2="13" /><line x1="16" x2="20" y1="16" y2="20" /><line x1="19" x2="21" y1="21" y2="19" /><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" /><line x1="5" x2="9" y1="14" y2="18" /><line x1="7" x2="4" y1="17" y2="20" /><line x1="3" x2="5" y1="19" y2="21" />',
  'target': '<circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />',
  'tent': '<path d="M3.5 21 14 3" /><path d="M20.5 21 10 3" /><path d="M15.5 21 12 15l-3.5 6" /><path d="M2 21h20" />',
  'tornado': '<path d="M21 4H3" /><path d="M18 8H6" /><path d="M19 12H9" /><path d="M16 16h-6" /><path d="M11 20H9" />',
  'tree-palm': '<path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4" /><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3" /><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35" /><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14" />',
  'trees': '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" /><path d="M7 16v6" /><path d="M13 19v3" /><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" />',
  'trophy': '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />',
  'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />',
  'waves': '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />',
  'wind': '<path d="M12.8 19.6A2 2 0 1 0 14 16H2" /><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" /><path d="M9.8 4.4A2 2 0 1 1 11 8H2" />',
  'x': '<path d="M18 6 6 18" /><path d="m6 6 12 12" />',
  'zap': '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />',
};

export const ICON_NAMES = Object.keys(I);

// icon('coins') → an inline SVG, sized by the text (1em) unless `size` says otherwise.
// `fill`: a filled shape (a full heart, a star); `cls`: extra classes; `title`: a tooltip.
// A missing icon never breaks a screen: it draws a plain „?” and says so once in the console.
const warned = new Set();
const missing = (what) => {
  if (!warned.has(what)) console.warn(`Missing icon: ${what}`);
  warned.add(what);
};
export function icon(name, { size = null, fill = false, cls = '', title = '' } = {}) {
  const shape = I[name] ?? (missing(name), I['circle-help']);
  const wh = size ? ` width="${size}" height="${size}"` : '';
  return `<svg class="ic ic-${name}${fill ? ' ic-fill' : ''}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24"${wh} fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${title ? `<title>${title}</title>` : ''}${shape}</svg>`;
}

// The two balls are the game's own drawings (not Lucide).
export function pokeballSvg(size = 34) {
  return `<svg class="pokeball" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="#fff" stroke="#222" stroke-width="3"/>
    <path d="M2 20a18 18 0 0 1 36 0z" fill="#e3350d" stroke="#222" stroke-width="3"/>
    <line x1="2" y1="20" x2="38" y2="20" stroke="#222" stroke-width="3"/>
    <circle cx="20" cy="20" r="6" fill="#fff" stroke="#222" stroke-width="3"/></svg>`;
}
export function superballSvg(size = 44) {
  return `<svg class="pokeball super" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="#fff" stroke="#222" stroke-width="3"/>
    <path d="M2 20a18 18 0 0 1 36 0z" fill="#2f6fe0" stroke="#222" stroke-width="3"/>
    <path d="M9 9l6 5M31 9l-6 5" stroke="#e3350d" stroke-width="4" stroke-linecap="round"/>
    <line x1="2" y1="20" x2="38" y2="20" stroke="#222" stroke-width="3"/>
    <circle cx="20" cy="20" r="6" fill="#fff" stroke="#222" stroke-width="3"/></svg>`;
}
const BALLS = { pokeball: pokeballSvg, superball: superballSvg };

// ---- Every icon of the game, by what it means ----------------------------------------------
// key → the shape drawn now (a Lucide name, `ball:` one of the two balls, `swatch:` a die
// colour), `fill`, the emoji it replaced (`was`) and what it means (`pl`).
// An own graphic later: put the file in assets/icons/game/ and give the entry
// `src: 'assets/icons/game/<file>.svg'` — every place that draws the key changes at once.
// docs/ICONS.md lists them all (node tools/icon-list.mjs), tools/icon-sheet.html shows them.
export const GAME_ICON_GROUPS = [
  { title: 'Typy Pokémonów', keys: ['type.normal', 'type.fire', 'type.water', 'type.electric', 'type.grass', 'type.ice', 'type.fighting', 'type.poison', 'type.ground', 'type.flying', 'type.psychic', 'type.bug', 'type.rock', 'type.ghost', 'type.dragon'] },
  { title: 'Pieniądze, gwiazdki i przedmioty', keys: ['money', 'star', 'star.empty', 'item.pokeball', 'item.superball', 'item.potion', 'item.revive', 'stone.thunder', 'stone.water', 'stone.fire', 'stone.leaf', 'stone.moon', 'badge', 'reserve', 'gift'] },
  { title: 'Walka', keys: ['hp', 'hp.empty', 'attack', 'defense', 'hit', 'miss', 'turn', 'switch', 'bag', 'run', 'throw', 'fainted', 'strong'] },
  { title: 'Ewolucja', keys: ['evolve', 'lock', 'done', 'next', 'rarity'] },
  { title: 'Akcje i przyciski', keys: ['explore', 'rest', 'end-turn', 'skip', 'swap', 'leave', 'pause', 'roll', 'edit', 'close', 'alert', 'healed', 'dice.auto', 'dice.tap', 'dice.physical'] },
  { title: 'Miejsca', keys: ['pokestop', 'gym', 'league', 'here', 'target', 'travel.water'] },
  { title: 'Tereny eksploracji', keys: ['biome.grass', 'biome.forest', 'biome.water', 'biome.sea', 'biome.beach', 'biome.cave', 'biome.haunted', 'biome.city', 'biome.air'] },
  { title: 'Team Rocket', keys: ['rocket', 'meowth', 'pit'] },
  { title: 'Tytuły i trenerzy', keys: ['ribbon', 'champion', 'pokedex', 'missions', 'team', 'settings', 'trainer', 'dex.unknown', 'dex.seen', 'dex.caught', 'dex.evolved'] },
  { title: 'Kostki', keys: ['die.1', 'die.2', 'die.3', 'die.4', 'die.5', 'die.6', 'die.blue', 'die.purple', 'die.magenta', 'die.red', 'die.yellow', 'die.green', 'wind'] },
];
export const GAME_ICONS = {
  'type.normal': { shape: 'circle', was: '⚪', pl: 'typ Normalny' },
  'type.fire': { shape: 'flame', was: '🔥', pl: 'typ Ognisty' },
  'type.water': { shape: 'droplet', was: '💧', pl: 'typ Wodny' },
  'type.electric': { shape: 'zap', was: '⚡', pl: 'typ Elektryczny' },
  'type.grass': { shape: 'leaf', was: '🍃', pl: 'typ Trawiasty' },
  'type.ice': { shape: 'snowflake', was: '❄️', pl: 'typ Lodowy' },
  'type.fighting': { shape: 'biceps-flexed', was: '👊', pl: 'typ Walczący' },
  'type.poison': { shape: 'skull', was: '☠️', pl: 'typ Trujący' },
  'type.ground': { shape: 'mountain', was: '⛰️', pl: 'typ Ziemny' },
  'type.flying': { shape: 'feather', was: '🪶', pl: 'typ Latający' },
  'type.psychic': { shape: 'eye', was: '🔮', pl: 'typ Psychiczny' },
  'type.bug': { shape: 'bug', was: '🐛', pl: 'typ Robaczy' },
  'type.rock': { shape: 'hexagon', was: '🪨', pl: 'typ Skalny' },
  'type.ghost': { shape: 'ghost', was: '👻', pl: 'typ Duch' },
  'type.dragon': { shape: 'tornado', was: '🐉', pl: 'typ Smoczy' },
  'money': { shape: 'coins', was: '💰', pl: 'pieniądze (monety)' },
  'star': { shape: 'star', fill: true, was: '⭐ ★', pl: 'gwiazdka: punkt treningu, gwiazdki ewolucji, forma ostateczna' },
  'star.empty': { shape: 'star', was: '☆', pl: 'pusta gwiazdka (poziom trudności trenera)' },
  'item.pokeball': { shape: 'ball:pokeball', was: '🔴', pl: 'Poké Ball (już własna grafika)' },
  'item.superball': { shape: 'ball:superball', was: '🔵', pl: 'Super Ball (już własna grafika)' },
  'item.potion': { shape: 'flask-conical', was: '🧪', pl: 'Potion' },
  'item.revive': { shape: 'heart-pulse', was: '✨', pl: 'Revive' },
  'stone.thunder': { shape: 'zap', was: '⚡', pl: 'Thunder Stone' },
  'stone.water': { shape: 'droplet', was: '💧', pl: 'Water Stone' },
  'stone.fire': { shape: 'flame', was: '🔥', pl: 'Fire Stone' },
  'stone.leaf': { shape: 'leaf', was: '🍃', pl: 'Leaf Stone' },
  'stone.moon': { shape: 'moon', was: '🌙', pl: 'Moon Stone' },
  'badge': { shape: 'medal', was: '🏅', pl: 'odznaka sali' },
  'reserve': { shape: 'package', was: '📦', pl: 'rezerwa Pokémonów' },
  'gift': { shape: 'gift', was: '🎁', pl: 'nagroda (zapas)' },
  'hp': { shape: 'heart', fill: true, was: '♥ ❤', pl: 'serduszko życia (pełne)' },
  'hp.empty': { shape: 'heart', was: '♡', pl: 'serduszko życia (puste)' },
  'attack': { shape: 'swords', was: '⚔️ ⚔', pl: 'atak' },
  'defense': { shape: 'shield', was: '🛡', pl: 'atak przeciwnika / słabe tu' },
  'hit': { shape: 'heart-crack', was: '💥', pl: 'trafienie (zabrane serduszka)' },
  'miss': { shape: 'wind', was: '💨', pl: 'pudło' },
  'turn': { shape: 'play', fill: true, was: '▶', pl: 'znacznik „RUCH” na karcie, „Dalej”' },
  'switch': { shape: 'arrow-left-right', was: '🔄', pl: 'zmiana Pokémona' },
  'bag': { shape: 'backpack', was: '🎒', pl: 'przedmiot / plecak' },
  'run': { shape: 'footprints', was: '🏃', pl: 'ucieczka / wycofanie' },
  'throw': { shape: 'target', was: '🎯', pl: 'rzut Poké Ballem' },
  'fainted': { shape: 'circle-alert', was: '😵', pl: 'drużyna zemdlała' },
  'strong': { shape: 'biceps-flexed', was: '💪', pl: 'silne tu (sala)' },
  'evolve': { shape: 'sparkles', was: '✨', pl: 'ewolucja / GOTOWY' },
  'lock': { shape: 'lock', was: '🔒', pl: 'następna forma zablokowana' },
  'done': { shape: 'check', was: '✓', pl: 'zrobione / masz już' },
  'next': { shape: 'arrow-right', was: '➜ →', pl: 'strzałka: następna forma, kierunek' },
  'rarity': { shape: 'gem', was: '◆', pl: 'rzadkość (1–3 kamyki)' },
  'explore': { shape: 'compass', was: '🌿', pl: 'Eksploruj' },
  'rest': { shape: 'bed', was: '💤', pl: 'Odpocznij' },
  'end-turn': { shape: 'skip-forward', was: '⏭', pl: 'Koniec tury' },
  'skip': { shape: 'fast-forward', was: '⏩', pl: 'Pomiń animację' },
  'swap': { shape: 'refresh-cw', was: '🔄 ↻', pl: 'wymień misję / przerzut' },
  'leave': { shape: 'door-open', was: '🚪', pl: 'wyjdź z Poké Stopu' },
  'pause': { shape: 'pause', was: '⏸', pl: 'przerwa w Lidze' },
  'roll': { shape: 'dices', was: '🎲', pl: 'rzut kością' },
  'edit': { shape: 'pencil', was: '✏️', pl: 'popraw kadr' },
  'close': { shape: 'x', was: '✕', pl: 'zamknij' },
  'alert': { shape: 'circle-alert', was: '❗', pl: 'wydarzenie' },
  'healed': { shape: 'hand-heart', was: '💖', pl: 'drużyna wyleczona' },
  'dice.auto': { shape: 'zap', was: '⚡', pl: 'kości: pełny automat' },
  'dice.tap': { shape: 'dices', was: '🎲', pl: 'kości: kliknij rzut' },
  'dice.physical': { shape: 'hand', was: '✋', pl: 'kości: fizyczne' },
  'pokestop': { shape: 'store', was: '🏪', pl: 'Poké Stop' },
  'gym': { shape: 'landmark', was: '🏟️', pl: 'Sala' },
  'league': { shape: 'trophy', was: '🏆', pl: 'Liga' },
  'here': { shape: 'map-pin', was: '📍', pl: 'gdzie jesteś' },
  'target': { shape: 'target', was: '🎯', pl: 'cel misji na mapie / „Dokąd”' },
  'travel.water': { shape: 'ship', was: '🌊', pl: 'pływanie (droga wodna)' },
  'biome.grass': { shape: 'sprout', was: '🌿', pl: 'trawa' },
  'biome.forest': { shape: 'trees', was: '🌲', pl: 'las' },
  'biome.water': { shape: 'droplet', was: '💧', pl: 'woda / jezioro' },
  'biome.sea': { shape: 'waves', was: '🌊', pl: 'morze' },
  'biome.beach': { shape: 'tree-palm', was: '🏖️', pl: 'plaża' },
  'biome.cave': { shape: 'mountain', was: '🪨', pl: 'jaskinia' },
  'biome.haunted': { shape: 'ghost', was: '👻', pl: 'nawiedzone' },
  'biome.city': { shape: 'building-2', was: '🏙️', pl: 'miasto' },
  'biome.air': { shape: 'feather', was: '🪶', pl: 'powietrze' },
  'rocket': { shape: 'rocket', was: '🎈 + ikona każdego spisku', pl: 'Team Rocket (balon, spisek)' },
  'meowth': { shape: 'cat', was: '😼', pl: 'Meowth' },
  'pit': { shape: 'circle-dot', was: '🕳', pl: 'dół Team Rocket' },
  'ribbon': { shape: 'ribbon', was: '🎀', pl: 'Wstęga Elitarnej Czwórki' },
  'champion': { shape: 'crown', was: '👑', pl: 'Mistrz Ligi' },
  'pokedex': { shape: 'book-open', was: '📕', pl: 'Pokédex' },
  'missions': { shape: 'scroll', was: '📜', pl: 'misje' },
  'team': { shape: 'users', was: '👥', pl: 'drużyna' },
  'settings': { shape: 'settings', was: '⚙️', pl: 'ustawienia' },
  'trainer': { shape: 'user', was: '🐛 🧢 🎀 🥾 🎣 ⚓ ⛺ 🧺 🔬 🔮 🕯️ 🏍️ 🪶 🏊', pl: 'trener bez portretu (zamiast ikony klasy)' },
  'dex.unknown': { shape: 'circle-help', was: '❔', pl: 'Pokédex: jeszcze nie spotkany' },
  'dex.seen': { shape: 'eye', was: '👁️', pl: 'Pokédex: widziany' },
  'dex.caught': { shape: 'ball:pokeball', was: '🔴', pl: 'Pokédex: złapany' },
  'dex.evolved': { shape: 'sparkles', was: '✨', pl: 'Pokédex: zdobyty przez ewolucję' },
  'die.1': { shape: 'dice-1', was: '⚀', pl: 'ściana k6: 1' },
  'die.2': { shape: 'dice-2', was: '⚁', pl: 'ściana k6: 2' },
  'die.3': { shape: 'dice-3', was: '⚂', pl: 'ściana k6: 3' },
  'die.4': { shape: 'dice-4', was: '⚃', pl: 'ściana k6: 4' },
  'die.5': { shape: 'dice-5', was: '⚄', pl: 'ściana k6: 5' },
  'die.6': { shape: 'dice-6', was: '⚅', pl: 'ściana k6: 6' },
  'die.blue': { shape: 'swatch:blue', was: '🔵', pl: 'kostka łapania: niebieska' },
  'die.purple': { shape: 'swatch:purple', was: '🟣', pl: 'kostka łapania: fioletowa' },
  'die.magenta': { shape: 'swatch:magenta', was: '🩷', pl: 'kostka łapania: magenta' },
  'die.red': { shape: 'swatch:red', was: '🔴', pl: 'kostka ucieczki: czerwona' },
  'die.yellow': { shape: 'swatch:yellow', was: '🟡', pl: 'kostka ucieczki: żółta' },
  'die.green': { shape: 'swatch:green', was: '🟢', pl: 'kostka ucieczki: zielona' },
  'wind': { shape: 'wind', was: '🌬️', pl: 'wiatr na kostce ucieczki' },
};

const slug = (key) => key.replace(/\./g, '-');

// gi('money') → the game's icon for that meaning (svg, or <img> once it has an own graphic).
export function gi(key, { size = null, cls = '', title = '' } = {}) {
  const g = GAME_ICONS[key] ?? (missing(key), { shape: 'circle-help' });
  const classes = `gi gi-${slug(key)}${cls ? ` ${cls}` : ''}`;
  if (g.src) return `<img class="ic ${classes}" src="${g.src}" alt=""${size ? ` width="${size}" height="${size}"` : ''} draggable="false">`;
  const [kind, arg] = g.shape.split(':');
  if (kind === 'ball') return BALLS[arg](size ?? 18).replace('class="pokeball', `class="ic ${classes} pokeball`);
  if (kind === 'swatch') return `<i class="ic swatch c-${arg} ${classes}" aria-hidden="true"></i>`;
  return icon(g.shape, { size, fill: g.fill, cls: classes, title });
}

// A type as a small coloured badge with its icon (like the type marks in Pokémon GO).
export function typeIcon(type, opts = {}) {
  return `<span class="type-ic t-${type}">${gi(GAME_ICONS[`type.${type}`] ? `type.${type}` : 'type.normal', opts)}</span>`;
}

// Items and stones by their game id.
const ITEM_KEY = {
  pokeball: 'item.pokeball', pokeballs: 'item.pokeball', superball: 'item.superball', potion: 'item.potion', revive: 'item.revive',
  money: 'money', stars: 'star', thunderstone: 'stone.thunder', waterstone: 'stone.water', firestone: 'stone.fire',
  leafstone: 'stone.leaf', moonstone: 'stone.moon',
};
export const itemIconKey = (id) => ITEM_KEY[id] ?? 'gift';

// The UI strings mark their icons with the emoji of the meaning ('🌿 Eksploruj', '+1 💰');
// iconText turns them into the game's icons when a screen is drawn. Text only — tags and
// their attributes stay as they are. Symbols that mean several things (💧 type / stone /
// terrain, 🔴 ball / die) are never written as emoji: their places call gi() directly.
const TEXT_ICONS = {
  '💰': 'money', '⭐': 'star', '★': 'star', '☆': 'star.empty', '❤️': 'hp', '❤': 'hp', '♥': 'hp', '♡': 'hp.empty',
  '✨': 'evolve', '🏃': 'run', '👑': 'champion', '🎀': 'ribbon', '😼': 'meowth', '🧪': 'item.potion', '💥': 'hit',
  '💨': 'miss', '❗': 'alert', '🎈': 'rocket', '🔄': 'switch', '➜': 'next', '→': 'next', '🏅': 'badge', '🎲': 'roll',
  '🌊': 'travel.water', '🔒': 'lock', '✓': 'done', '▶': 'turn', '⏩': 'skip', '📍': 'here', '🌿': 'explore',
  '💤': 'rest', '🏪': 'pokestop', '🏟️': 'gym', '🏟': 'gym', '🏆': 'league', '⏭': 'end-turn', '📕': 'pokedex',
  '⚙️': 'settings', '😵': 'fainted', '👥': 'team', '🎒': 'bag', '📜': 'missions', '📦': 'reserve', '🎯': 'target',
  '🚪': 'leave', '⏸': 'pause', '💖': 'healed', '🛡️': 'defense', '🛡': 'defense', '💪': 'strong', '⚔️': 'attack',
  '⚔': 'attack', '✏️': 'edit', '✕': 'close', '🕳️': 'pit', '🕳': 'pit', '↻': 'swap', '◆': 'rarity', '🌬️': 'wind',
  '⚡': 'dice.auto', '✋': 'dice.physical', '🎁': 'gift', '💎': 'item.revive', '👁️': 'dex.seen',
  '⚀': 'die.1', '⚁': 'die.2', '⚂': 'die.3', '⚃': 'die.4', '⚄': 'die.5', '⚅': 'die.6',
};
// (none of the symbols is a regex character)
const TEXT_RE = new RegExp(Object.keys(TEXT_ICONS).sort((a, b) => b.length - a.length).join('|'), 'gu');
export function iconText(html) {
  return String(html).split(/(<[^>]*>)/).map((part, i) => (i % 2 ? part : part.replace(TEXT_RE, (m) => gi(TEXT_ICONS[m])))).join('');
}
export const TEXT_ICON_KEYS = TEXT_ICONS;
