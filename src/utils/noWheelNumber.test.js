import { installNoWheelNumbers } from './noWheelNumber';

let remove;
beforeEach(() => { remove = installNoWheelNumbers(); document.body.innerHTML = '<input id="n" type="number" value="7"><input id="t" type="text" value="x">'; });
afterEach(() => { remove(); });

const wheel = (el) => el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }));

test('scrolling over a focused number box releases it, so the value cannot be changed by the wheel', () => {
  const box = document.getElementById('n');
  box.focus();
  expect(document.activeElement).toBe(box);
  wheel(box);
  expect(document.activeElement).not.toBe(box);
  expect(box.value).toBe('7');
});

test('other boxes are left alone', () => {
  const text = document.getElementById('t');
  text.focus();
  wheel(text);
  expect(document.activeElement).toBe(text);
});
