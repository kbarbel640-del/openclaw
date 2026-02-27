---
name: creating-shortcuts
description: Generates Apple Shortcuts as importable .shortcut plist files. Use when user wants to create iOS/macOS shortcuts, automate tasks with Shortcuts app, or generate workflow automation files.
invocation: user
arguments: "[shortcut description]"
---

# Creating Apple Shortcuts

Generate valid `.shortcut` plist files for Apple's Shortcuts app.

## Quick Reference

| Task              | Action                                                          |
| ----------------- | --------------------------------------------------------------- |
| Generate shortcut | Create plist XML, save as `.shortcut`                           |
| Sign for sharing  | `shortcuts sign -m anyone -i input.shortcut -o signed.shortcut` |
| Import            | Double-click file or `open -a Shortcuts file.shortcut`          |
| Run from CLI      | `shortcuts run "Name" -i input.txt`                             |
| List shortcuts    | `shortcuts list`                                                |

## Contents

- [Workflow](#workflow)
- [Plist Structure](#plist-structure)
- [Actions](#actions)
- [Variables](#variables)
- [Control Flow](#control-flow)
- [Validation](#validation)
- **References:**
  - [references/actions.md](references/actions.md) - Common action identifiers
  - [references/plist-format.md](references/plist-format.md) - Full plist schema
  - [references/variables.md](references/variables.md) - Variable system
  - [references/control-flow.md](references/control-flow.md) - If/Repeat/Menu patterns
- **Templates:**
  - [assets/minimal.shortcut.xml](assets/minimal.shortcut.xml) - Starter template
  - [assets/http-request.shortcut.xml](assets/http-request.shortcut.xml) - API call example

## Workflow

1. **Define actions** - List steps the shortcut performs
2. **Generate UUIDs** - Each action needs unique UUID for variable references
3. **Build action array** - Create `WFWorkflowActions` with proper parameters
4. **Wire variables** - Connect outputs to inputs via `OutputUUID`
5. **Wrap in plist** - Add required metadata keys
6. **Save file** - Write as `.shortcut` (binary plist) or `.xml`
7. **Sign** - Run `shortcuts sign -m anyone -i file.shortcut -o signed.shortcut`

## Plist Structure

### Minimal Template

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>WFWorkflowClientVersion</key>
    <string>2302</string>
    <key>WFWorkflowMinimumClientVersion</key>
    <integer>900</integer>
    <key>WFWorkflowMinimumClientVersionString</key>
    <string>900</string>
    <key>WFWorkflowIcon</key>
    <dict>
        <key>WFWorkflowIconStartColor</key>
        <integer>4282601983</integer>
        <key>WFWorkflowIconGlyphNumber</key>
        <integer>59771</integer>
    </dict>
    <key>WFWorkflowTypes</key>
    <array/>
    <key>WFWorkflowInputContentItemClasses</key>
    <array>
        <string>WFStringContentItem</string>
    </array>
    <key>WFWorkflowActions</key>
    <array>
        <!-- Actions go here -->
    </array>
</dict>
</plist>
```

### Required Keys

| Key                                 | Type   | Purpose                      |
| ----------------------------------- | ------ | ---------------------------- |
| `WFWorkflowActions`                 | Array  | Sequential action list       |
| `WFWorkflowClientVersion`           | String | App version (use `2302`)     |
| `WFWorkflowIcon`                    | Dict   | Color + glyph                |
| `WFWorkflowTypes`                   | Array  | `NCWidget`, `WatchKit`, etc. |
| `WFWorkflowInputContentItemClasses` | Array  | Accepted input types         |

## Actions

### Action Structure

```xml
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.gettext</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>WFTextActionText</key>
        <string>Hello World</string>
    </dict>
    <key>UUID</key>
    <string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
</dict>
```

### Common Actions

| Action        | Identifier                           | Key Parameters              |
| ------------- | ------------------------------------ | --------------------------- |
| Text          | `is.workflow.actions.gettext`        | `WFTextActionText`          |
| Show Result   | `is.workflow.actions.showresult`     | `Text`                      |
| Get URL       | `is.workflow.actions.downloadurl`    | `WFInput`, `WFHTTPMethod`   |
| Set Variable  | `is.workflow.actions.setvariable`    | `WFVariableName`, `WFInput` |
| If            | `is.workflow.actions.conditional`    | `WFCondition`, `WFInput`    |
| Repeat        | `is.workflow.actions.repeat.count`   | `WFRepeatCount`             |
| Ask for Input | `is.workflow.actions.ask`            | `WFAskActionPrompt`         |
| Notification  | `is.workflow.actions.notification`   | `WFNotificationActionTitle` |
| Run Script    | `is.workflow.actions.runshellscript` | `WFShellScript`             |
| Dictionary    | `is.workflow.actions.dictionary`     | `WFItems`                   |

See [references/actions.md](references/actions.md) for complete list.

## Variables

### Magic Variables (Preferred)

Reference action outputs by UUID:

```xml
<key>WFInput</key>
<dict>
    <key>Value</key>
    <dict>
        <key>OutputName</key>
        <string>Text</string>
        <key>OutputUUID</key>
        <string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
        <key>Type</key>
        <string>ActionOutput</string>
    </dict>
    <key>WFSerializationType</key>
    <string>WFTextTokenAttachment</string>
</dict>
```

### Special Variables

| Type             | Description                |
| ---------------- | -------------------------- |
| `ActionOutput`   | Magic variable from action |
| `ExtensionInput` | Shortcut input             |
| `Ask`            | Ask Each Time              |
| `Clipboard`      | System clipboard           |
| `CurrentDate`    | Current date/time          |
| `Variable`       | Named variable             |

### Inline Variables (Text with embedded references)

```xml
<key>WFTextActionText</key>
<dict>
    <key>Value</key>
    <dict>
        <key>string</key>
        <string>Hello ￼!</string>
        <key>attachmentsByRange</key>
        <dict>
            <key>{6, 1}</key>
            <dict>
                <key>OutputName</key>
                <string>Name</string>
                <key>OutputUUID</key>
                <string>UUID-HERE</string>
                <key>Type</key>
                <string>ActionOutput</string>
            </dict>
        </dict>
    </dict>
    <key>WFSerializationType</key>
    <string>WFTextTokenString</string>
</dict>
```

The `￼` character (U+FFFC) is the placeholder. Position `{6, 1}` means character at index 6, length 1.

## Control Flow

### GroupingIdentifier System

Control flow blocks share a `GroupingIdentifier` UUID and use `WFControlFlowMode`:

| Mode | Meaning                            |
| ---- | ---------------------------------- |
| 0    | Start (If, Repeat, Menu)           |
| 1    | Middle (Otherwise, Menu Case)      |
| 2    | End (End If, End Repeat, End Menu) |

### If/Otherwise/End If

```xml
<!-- If -->
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.conditional</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>GroupingIdentifier</key>
        <string>GROUP-UUID</string>
        <key>WFControlFlowMode</key>
        <integer>0</integer>
        <key>WFCondition</key>
        <integer>4</integer>
        <key>WFInput</key>
        <!-- Variable reference -->
    </dict>
</dict>
<!-- Otherwise -->
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.conditional</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>GroupingIdentifier</key>
        <string>GROUP-UUID</string>
        <key>WFControlFlowMode</key>
        <integer>1</integer>
    </dict>
</dict>
<!-- End If -->
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.conditional</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>GroupingIdentifier</key>
        <string>GROUP-UUID</string>
        <key>WFControlFlowMode</key>
        <integer>2</integer>
    </dict>
</dict>
```

### WFCondition Values

| Value | Operator                |
| ----- | ----------------------- |
| 0     | Equals                  |
| 1     | Not Equals              |
| 2     | Greater Than            |
| 3     | Greater Than or Equal   |
| 4     | Contains                |
| 5     | Does Not Contain        |
| 99    | Has Any Value           |
| 100   | Does Not Have Any Value |

## Validation

### Before Saving

```bash
# Validate plist syntax
plutil -lint file.shortcut

# Convert to readable XML
plutil -convert xml1 file.shortcut
```

### After Saving

```bash
# Sign for import (required on iOS 15+)
shortcuts sign -m anyone -i file.shortcut -o signed.shortcut

# Test import
open -a Shortcuts signed.shortcut

# Run and verify
shortcuts run "Shortcut Name"
```

## Common Errors

| Error               | Cause                         | Fix                                         |
| ------------------- | ----------------------------- | ------------------------------------------- |
| Won't import        | Unsigned                      | Sign with `shortcuts sign`                  |
| Invalid plist       | XML syntax error              | Run `plutil -lint`                          |
| Action not found    | Wrong identifier              | Check `is.workflow.actions.*` prefix        |
| Variables broken    | Wrong UUID                    | Ensure `OutputUUID` matches action's `UUID` |
| Control flow broken | Mismatched GroupingIdentifier | Same UUID for start/middle/end              |

## Example: Hello World

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>WFWorkflowClientVersion</key>
    <string>2302</string>
    <key>WFWorkflowMinimumClientVersion</key>
    <integer>900</integer>
    <key>WFWorkflowMinimumClientVersionString</key>
    <string>900</string>
    <key>WFWorkflowIcon</key>
    <dict>
        <key>WFWorkflowIconStartColor</key>
        <integer>4282601983</integer>
        <key>WFWorkflowIconGlyphNumber</key>
        <integer>59771</integer>
    </dict>
    <key>WFWorkflowTypes</key>
    <array/>
    <key>WFWorkflowInputContentItemClasses</key>
    <array/>
    <key>WFWorkflowActions</key>
    <array>
        <dict>
            <key>WFWorkflowActionIdentifier</key>
            <string>is.workflow.actions.gettext</string>
            <key>WFWorkflowActionParameters</key>
            <dict>
                <key>WFTextActionText</key>
                <string>Hello, World!</string>
            </dict>
            <key>UUID</key>
            <string>11111111-1111-1111-1111-111111111111</string>
        </dict>
        <dict>
            <key>WFWorkflowActionIdentifier</key>
            <string>is.workflow.actions.showresult</string>
            <key>WFWorkflowActionParameters</key>
            <dict>
                <key>Text</key>
                <dict>
                    <key>Value</key>
                    <dict>
                        <key>OutputName</key>
                        <string>Text</string>
                        <key>OutputUUID</key>
                        <string>11111111-1111-1111-1111-111111111111</string>
                        <key>Type</key>
                        <string>ActionOutput</string>
                    </dict>
                    <key>WFSerializationType</key>
                    <string>WFTextTokenAttachment</string>
                </dict>
            </dict>
        </dict>
    </array>
</dict>
</plist>
```

## CLI Reference

```bash
# List shortcuts
shortcuts list
shortcuts list --folders
shortcuts list -f "Folder Name"

# Run shortcut
shortcuts run "Name"
shortcuts run "Name" -i input.txt
shortcuts run "Name" -i - < input.txt    # stdin
shortcuts run "Name" -o output.txt

# Sign for sharing
shortcuts sign -m anyone -i input.shortcut -o signed.shortcut

# View in app
shortcuts view "Name"
```

## Related Skills

- `/creating-mise-tasks` - Alternative automation approach
