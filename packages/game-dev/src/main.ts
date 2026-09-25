import { mountHandView } from "@jojixplay/movement-view";
import "./style.css";
const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing development root.");
root.innerHTML = `<header><h1>Hand asset lab</h1><p>Move the pointer to inspect the authored static hands. No camera or app dependency.</p><label><input id="two" type="checkbox"> Both hands</label><label><input id="lost" type="checkbox"> No detection</label></header><main aria-label="Hand asset scene"></main>`;
const stage = root.querySelector("main");
const two = root.querySelector<HTMLInputElement>("#two");
const lost = root.querySelector<HTMLInputElement>("#lost");
if (!stage || !two || !lost) throw new Error("Missing hand lab controls.");
const view = await mountHandView(stage);
let x = innerWidth / 2,
  y = innerHeight / 2;
window.addEventListener("pointermove", (event) => {
  x = event.clientX;
  y = event.clientY;
});
let request = 0;
function render() {
  view.update(
    lost?.checked
      ? []
      : two?.checked
        ? [
            { x: x - 90, y, left: true },
            { x: x + 90, y, left: false },
          ]
        : [{ x, y, left: false }],
  );
  request = requestAnimationFrame(render);
}
render();
window.addEventListener(
  "pagehide",
  () => {
    cancelAnimationFrame(request);
    view.dispose();
  },
  { once: true },
);
