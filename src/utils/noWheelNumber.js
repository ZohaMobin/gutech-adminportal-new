// Scrolling the page over a focused number box must never change the number: that is how a mark gets altered by accident.
// The box is released (blurred) so the page scrolls as usual, and the value stays as typed. Arrow keys still step it.
export const releaseNumberOnWheel = (event) => {
  const el = event.target;
  if (el && el.tagName === 'INPUT' && el.type === 'number' && el === document.activeElement) el.blur();
};

export const installNoWheelNumbers = () => {
  document.addEventListener('wheel', releaseNumberOnWheel, { passive: true });
  return () => document.removeEventListener('wheel', releaseNumberOnWheel);
};
