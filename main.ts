import { Plugin } from "obsidian";

export default class BlockCursorPlugin extends Plugin {
  private overlay: HTMLDivElement | null = null;
  private mouseOverlay: HTMLDivElement | null = null;

  async onload() {
    this.injectCursorCSS();
    this.addCursorOverlay();
    this.addMouseOverlay();
    this.observeCursorMovement();
    this.observeMouseMovement();
  }

  onunload() {
    this.removeCursorCSS();
    this.removeCursorOverlay();
    this.removeMouseOverlay();
  }

  injectCursorCSS() {
	const css = `
	  /* Hide the default line cursor and caret */
	  .cm-cursor, .cm-cursorLayer {
		visibility: hidden !important;
		opacity: 0 !important;
	  }
	  
	  /* Ensure cursor is visible even when editor loses focus */
	  .cm-editor .cm-cursor {
		visibility: visible !important;
		opacity: 1 !important;
	  }
	  
	  /* Block cursor styling with blinking animation */
	  .block-cursor {
		position: fixed;
		background: var(--text-accent, #00bbff);
		opacity: 0.8 !important;
		z-index: 10000 !important;
		pointer-events: none;
		border-radius: 1px;
		animation: cursor-blink 1s step-end infinite;
	  }
	  
	  /* Blinking animation for the block cursor */
	  @keyframes cursor-blink {
		0%, 50% {
		  opacity: 0.8;
		}
		51%, 100% {
		  opacity: 0;
		}
	  }
	  
	  /* Static crosshair extensions (no animation) */
	  .cursor-ext {
		position: fixed;
		pointer-events: none;
		background: var(--text-accent, #00bbff);
		opacity: 0.15;
		z-index: 9998;
	  }
	  
	  /* Mouse crosshair extensions */
	  .mouse-ext {
		position: fixed;
		pointer-events: none;
		background: var(--text-muted, #666);
		opacity: 0.3;
		z-index: 9997;
		transition: opacity 0.1s ease;
	  }
	  
	  /* Hide mouse crosshair when hovering over UI elements */
	  .mouse-ext.hidden {
		opacity: 0;
	  }
	`;
	const style = document.createElement("style");
	style.id = "block-cursor-style";
	style.textContent = css;
	document.head.appendChild(style);
  }

  removeCursorCSS() {
    const style = document.getElementById("block-cursor-style");
    if (style) style.remove();
  }

  addCursorOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.id = "block-cursor-overlay";
    this.overlay.style.position = "fixed";
    this.overlay.style.top = "0";
    this.overlay.style.left = "0";
    this.overlay.style.width = "100vw";
    this.overlay.style.height = "100vh";
    this.overlay.style.pointerEvents = "none";
    this.overlay.style.zIndex = "9999";
    document.body.appendChild(this.overlay);
  }

  addMouseOverlay() {
    this.mouseOverlay = document.createElement("div");
    this.mouseOverlay.id = "mouse-cursor-overlay";
    this.mouseOverlay.style.position = "fixed";
    this.mouseOverlay.style.top = "0";
    this.mouseOverlay.style.left = "0";
    this.mouseOverlay.style.width = "100vw";
    this.mouseOverlay.style.height = "100vh";
    this.mouseOverlay.style.pointerEvents = "none";
    this.mouseOverlay.style.zIndex = "9997";
    document.body.appendChild(this.mouseOverlay);
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
  }

  observeMouseMovement() {
    let mouseX = 0;
    let mouseY = 0;

    const updateMouseCrosshair = () => {
      if (!this.mouseOverlay) return;

      // Check if mouse is over interactive elements
      const elementUnderMouse = document.elementFromPoint(mouseX, mouseY);
      const isOverInteractive = elementUnderMouse && (
        elementUnderMouse.closest('button') ||
        elementUnderMouse.closest('input') ||
        elementUnderMouse.closest('select') ||
        elementUnderMouse.closest('textarea') ||
        elementUnderMouse.closest('.clickable-icon') ||
        elementUnderMouse.closest('.nav-file-title') ||
        elementUnderMouse.closest('.workspace-tab-header') ||
        elementUnderMouse.closest('.menu-item')
      );

      // Remove old mouse extension lines
      this.mouseOverlay.querySelectorAll(".mouse-ext").forEach(e => e.remove());

      if (isOverInteractive) return; // Don't show crosshair over interactive elements

      // Mouse crosshair extension lines
      const mouseDirections = [
        { name: "top",    x: mouseX - 1, y: 0,       w: 2, h: mouseY },
        { name: "bottom", x: mouseX - 1, y: mouseY,  w: 2, h: window.innerHeight - mouseY },
        { name: "left",   x: 0,          y: mouseY - 1, w: mouseX, h: 2 },
        { name: "right",  x: mouseX,     y: mouseY - 1, w: window.innerWidth - mouseX, h: 2 },
      ];

      mouseDirections.forEach(dir => {
        if (dir.w <= 0 || dir.h <= 0) return;
        
        const ext = document.createElement("div");
        ext.className = `mouse-ext mouse-ext-${dir.name}`;
        ext.style.position = "fixed";
        ext.style.left = `${dir.x}px`;
        ext.style.top = `${dir.y}px`;
        ext.style.width = `${dir.w}px`;
        ext.style.height = `${dir.h}px`;
        ext.style.background = "var(--text-muted, #666)";
        ext.style.opacity = "0.3";
        ext.style.pointerEvents = "none";
        ext.style.zIndex = "9997";
        this.mouseOverlay?.appendChild(ext);
      });
    };

    // Track mouse movement
    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      updateMouseCrosshair();
    });

    // Hide crosshair when mouse leaves window
    document.addEventListener("mouseleave", () => {
      if (this.mouseOverlay) {
        this.mouseOverlay.querySelectorAll(".mouse-ext").forEach(e => e.remove());
      }
    });

    // Update on window resize
    window.addEventListener("resize", updateMouseCrosshair);
  }

  observeCursorMovement() {
	const updateOverlay = () => {
	  const editor = document.querySelector(".cm-editor");
	  if (!editor || !this.overlay) {
		if (this.overlay) {
		  this.overlay.innerHTML = "";
		}
		if (this.mouseOverlay) {
		  this.mouseOverlay.innerHTML = "";
		}
		return;
	  }
  
	  let rect = null;
	  let isEmptyLine = false;
  
	  // Method 1: Try to find visible cursor element
	  const cmCursor = editor.querySelector(".cm-cursor-primary, .cm-cursor");
	  if (cmCursor) {
		rect = cmCursor.getBoundingClientRect();
	  }
  
	  // Method 2: Enhanced selection-based detection for empty lines
if (!rect || rect.height === 0) {
	const selection = window.getSelection();
	if (selection && selection.rangeCount > 0 && selection.focusNode) { // Add null check here
	  const range = selection.getRangeAt(0);
	  
	  // Check if we're on an empty line
	  const currentNode = selection.focusNode;
	  const textContent = currentNode.textContent || "";
	  const offset = selection.focusOffset;
	  
	  // Detect empty line scenarios
	  isEmptyLine = (
		textContent === "" || 
		textContent === "\n" || 
		(offset === 0 && textContent.charAt(0) === "\n") ||
		(offset > 0 && textContent.charAt(offset - 1) === "\n" && 
		 (offset >= textContent.length || textContent.charAt(offset) === "\n"))
	  );
	  
	  // For empty lines, create a more accurate cursor rectangle
	  if (isEmptyLine) {
		const editorContent = editor.querySelector(".cm-content");
		if (editorContent) {
		  const computedStyle = window.getComputedStyle(editorContent);
		  const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
		  
		  // Create a range at the current position - now safe because we checked focusNode
		  const newRange = document.createRange();
		  newRange.setStart(selection.focusNode, selection.focusOffset);
		  newRange.collapse(true);
		  
		  // Insert a temporary character to get accurate positioning
		  const tempSpan = document.createElement('span');
		  tempSpan.textContent = '\u200B'; // Zero-width space
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
			  height: lineHeight
			};
			
			// Clean up the temporary element
			tempSpan.remove();
		  } catch (e) {
			// Fallback if insertion fails
			const rangeRect = newRange.getBoundingClientRect();
			const editorRect = editorContent.getBoundingClientRect();
			
			rect = {
			  left: rangeRect.left || editorRect.left + 10,
			  top: rangeRect.top || editorRect.top + 10,
			  right: rangeRect.left + 2 || editorRect.left + 12,
			  bottom: rangeRect.top + lineHeight || editorRect.top + 10 + lineHeight,
			  width: 2,
			  height: lineHeight
			};
		  }
		}
	  } else {
		// Regular line handling
		const tempRect = range.getBoundingClientRect();
		if (tempRect.width >= 0 && tempRect.top >= 0) {
		  rect = {
			left: tempRect.left,
			top: tempRect.top,
			right: tempRect.right,
			bottom: tempRect.bottom,
			width: tempRect.width,
			height: tempRect.height
		  };
		}
	  }
	}
  }
  
	  // Method 3: Fallback cursor detection
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
  
	  // Only clear overlays if we truly can't find any cursor position
	  if (!rect || (rect.height === 0 && rect.width === 0)) {
		this.overlay.innerHTML = "";
		if (this.mouseOverlay) {
		  this.mouseOverlay.innerHTML = "";
		}
		return;
	  }
  
	  // Ensure minimum height for any remaining zero-height cases
	  if (rect.height === 0) {
		const editorContent = editor.querySelector(".cm-content");
		if (editorContent) {
		  const computedStyle = window.getComputedStyle(editorContent);
		  const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
		  rect = {
			...rect,
			height: lineHeight,
			bottom: rect.top + lineHeight
		  };
		}
	  }
  
	  // Calculate character width
	  const getCharWidth = () => {
		const editorElement = editor.querySelector(".cm-content");
		if (!editorElement) return 12;
		
		const computedStyle = window.getComputedStyle(editorElement);
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		
		if (!ctx) {
		  const fontSize = parseFloat(computedStyle.fontSize);
		  return Math.max(Math.round(fontSize * 0.6), 8);
		}
		
		ctx.font = computedStyle.font;
		return Math.max(Math.round(ctx.measureText('M').width), 8);
	  };
  
	  const charWidth = getCharWidth();
  
	  // Draw the block cursor
	  let block = this.overlay.querySelector(".block-cursor") as HTMLDivElement;
	  if (!block) {
		block = document.createElement("div");
		block.className = "block-cursor";
		this.overlay.appendChild(block);
	  }
	  block.style.left = `${rect.left}px`;
	  block.style.top = `${rect.top}px`;
	  block.style.width = `${charWidth}px`;
	  block.style.height = `${rect.height}px`;
  
	  // Remove old extension lines
	  this.overlay.querySelectorAll(".cursor-ext").forEach(e => e.remove());
  
	  // Text cursor extension lines
	  const directions = [
		{ name: "top",    x: rect.left, y: 0,           w: charWidth, h: rect.top },
		{ name: "bottom", x: rect.left, y: rect.bottom, w: charWidth, h: window.innerHeight - rect.bottom },
		{ name: "left",   x: 0,         y: rect.top,    w: rect.left,  h: rect.height },
		{ name: "right",  x: rect.left + charWidth, y: rect.top, w: window.innerWidth - (rect.left + charWidth), h: rect.height },
	  ];
  
	  directions.forEach(dir => {
		const ext = document.createElement("div");
		ext.className = `cursor-ext cursor-ext-${dir.name}`;
		ext.style.position = "fixed";
		ext.style.left = `${dir.x}px`;
		ext.style.top = `${dir.y}px`;
		ext.style.width = `${dir.w}px`;
		ext.style.height = `${dir.h}px`;
		ext.style.background = "var(--text-accent, #00bbff)";
		ext.style.opacity = "0.15";
		ext.style.pointerEvents = "none";
		ext.style.zIndex = "9998";
		this.overlay?.appendChild(ext);
	  });
	};
  

    // Enhanced observation
    const observer = new MutationObserver(updateOverlay);
    const editor = document.querySelector(".cm-editor");
    if (editor) {
      observer.observe(editor, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        characterData: true 
      });
    }

    // Listen for selection changes
    document.addEventListener("selectionchange", updateOverlay);
    
    // Listen for clicks in editor
    document.addEventListener("click", (e) => {
      if ((e.target as Element).closest(".cm-editor")) {
        setTimeout(updateOverlay, 10);
      }
    });

    // Listen for key events
    document.addEventListener("keyup", updateOverlay);
    document.addEventListener("keydown", updateOverlay);

    window.addEventListener("resize", updateOverlay);
    window.addEventListener("scroll", updateOverlay, true);
    this.app.workspace.on("active-leaf-change", updateOverlay);

    // More frequent updates to catch cursor changes
    setInterval(updateOverlay, 100);
    
    // Initial call
    updateOverlay();
  }
}
