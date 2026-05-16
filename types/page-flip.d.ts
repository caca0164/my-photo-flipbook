declare module "page-flip" {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>);
    loadFromImages(images: string[]): void;
    loadFromHTML(items: HTMLElement[] | NodeListOf<HTMLElement>): void;
    updateFromImages(images: string[]): void;
    destroy(): void;
  }
}
