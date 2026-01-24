# Project Board

This board tracks project tasks.

```yaml
# Required settings
columnProperty: status
columns:
  - todo
  - in-progress
  - review
  - done

# Card display
cardTitle: title
cardPreview: notes
cardPreviewLines: 2

# Labels
labelProperty: tags
labelDisplay: chips
labelColors:
  bug: red
  feature: blue
  urgent: orange

# Swimlanes (optional)
swimlaneProperty: project
swimlanesCollapsible: true

# Templates
newCardTemplate: _template.md

# Card order (managed by plugin)
cardOrder:
  todo:
    - task-1.md
    - task-2.md
  in-progress:
    - task-3.md
```

## Instructions

- Drag cards between columns to change status
- Click "Add card" to create new tasks
- Labels show as colored chips
