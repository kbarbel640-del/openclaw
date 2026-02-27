# Control Flow Patterns

If/Else, Repeat, Menu structures. All share `GroupingIdentifier` UUID with `WFControlFlowMode`: 0=Start, 1=Middle, 2=End.

## If / Otherwise / End If

```xml
<!-- If (Mode 0) -->
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.conditional</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>GroupingIdentifier</key><string>GROUP-UUID</string>
        <key>WFControlFlowMode</key><integer>0</integer>
        <key>WFCondition</key><integer>4</integer>
        <key>WFInput</key>
        <dict>
            <key>Value</key>
            <dict>
                <key>OutputUUID</key><string>INPUT-UUID</string>
                <key>Type</key><string>ActionOutput</string>
            </dict>
            <key>WFSerializationType</key><string>WFTextTokenAttachment</string>
        </dict>
        <key>WFConditionalActionString</key><string>search term</string>
    </dict>
</dict>
<!-- Otherwise (Mode 1) - same GroupingIdentifier, WFControlFlowMode=1 -->
<!-- End If (Mode 2) - same GroupingIdentifier, WFControlFlowMode=2 -->
```

### WFCondition Values

| Value | Operator              | Value | Operator         |
| ----- | --------------------- | ----- | ---------------- |
| 0     | Equals                | 5     | Does Not Contain |
| 1     | Not Equals            | 6     | Begins With      |
| 2     | Greater Than          | 7     | Ends With        |
| 3     | Greater Than or Equal | 8     | Less Than        |
| 4     | Contains              | 99    | Has Any Value    |

For numbers use `WFNumberValue` instead of `WFConditionalActionString`.

## Repeat (Count)

```xml
<!-- Repeat Start (Mode 0) -->
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.repeat.count</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>GroupingIdentifier</key><string>REPEAT-UUID</string>
        <key>WFControlFlowMode</key><integer>0</integer>
        <key>WFRepeatCount</key><integer>5</integer>
    </dict>
    <key>UUID</key><string>LOOP-UUID</string>
</dict>
<!-- Loop body here -->
<!-- End Repeat (Mode 2) - same GroupingIdentifier -->
```

Loop variables: `Repeat Index` (1-based), `Repeat Results` (collected outputs).

## Repeat with Each

```xml
<!-- Repeat with Each (Mode 0) -->
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.repeat.each</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>GroupingIdentifier</key><string>EACH-UUID</string>
        <key>WFControlFlowMode</key><integer>0</integer>
        <key>WFInput</key>
        <dict>
            <key>Value</key>
            <dict>
                <key>OutputUUID</key><string>LIST-UUID</string>
                <key>Type</key><string>ActionOutput</string>
            </dict>
            <key>WFSerializationType</key><string>WFTextTokenAttachment</string>
        </dict>
    </dict>
    <key>UUID</key><string>LOOP-UUID</string>
</dict>
<!-- End (Mode 2) - same GroupingIdentifier -->
```

Loop variables: `Repeat Item`, `Repeat Index`, `Repeat Results`.

## Choose from Menu

```xml
<!-- Menu Start (Mode 0) -->
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.choosefrommenu</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>GroupingIdentifier</key><string>MENU-UUID</string>
        <key>WFControlFlowMode</key><integer>0</integer>
        <key>WFMenuPrompt</key><string>Choose an option</string>
        <key>WFMenuItems</key>
        <array><string>Option A</string><string>Option B</string></array>
    </dict>
</dict>
<!-- Case (Mode 1) - add WFMenuItemTitle for each option -->
<!-- End Menu (Mode 2) -->
```

## Nesting

Each nested block needs unique `GroupingIdentifier`:

```
If (GroupID: AAA) → Repeat (GroupID: BBB) → End Repeat (BBB) → End If (AAA)
```
