declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.svelte" {
  import type { Component } from "svelte";
  const component: Component<Record<string, unknown>>;
  export default component;
}
