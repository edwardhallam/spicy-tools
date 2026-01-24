# Dropdown Definitions

These dropdowns apply to all files in this folder and subfolders.

```yaml
entry_type:
  options:
    - Symptom
    - Medication
    - Procedure
    - Observation

severity:
  options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

categories:
  options:
    - Throat
    - Respiratory
    - Digestive
    - Energy
    - Sleep
    - Mental
  multi: true

# Disable inherited dropdown for this property
some_parent_property:
  disabled: true
```

## Notes

- The `entry_type` dropdown helps categorize health log entries
- `severity` uses a 1-10 scale
- `categories` allows multiple selections
