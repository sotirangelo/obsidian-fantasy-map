export type Dispose = () => void;

export class Disposables {
  private list: Dispose[] = [];

  add(dispose: Dispose): void {
    this.list.push(dispose);
  }

  disposeAll(): void {
    for (const d of this.list) d();
    this.list = [];
  }
}
