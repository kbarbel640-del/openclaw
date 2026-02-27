# Plist Format Reference

Complete schema for `.shortcut` plist files.

## Root Keys

| Key                                    | Type    | Required | Description                      |
| -------------------------------------- | ------- | -------- | -------------------------------- |
| `WFWorkflowActions`                    | Array   | Yes      | Sequential action list           |
| `WFWorkflowClientVersion`              | String  | Yes      | App version (`2302` recommended) |
| `WFWorkflowMinimumClientVersion`       | Integer | No       | Min required version             |
| `WFWorkflowMinimumClientVersionString` | String  | No       | Min version as string            |
| `WFWorkflowIcon`                       | Dict    | Yes      | Icon appearance                  |
| `WFWorkflowTypes`                      | Array   | Yes      | Usage contexts                   |
| `WFWorkflowInputContentItemClasses`    | Array   | Yes      | Accepted input types             |
| `WFWorkflowImportQuestions`            | Array   | No       | Import-time prompts              |
| `WFWorkflowHasOutputFallback`          | Boolean | No       | Output fallback behavior         |
| `WFWorkflowNoInputBehavior`            | Dict    | No       | Behavior when no input           |

## WFWorkflowIcon

```xml
<key>WFWorkflowIcon</key>
<dict>
    <key>WFWorkflowIconStartColor</key>
    <integer>4282601983</integer>
    <key>WFWorkflowIconGlyphNumber</key>
    <integer>59771</integer>
</dict>
```

### Common Colors

| Color  | Integer Value |
| ------ | ------------- |
| Red    | 4282601983    |
| Orange | 4292093695    |
| Yellow | 4294967040    |
| Green  | 4292020479    |
| Blue   | 4280558623    |
| Purple | 4288230399    |
| Gray   | 4284769380    |

### Common Glyphs

| Icon       | Number |
| ---------- | ------ |
| Magic wand | 59771  |
| Gear       | 59574  |
| Document   | 61441  |
| Globe      | 59493  |
| Person     | 61730  |
| Clock      | 61444  |

## WFWorkflowTypes

```xml
<key>WFWorkflowTypes</key>
<array>
    <string>NCWidget</string>
    <string>WatchKit</string>
</array>
```

| Value             | Context           |
| ----------------- | ----------------- |
| `NCWidget`        | Today widget      |
| `WatchKit`        | Apple Watch       |
| `ActionExtension` | Share sheet       |
| (empty array)     | Standard shortcut |

## WFWorkflowInputContentItemClasses

```xml
<key>WFWorkflowInputContentItemClasses</key>
<array>
    <string>WFStringContentItem</string>
    <string>WFURLContentItem</string>
</array>
```

| Class                        | Content Type    |
| ---------------------------- | --------------- |
| `WFStringContentItem`        | Text            |
| `WFURLContentItem`           | URLs            |
| `WFImageContentItem`         | Images          |
| `WFPDFContentItem`           | PDFs            |
| `WFGenericFileContentItem`   | Files           |
| `WFContactContentItem`       | Contacts        |
| `WFDateContentItem`          | Dates           |
| `WFLocationContentItem`      | Locations       |
| `WFPhoneNumberContentItem`   | Phone numbers   |
| `WFEmailAddressContentItem`  | Email addresses |
| `WFRichTextContentItem`      | Rich text       |
| `WFSafariWebPageContentItem` | Safari pages    |
| `WFAppStoreAppContentItem`   | App Store apps  |
| `WFNumberContentItem`        | Numbers         |
| `WFBooleanContentItem`       | Booleans        |
| `WFDictionaryContentItem`    | Dictionaries    |

## Action Structure

```xml
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.gettext</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <!-- Action-specific parameters -->
    </dict>
    <key>UUID</key>
    <string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
    <key>CustomOutputName</key>
    <string>My Text</string>
</dict>
```

| Key                          | Required | Description                      |
| ---------------------------- | -------- | -------------------------------- |
| `WFWorkflowActionIdentifier` | Yes      | Action type                      |
| `WFWorkflowActionParameters` | Yes      | Parameters dict                  |
| `UUID`                       | No\*     | Required for variable references |
| `CustomOutputName`           | No       | Override output name             |

## WFSerializationType Values

| Type                              | Use Case                     |
| --------------------------------- | ---------------------------- |
| `WFTextTokenString`               | String with inline variables |
| `WFTextTokenAttachment`           | Direct variable reference    |
| `WFNumberSubstitutableState`      | Number accepting variables   |
| `WFDictionaryFieldValue`          | Dictionary parameter         |
| `WFContentPredicateTableTemplate` | Filter conditions            |

## Version Numbers

| Version | iOS/macOS             |
| ------- | --------------------- |
| ~700    | iOS 12                |
| ~900    | iOS 13                |
| ~1000   | iOS 14                |
| ~2000   | iOS 15                |
| ~2302   | iOS 16+ (recommended) |

## WFWorkflowNoInputBehavior

```xml
<key>WFWorkflowNoInputBehavior</key>
<dict>
    <key>Name</key>
    <string>WFWorkflowNoInputBehaviorAskForInput</string>
    <key>Parameters</key>
    <dict>
        <key>ItemClass</key>
        <string>WFStringContentItem</string>
    </dict>
</dict>
```

| Behavior                                | Description    |
| --------------------------------------- | -------------- |
| `WFWorkflowNoInputBehaviorAskForInput`  | Prompt user    |
| `WFWorkflowNoInputBehaviorGetClipboard` | Use clipboard  |
| `WFWorkflowNoInputBehaviorStop`         | Stop execution |

## WFWorkflowImportQuestions

```xml
<key>WFWorkflowImportQuestions</key>
<array>
    <dict>
        <key>ActionIndex</key>
        <integer>0</integer>
        <key>Category</key>
        <string>Parameter</string>
        <key>ParameterKey</key>
        <string>WFURLActionURL</string>
        <key>Text</key>
        <string>What URL should be used?</string>
    </dict>
</array>
```

Prompts user during import to customize values.
