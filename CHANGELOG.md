# Changelog

All notable changes to Spicy Tools will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-22

### Changed

#### Dropdowns - Complete Architecture Rewrite

The dropdown system was completely rewritten to fix fundamental architectural issues. The new three-tier design provides better separation of concerns and eliminates race conditions.

**New Architecture:**
- **DropdownUI** (Tier 1) - Pure UI component with no Obsidian dependencies
- **PropertyDropdownAdapter** (Tier 2) - Bridges UI events to frontmatter updates
- **PropertyDropdownRegistry** (Tier 3) - Manages lifecycle and coordinates interaction locks

**Files Replaced:**
- `DropdownComponent.ts` → `DropdownUI.ts`
- `PropertyRenderer.ts` → `PropertyDropdownAdapter.ts` + `PropertyDropdownRegistry.ts`

### Fixed

#### Dropdowns

- **Multi-select dropdowns now render correctly** - Added delayed mount (100ms) for `multi: true` properties to let Obsidian finish its native rendering before mounting our dropdown. Previously Obsidian's async re-rendering for list properties would overwrite our dropdown with its native `multi-select-container`.

- **MutationObserver detects native control overwrites** - Expanded observer to trigger scans when Obsidian's native controls (`multi-select-container`, `metadata-input-longtext`) appear inside value containers. Previously the observer only watched for property row additions/removals.

- **Dropdown menu escapes overflow:hidden containers** - Menu now renders to `document.body` with fixed positioning instead of inside the wrapper. The `.metadata-property-value` container has `overflow: hidden` which was clipping absolutely positioned children.

- **Focus management prevents native suggester** - Explicitly focus trigger or filter input when opening dropdown to prevent Obsidian's focus management from moving focus to adjacent property fields and triggering the native "copilot-conversation" suggester.

- **Interaction lock acquired before DOM changes** - Moved `onOpen()` callback to fire BEFORE any DOM changes in `DropdownUI.open()`. This ensures the interaction lock is acquired early enough to prevent Obsidian's re-renders from destroying the dropdown mid-open.

- **Document click handler respects menu in body** - Updated `handleDocumentClick()` to check if click is inside the menu (which is now in `document.body`) in addition to the wrapper.

## [0.2.0] - 2026-01-22

### Fixed

#### Kanban Board

- **Card filenames now preserve spaces** - The `sanitizeFilename()` function in `BoardManager.ts` no longer converts spaces to dashes. Creating a card titled "My Test Card" now produces `My Test Card.md` instead of `My-Test-Card.md`.

- **Cross-column card moves respect drop position** - Threaded `dropIndex` parameter through `ColumnComponent.ts`, `SwimlaneComponent.ts`, `BoardView.ts`, and `BoardManager.ts`. Cards dropped at a specific position in another column now land at that exact position instead of always appearing at the bottom.

- **Gear icon opens board configuration in source mode** - Added a gear icon to the board header in `BoardView.ts` and `main.ts`. Clicking it opens the `_board.md` file in source/markdown mode for direct editing. Previously there was no way to edit board configuration from within Obsidian since the file was always intercepted and rendered as a kanban view.

#### Dropdowns

- **Dropdown values read correctly from metadata cache** - Added `getPropertyValueFromCache()` method in `PropertyRenderer.ts` that reads from Obsidian's `metadataCache` instead of querying DOM elements. Previously the DOM query found the property name input instead of the value input, displaying wrong values (e.g., "status" instead of "Draft").

- **Stale dropdown references detected and re-created** - Added verification in `PropertyRenderer.ts` that the `.spicy-dropdown` element still exists in the DOM before skipping dropdown creation. When Obsidian replaced dropdown content, stale references prevented dropdowns from being re-created.

- **Dropdown click handler uses stopPropagation** - Added `e.stopPropagation()` to the trigger click handler in `DropdownComponent.ts`. Previously the click event bubbled to the document handler, immediately closing the dropdown after opening.

- **Multiselect uses internal state array** - Added `selectedValues` internal state array in `DropdownComponent.ts`. Multiselect operations now modify this array instead of parsing from config each time. Previously, adding items to a multiselect required clearing existing items first.

- **MutationObserver skips re-render during interaction** - Added `isInteracting()` method to `DropdownComponent.ts` and interaction guard to `PropertyRenderer.ts`. When a dropdown is open, the MutationObserver no longer triggers `renderDropdowns()`, preventing the dropdown from being destroyed mid-interaction when `processFrontMatter()` modifies the file.
