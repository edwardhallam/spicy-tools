# Spicy Tools Usage Guide

Spicy Tools is an Obsidian plugin that provides folder-scoped frontmatter dropdowns and kanban boards.

## Dropdowns (Single-Select)

Define dropdown options for frontmatter properties by creating `_dropdowns.md` in any folder.

### Basic Syntax

```markdown
# Dropdown Definitions

```yaml
property_name:
  options:
    - Option 1
    - Option 2
    - Option 3
```
```

### Example: Project Status

```markdown
# Dropdown Definitions

```yaml
status:
  options:
    - backlog
    - in-progress
    - review
    - done

priority:
  options:
    - low
    - medium
    - high
    - critical
```
```

### Inheritance

Definitions inherit from parent folders. A `_dropdowns.md` in a child folder **fully replaces** (not merges) the parent's definition for that property.

```
vault/
├── _dropdowns.md          # status: [backlog, active, done]
└── Projects/
    ├── _dropdowns.md      # status: [todo, in-progress, review, done]
    └── Website/
        └── task.md        # Uses Projects/ status options
```

To disable an inherited dropdown:

```yaml
inherited_property:
  disabled: true
```

---

## Multi-Select / Tags

Add `multi: true` to allow multiple selections. Values are stored as YAML arrays in frontmatter.

### Syntax

```yaml
categories:
  options:
    - Frontend
    - Backend
    - DevOps
    - Documentation
  multi: true

tags:
  options:
    - bug
    - feature
    - enhancement
    - urgent
  multi: true
```

### Frontmatter Result

```yaml
---
categories:
  - Frontend
  - Backend
tags:
  - feature
  - urgent
---
```

### UI Behavior

- Renders as checkboxes in dropdown list
- Selected values display as removable pills
- Click pill × to remove, click dropdown to add

---

## Table Dropdowns

Render markdown table columns as dropdowns in Reading View. Useful for status trackers, task lists, or any tabular data with constrained values.

### Configuration

Add a `tables:` section to your `_dropdowns.md` file:

```yaml
tables:
  Status:
    options:
      - Uncontrolled
      - Controlled
      - Slightly Controlled
  Priority:
    options:
      - Low
      - Medium
      - High
    multi: true
```

Each key under `tables:` matches a column header in your markdown tables.

### Example

**_dropdowns.md:**
```yaml
tables:
  Status:
    options:
      - Open
      - In Progress
      - Closed
  Assignee:
    options:
      - Alice
      - Bob
      - Charlie
```

**Your note:**
```markdown
| Task | Status | Assignee |
|------|--------|----------|
| Fix bug | Open | Alice |
| Write docs | In Progress | Bob |
```

In Reading View, the Status and Assignee columns render as dropdown selectors instead of plain text.

### How It Works

- Column headers are matched **case-sensitively** to keys in the `tables:` section
- Selecting a value updates the underlying markdown table
- Inheritance works the same as frontmatter dropdowns (child folders can override parent definitions)

### Limitations

- **Reading View only** - Table dropdowns do not appear in Live Preview or Source mode
- **Single-select by default** - Add `multi: true` for multi-select columns

---

## Kanban Boards

Create a visual board for any folder by adding `_board.md`.

### Basic Configuration

```markdown
# Board Name

```yaml
columnProperty: status
columns:
  - todo
  - in-progress
  - done
```
```

### Full Configuration

```yaml
# Required
columnProperty: status          # Frontmatter property for columns
columns:                        # Column order (left to right)
  - backlog
  - in-progress
  - review
  - done

# Card Display (optional)
cardTitle: title                # Property for card title (default: filename)
cardPreview: notes              # Property for preview text
cardPreviewLines: 2             # Max preview lines

# Labels (optional)
labelProperty: tags             # Property containing labels
labelDisplay: chips             # 'chips' or 'stripe'
labelColors:
  bug: red
  feature: blue
  urgent: orange

# Swimlanes (optional)
swimlaneProperty: project       # Horizontal grouping
swimlanesCollapsible: true

# Card Order (auto-managed)
cardOrder:
  todo:
    - task-1.md
    - task-2.md
  in-progress:
    - task-3.md
```

### Opening Boards

1. **Direct open**: Click on `_board.md` file - opens as kanban view
2. **Command palette**: "Spicy Tools: Open board picker"
3. **Embedded**: Use code block in any markdown file

### Embedded Boards

Embed a board view in any note:

````markdown
```kanban
folder: Projects/Website
```
````

Embedded boards are fully interactive - drag cards to change status.

### Drag and Drop

- **Between columns**: Updates the `columnProperty` in frontmatter
- **Within column**: Reorders cards (saved to `cardOrder` in `_board.md`)
- **Click card**: Opens the file

---

## Common Patterns

### Project Workflow

**Folder structure:**
```
Projects/
├── _dropdowns.md
├── _board.md
├── Website/
│   ├── _board.md      # Website-specific board
│   ├── homepage.md
│   └── api.md
└── Mobile/
    └── feature.md
```

**Projects/_dropdowns.md:**
```yaml
status:
  options:
    - backlog
    - in-progress
    - review
    - done

priority:
  options: [low, medium, high, critical]

type:
  options:
    - feature
    - bug
    - chore
  multi: false
```

**Projects/_board.md:**
```yaml
columnProperty: status
columns:
  - backlog
  - in-progress
  - review
  - done
labelProperty: type
labelColors:
  feature: blue
  bug: red
  chore: gray
```

### Tag Taxonomy

**Root _dropdowns.md:**
```yaml
area:
  options:
    - Work
    - Personal
    - Health
    - Finance
  multi: true

context:
  options:
    - "@home"
    - "@office"
    - "@phone"
    - "@computer"
  multi: true
```

### Nested Inheritance

```
Health/
├── _dropdowns.md              # entry_type: [Symptom, Medication, ...]
└── Tracking/
    └── HealthLog/
        ├── _dropdowns.md      # severity: [1-10], categories: [...]
        └── 2026/
            └── entry.md       # Inherits both Health/ AND HealthLog/
```

**Note**: If both parent and child define the same property, child **replaces** parent entirely.

---

## Troubleshooting

### Dropdown not appearing
- Check `_dropdowns.md` exists in folder or parent
- Verify YAML syntax is valid (use a linter)
- Check property name matches exactly (case-sensitive)

### Value shows warning styling
- Current value doesn't match any option
- Value is preserved but highlighted for review
- Select valid option or edit frontmatter manually

### Board not loading
- Verify `_board.md` has valid YAML
- Check `columnProperty` and `columns` are defined
- Ensure files in folder have the column property set

### Cards in wrong column
- Check frontmatter value matches column name exactly
- Values not matching any column appear in "Uncategorized"
