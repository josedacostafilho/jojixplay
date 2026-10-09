import type { Figures } from "./figures";

const SVG = "http://www.w3.org/2000/svg";

/** Keeps `count` elements of one tag in `group`, creating and removing only the difference. */
function resize<E extends SVGElement>(group: SVGGElement, tag: string, count: number): E[] {
  while (group.childElementCount > count) group.lastElementChild?.remove();
  while (group.childElementCount < count) group.append(document.createElementNS(SVG, tag));
  return Array.from(group.children) as E[];
}

/** Draws sensed figures over the whole viewport, where the host's camera image also is. */
export function createOverlay(parent: HTMLElement) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "sense-overlay");
  svg.setAttribute("aria-hidden", "true");
  const groups = ["segments", "dots", "labels"].map((name) => {
    const group = document.createElementNS(SVG, "g");
    group.setAttribute("class", `sense-${name}`);
    svg.append(group);
    return group;
  }) as [SVGGElement, SVGGElement, SVGGElement];
  parent.append(svg);

  return {
    draw({ segments, dots, labels }: Figures) {
      resize<SVGLineElement>(groups[0], "line", segments.length).forEach((line, index) => {
        const segment = segments[index];
        if (!segment) return;
        line.setAttribute("x1", segment.x1.toFixed(1));
        line.setAttribute("y1", segment.y1.toFixed(1));
        line.setAttribute("x2", segment.x2.toFixed(1));
        line.setAttribute("y2", segment.y2.toFixed(1));
        line.dataset.side = segment.side;
      });
      resize<SVGCircleElement>(groups[1], "circle", dots.length).forEach((circle, index) => {
        const dot = dots[index];
        if (!dot) return;
        circle.setAttribute("cx", dot.x.toFixed(1));
        circle.setAttribute("cy", dot.y.toFixed(1));
        circle.dataset.side = dot.side;
      });
      resize<SVGTextElement>(groups[2], "text", labels.length).forEach((text, index) => {
        const label = labels[index];
        if (!label) return;
        text.setAttribute("x", label.x.toFixed(1));
        text.setAttribute("y", label.y.toFixed(1));
        text.dataset.side = label.side;
        text.textContent = label.text;
      });
    },
    dispose() {
      svg.remove();
    },
  };
}
