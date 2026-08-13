import { render } from "preact";
import { App } from "./app";
import "./styles.css";

const root = document.getElementById("app");
if (root === null) {
  throw new Error("Application root is missing.");
}

render(<App />, root);
