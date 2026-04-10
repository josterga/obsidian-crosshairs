import { Plugin } from "obsidian";

export default class BlockCursorPlugin extends Plugin {
  private overlay: HTMLDivElement | null = null;
  private mouseOverlay: HTMLDivElement | null = null;
  private observer: MutationObserver | null = null;
  private intervalId: number | null = null;
  private canvas: HTMLCanvasElement = document.createElement("canvas");

  // rAF throttle for mousemove
  private mouseMoveScheduled = false;
  private mouseX = 0;
  private mouseY = 0;

  // Persistent mouse crosshair line elements
  private mouseTop: HTMLDivElement | null = null;
  private mouseBottom: HTMLDivElement | null = null;
  private mouseLeft: HTMLDivElement | null = null;
  private mouseRight: HTMLDivElement | null = null;

  // Bound handlers (stored so they can be removed)
  private onMouseMove = (e: MouseEvent) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (!this.mouseMoveScheduled) {
      this.mouseMoveScheduled = true;
      requestAnimationFrame(() => {
        this.updateMouseCrosshair();
        this.mouseMoveScheduled = false;
      });
    }
  };
  private onMouseLeave = () => {
    [this.mouseTop, this.mouseBottom, this.mouseLeft, this.mouseRight].forEach(
      (el) => { if (el) el.style.display = "none"; }
    );
  };
  private onMouseResize = () => { this.updateMouseCrosshair(); };
  private onSelectionChange = () => { this.updateOverlay(); };
  private onClickInEditor = (e: MouseEvent) => {
    if ((e.target as Element).closest(".cm-editor")) {
      setTimeout(() => this.updateOverlay(), 10);
    }
  };
  private onKeyUp = () => { this.updateOverlay(); };
  private onKeyDown = () => { this.updateOverlay(); };
  private onCursorResize = () => { this.updateOverlay(); };
  private onScroll = () => { this.updateOverlay(); };

  async onload() {
    this.addCursorOverlay();
    this.addMouseOverlay();
    this.observeCursorMovement();
    this.observeMouseMovement();
  }

  onunload() {
    this.removeCursorOverlay();
    this.removeMouseOverlay();

    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseleave", this.onMouseLeave);
    window.removeEventListener("resize", this.onMouseResize);
    document.removeEventListener("selectionchange", this.onSelectionChange);
    document.removeEventListener("click", this.onClickInEditor);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("resize", this.onCursorResize);
    window.removeEventListener("scroll", this.onScroll, true);

    this.observer?.disconnect();
    this.observer = null;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  addCursorOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "block-cursor-overlay";
    document.body.appendChild(this.overlay);
  }

  addMouseOverlay() {
    this.mouseOverlay = document.createElement("div");
    this.mouseOverlay.id = "mouse-cursor-overlay";
    document.body.appendChild(this.mouseOverlay);

    // Create 4 persistent crosshair line elements (reused every frame)
    const makeMouseLine = (name: string): HTMLDivElement => {
      const el = document.createElement("div");
      el.className = `mouse-ext mouse-ext-${name}`;
      el.style.display = "none";
      this.mouseOverlay!.appendChild(el);
      return el;
    };
    this.mouseTop    = makeMouseLine("top");
    this.mouseBottom = makeMouseLine("bottom");
    this.mouseLeft   = makeMouseLine("left");
    this.mouseRight  = makeMouseLine("right");
  }

  removeCursorOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  removeMouseOverlay() {
    if (this.mouseOverlay) {
      this.mouseOverlay.remove();
      this.mouseOverlay = null;
    }
    this.mouseTop = this.mouseBottom = this.mouseLeft = this.mouseRight = null;
  }

  private updateMouseCrosshair() {
    if (!this.mouseOverlay) return;

    const elementUnderMouse = document.elementFromPoint(this.mouseX, this.mouseY);
    const isOverInteractive = elementUnderMouse && (
      elementUnderMouse.closest("button") ||
      elementUnderMouse.closest("input") ||
      elementUnderMouse.closest("select") ||
      elementUnderMouse.closest("textarea") ||
      elementUnderMouse.closest(".clickable-icon") ||
      elementUnderMouse.closest(".nav-file-title") ||
      elementUnderMouse.closest(".workspace-tab-header") ||
      elementUnderMouse.closest(".menu-item")
    );

    if (isOverInteractive) {
      [this.mouseTop, this.mouseBottom, this.mouseLeft, this.mouseRight].forEach(
        (el) => { if (el) el.style.display = "none"; }
      );
      return;
    }

    const mx = this.mouseX;
    const my = this.mouseY;
    const w = window.innerWidth;
    const h = window.innerHeight;

    const dirs = [
      { el: this.mouseTop,    x: mx - 1, y: 0,      width: 2,      height: my },
      { el: this.mouseBottom, x: mx - 1, y: my,     width: 2,      height: h - my },
      { el: this.mouseLeft,   x: 0,      y: my - 1, width: mx,     height: 2 },
      { el: this.mouseRight,  x: mx,     y: my - 1, width: w - mx, height: 2 },
    ];

    for (const dir of dirs) {
      if (!dir.el) continue;
      if (dir.width <= 0 || dir.height <= 0) {
        dir.el.style.display = "none";
        continue;
      }
      dir.el.style.display = "";
      dir.el.style.left   = `${dir.x}px`;
      dir.el.style.top    = `${dir.y}px`;
      dir.el.style.width  = `${dir.width}px`;
      dir.el.style.height = `${dir.height}px`;
    }
  }

  observeMouseMovement() {
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseleave", this.onMouseLeave);
    window.addEventListener("resize", this.onMouseResize);
  }

  private getCharWidth(editor: Element): number {
    const editorElement = editor.querySelector(".cm-content");
    if (!editorElement) return 12;

    const computedStyle = window.getComputedStyle(editorElement);
    const ctx = this.canvas.getContext("2d");

    if (!ctx) {
      const fontSize = parseFloat(computedStyle.fontSize);
      return Math.max(Math.round(fontSize * 0.6), 8);
    }

    ctx.font = computedStyle.font;
    return Math.max(Math.round(ctx.measureText("M").width), 8);
  }

  private clearOverlay() {
    if (!this.overlay) return;
    // Remove cursor-ext lines; hide block cursor rather than destroying it
    this.overlay.querySelectorAll(".cursor-ext").forEach((e) => e.remove());
    const block = this.overlay.querySelector(".block-cursor") as HTMLDivElement | null;
    if (block) block.style.display = "none";
  }

  private updateOverlay() {
    const editor = document.querySelector(".cm-editor");
    if (!editor || !this.overlay) {
      this.clearOverlay();
      return;
    }

    let rect: { left: number; top: number; right: number; bottom: number; width: number; height: number } | null = null;
    let isEmptyLine = false;

    // Method 1: visible cursor element
    const cmCursor = editor.querySelector(".cm-cursor-primary, .cm-cursor");
    if (cmCursor) {
      rect = cmCursor.getBoundingClientRect();
    }

    // Method 2: selection-based detection for empty lines
    if (!rect || rect.height === 0) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.focusNode) {
        const range = selection.getRangeAt(0);

        const currentNode = selection.focusNode;
        const textContent = currentNode.textContent || "";
        const offset = selection.focusOffset;

        isEmptyLine = (
          textContent === "" ||
          textContent === "\n" ||
          (offset === 0 && textContent.charAt(0) === "\n") ||
          (offset > 0 && textContent.charAt(offset - 1) === "\n" &&
            (offset >= textContent.length || textContent.charAt(offset) === "\n"))
        );

        if (isEmptyLine) {
          const editorContent = editor.querySelector(".cm-content");
          if (editorContent) {
            const computedStyle = window.getComputedStyle(editorContent);
            const lineHeight = parseFloat(computedStyle.lineHeight) || 20;

            const newRange = document.createRange();
            newRange.setStart(selection.focusNode, selection.focusOffset);
            newRange.collapse(true);

            const tempSpan = document.createElement("span");
            tempSpan.textContent = "\u200B";
            tempSpan.style.fontSize = computedStyle.fontSize;
            tempSpan.style.lineHeight = computedStyle.lineHeight;

            try {
              newRange.insertNode(tempSpan);
              const tempRect = tempSpan.getBoundingClientRect();
              rect = {
                left: tempRect.left,
                top: tempRect.top,
                right: tempRect.left + 2,
                bottom: tempRect.top + lineHeight,
                width: 2,
                height: lineHeight,
              };
              tempSpan.remove();
            } catch (e) {
              const rangeRect = newRange.getBoundingClientRect();
              const editorRect = editorContent.getBoundingClientRect();
              rect = {
                left: rangeRect.left ?? editorRect.left + 10,
                top: rangeRect.top ?? editorRect.top + 10,
                right: (rangeRect.left ?? editorRect.left + 10) + 2,
                bottom: (rangeRect.top ?? editorRect.top + 10) + lineHeight,
                width: 2,
                height: lineHeight,
              };
            }
          }
        } else {
          const tempRect = range.getBoundingClientRect();
          if (tempRect.width >= 0 && tempRect.top >= 0) {
            rect = {
              left: tempRect.left,
              top: tempRect.top,
              right: tempRect.right,
              bottom: tempRect.bottom,
              width: tempRect.width,
              height: tempRect.height,
            };
          }
        }
      }
    }

    // Method 3: fallback
    if (!rect || rect.height === 0) {
      const cursorElements = editor.querySelectorAll('[class*="cursor"], .cm-cursor, .cm-fat-cursor');
      for (const cursorEl of cursorElements) {
        const cursorRect = cursorEl.getBoundingClientRect();
        if (cursorRect.width >= 0 && cursorRect.top >= 0) {
          rect = cursorRect;
          break;
        }
      }
    }

    if (!rect || (rect.height === 0 && rect.width === 0)) {
      this.clearOverlay();
      return;
    }

    if (rect.height === 0) {
      const editorContent = editor.querySelector(".cm-content");
      if (editorContent) {
        const lineHeight = parseFloat(window.getComputedStyle(editorContent).lineHeight) || 20;
        rect = { ...rect, height: lineHeight, bottom: rect.top + lineHeight };
      }
    }

    const charWidth = this.getCharWidth(editor);

    // Draw block cursor (reuse existing element)
    let block = this.overlay.querySelector(".block-cursor") as HTMLDivElement | null;
    if (!block) {
      block = document.createElement("div");
      block.className = "block-cursor";
      this.overlay.appendChild(block);
    }
    block.style.display = "";
    block.style.left   = `${rect.left}px`;
    block.style.top    = `${rect.top}px`;
    block.style.width  = `${charWidth}px`;
    block.style.height = `${rect.height}px`;

    // Cursor extension lines (recreated each update — 4 elements)
    this.overlay.querySelectorAll(".cursor-ext").forEach((e) => e.remove());

    const directions = [
      { name: "top",    x: rect.left,             y: 0,           w: charWidth,                                   h: rect.top },
      { name: "bottom", x: rect.left,             y: rect.bottom, w: charWidth,                                   h: window.innerHeight - rect.bottom },
      { name: "left",   x: 0,                     y: rect.top,    w: rect.left,                                   h: rect.height },
      { name: "right",  x: rect.left + charWidth, y: rect.top,    w: window.innerWidth - (rect.left + charWidth), h: rect.height },
    ];

    for (const dir of directions) {
      const ext = document.createElement("div");
      ext.className = `cursor-ext cursor-ext-${dir.name}`;
      ext.style.left   = `${dir.x}px`;
      ext.style.top    = `${dir.y}px`;
      ext.style.width  = `${dir.w}px`;
      ext.style.height = `${dir.h}px`;
      this.overlay.appendChild(ext);
    }
  }

  observeCursorMovement() {
    const editor = document.querySelector(".cm-editor");
    if (editor) {
      this.observer = new MutationObserver(() => this.updateOverlay());
      this.observer.observe(editor, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }

    document.addEventListener("selectionchange", this.onSelectionChange);
    document.addEventListener("click", this.onClickInEditor);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("resize", this.onCursorResize);
    window.addEventListener("scroll", this.onScroll, true);
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateOverlay()));

    this.intervalId = window.setInterval(() => this.updateOverlay(), 100);

    this.updateOverlay();
  }
}
