# Variable Reference System

How to reference action outputs and create variables.

## Variable Types

| Type             | Description                | Reference                   |
| ---------------- | -------------------------- | --------------------------- |
| `ActionOutput`   | Magic variable from action | `OutputUUID` + `OutputName` |
| `Variable`       | Named variable             | `VariableName`              |
| `ExtensionInput` | Shortcut input             | `Type: ExtensionInput`      |
| `Ask`            | Ask Each Time              | `Type: Ask`                 |
| `Clipboard`      | System clipboard           | `Type: Clipboard`           |
| `CurrentDate`    | Current date/time          | `Type: CurrentDate`         |
| `DeviceDetails`  | Device info                | `Type: DeviceDetails`       |

## Magic Variable (Direct Reference)

Use `WFTextTokenAttachment` for direct action output reference:

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

## Inline Variable (String with Embedded)

Use `WFTextTokenString` for text containing variables:

```xml
<key>WFTextActionText</key>
<dict>
    <key>Value</key>
    <dict>
        <key>string</key>
        <string>Hello ￼, welcome!</string>
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

### Position Format

`{position, length}` where:

- Position = character index (0-based)
- Length = always 1 for the placeholder

The `￼` character (U+FFFC Object Replacement Character) marks where variable goes.

## Named Variable Reference

```xml
<dict>
    <key>Type</key>
    <string>Variable</string>
    <key>VariableName</key>
    <string>myVariable</string>
</dict>
```

## Special Variable References

### Shortcut Input

```xml
<dict>
    <key>Type</key>
    <string>ExtensionInput</string>
</dict>
```

### Ask Each Time

```xml
<dict>
    <key>Type</key>
    <string>Ask</string>
</dict>
```

### Clipboard

```xml
<dict>
    <key>Type</key>
    <string>Clipboard</string>
</dict>
```

### Current Date

```xml
<dict>
    <key>Type</key>
    <string>CurrentDate</string>
</dict>
```

## Aggrandizements (Property Access)

Access properties of variables using `Aggrandizements` array:

### Get Property

```xml
<dict>
    <key>OutputName</key>
    <string>File</string>
    <key>OutputUUID</key>
    <string>UUID-HERE</string>
    <key>Type</key>
    <string>ActionOutput</string>
    <key>Aggrandizements</key>
    <array>
        <dict>
            <key>PropertyName</key>
            <string>WFItemName</string>
            <key>Type</key>
            <string>WFPropertyVariableAggrandizement</string>
        </dict>
    </array>
</dict>
```

### Common Properties

| PropertyName             | Gets          |
| ------------------------ | ------------- |
| `WFItemName`             | Name          |
| `WFFileSize`             | File size     |
| `WFFileExtension`        | Extension     |
| `WFFilePath`             | File path     |
| `WFFileCreationDate`     | Creation date |
| `WFFileModificationDate` | Modified date |

### Type Coercion

```xml
<dict>
    <key>Type</key>
    <string>WFCoercionVariableAggrandizement</string>
    <key>CoercionItemClass</key>
    <string>WFStringContentItem</string>
</dict>
```

| CoercionItemClass         | Converts To |
| ------------------------- | ----------- |
| `WFStringContentItem`     | Text        |
| `WFNumberContentItem`     | Number      |
| `WFURLContentItem`        | URL         |
| `WFDateContentItem`       | Date        |
| `WFDictionaryContentItem` | Dictionary  |

### Date Formatting

```xml
<dict>
    <key>Type</key>
    <string>WFDateFormatVariableAggrandizement</string>
    <key>WFDateFormat</key>
    <string>Custom</string>
    <key>WFDateFormatString</key>
    <string>yyyy-MM-dd</string>
</dict>
```

| WFDateFormat | Result                   |
| ------------ | ------------------------ |
| `Short`      | 1/1/24                   |
| `Medium`     | Jan 1, 2024              |
| `Long`       | January 1, 2024          |
| `Relative`   | Today, Yesterday         |
| `Custom`     | Use `WFDateFormatString` |

## Loop Variables

Inside Repeat blocks, these magic variables are available:

| Variable     | Type           | Description                     |
| ------------ | -------------- | ------------------------------- |
| Repeat Index | `ActionOutput` | Current iteration (1-based)     |
| Repeat Item  | `ActionOutput` | Current item (Repeat with Each) |

Reference using the Repeat action's `UUID` with appropriate `OutputName`.
