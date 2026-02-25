# Action Identifiers

Common WFAction identifiers organized by category.

## Text

| Action        | Identifier                            | Key Parameters                                         |
| ------------- | ------------------------------------- | ------------------------------------------------------ |
| Text          | `is.workflow.actions.gettext`         | `WFTextActionText`                                     |
| Show Result   | `is.workflow.actions.showresult`      | `Text`                                                 |
| Show Alert    | `is.workflow.actions.alert`           | `WFAlertActionMessage`, `WFAlertActionTitle`           |
| Ask for Input | `is.workflow.actions.ask`             | `WFAskActionPrompt`, `WFAskActionDefaultAnswer`        |
| Speak Text    | `is.workflow.actions.speaktext`       | `WFText`                                               |
| Get Name      | `is.workflow.actions.getitemname`     | `WFInput`                                              |
| Set Name      | `is.workflow.actions.setitemname`     | `WFInput`, `WFName`                                    |
| Replace Text  | `is.workflow.actions.text.replace`    | `WFInput`, `WFReplaceTextFind`, `WFReplaceTextReplace` |
| Match Text    | `is.workflow.actions.text.match`      | `WFInput`, `WFMatchTextPattern`                        |
| Split Text    | `is.workflow.actions.text.split`      | `text`, `WFTextSeparator`                              |
| Combine Text  | `is.workflow.actions.text.combine`    | `text`, `WFTextCombineString`                          |
| Change Case   | `is.workflow.actions.text.changecase` | `text`, `WFCaseType`                                   |
| Count         | `is.workflow.actions.count`           | `Input`, `WFCountType`                                 |

## Variables

| Action          | Identifier                           | Key Parameters              |
| --------------- | ------------------------------------ | --------------------------- |
| Set Variable    | `is.workflow.actions.setvariable`    | `WFVariableName`, `WFInput` |
| Get Variable    | `is.workflow.actions.getvariable`    | `WFVariable`                |
| Add to Variable | `is.workflow.actions.appendvariable` | `WFVariableName`, `WFInput` |
| Nothing         | `is.workflow.actions.nothing`        | —                           |
| Comment         | `is.workflow.actions.comment`        | `WFCommentActionText`       |

## Numbers & Math

| Action               | Identifier                          | Key Parameters                                   |
| -------------------- | ----------------------------------- | ------------------------------------------------ |
| Number               | `is.workflow.actions.number`        | `WFNumberActionNumber`                           |
| Calculate            | `is.workflow.actions.math`          | `WFInput`, `WFMathOperation`, `WFMathOperand`    |
| Round Number         | `is.workflow.actions.round`         | `WFInput`, `WFRoundMode`                         |
| Random Number        | `is.workflow.actions.number.random` | `WFRandomNumberMinimum`, `WFRandomNumberMaximum` |
| Format Number        | `is.workflow.actions.format.number` | `WFNumber`, `WFNumberFormatDecimalPlaces`        |
| Calculate Statistics | `is.workflow.actions.statistics`    | `WFInput`, `WFStatisticsOperation`               |

## Lists & Dictionaries

| Action               | Identifier                            | Key Parameters                                         |
| -------------------- | ------------------------------------- | ------------------------------------------------------ |
| List                 | `is.workflow.actions.list`            | `WFItems`                                              |
| Dictionary           | `is.workflow.actions.dictionary`      | `WFItems`                                              |
| Get Item from List   | `is.workflow.actions.getitemfromlist` | `WFInput`, `WFItemSpecifier`, `WFItemIndex`            |
| Get Dictionary Value | `is.workflow.actions.getvalueforkey`  | `WFInput`, `WFDictionaryKey`                           |
| Set Dictionary Value | `is.workflow.actions.setvalueforkey`  | `WFDictionary`, `WFDictionaryKey`, `WFDictionaryValue` |
| Filter Files         | `is.workflow.actions.filter.files`    | `WFInput`, `WFContentItemFilter`                       |
| Choose from List     | `is.workflow.actions.choosefromlist`  | `WFInput`, `WFChooseFromListActionPrompt`              |

## Web & URL

| Action               | Identifier                               | Key Parameters                                                                    |
| -------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| URL                  | `is.workflow.actions.url`                | `WFURLActionURL`                                                                  |
| Get Contents of URL  | `is.workflow.actions.downloadurl`        | `WFInput`, `WFHTTPMethod`, `WFHTTPHeaders`, `WFHTTPBodyType`, `WFRequestVariable` |
| Open URL             | `is.workflow.actions.openurl`            | `WFInput`                                                                         |
| Get URLs from Input  | `is.workflow.actions.detect.link`        | `WFInput`                                                                         |
| Expand URL           | `is.workflow.actions.url.expand`         | `WFInput`                                                                         |
| URL Encode           | `is.workflow.actions.urlencode`          | `WFInput`, `WFEncodeMode`                                                         |
| Get Webpage Contents | `is.workflow.actions.getwebpagecontents` | `WFInput`                                                                         |

## Files

| Action         | Identifier                                | Key Parameters                     |
| -------------- | ----------------------------------------- | ---------------------------------- |
| Get File       | `is.workflow.actions.documentpicker.open` | `WFFile`                           |
| Save File      | `is.workflow.actions.documentpicker.save` | `WFInput`, `WFFileDestinationPath` |
| Delete Files   | `is.workflow.actions.file.delete`         | `WFInput`                          |
| Create Folder  | `is.workflow.actions.file.createfolder`   | `WFFilePath`                       |
| Get File Path  | `is.workflow.actions.getfilepath`         | `WFInput`                          |
| Rename File    | `is.workflow.actions.file.rename`         | `WFInput`, `WFNewFilename`         |
| Append to File | `is.workflow.actions.file.append`         | `WFInput`, `WFFilePath`            |

## Scripting

| Action                    | Identifier                                   | Key Parameters                        |
| ------------------------- | -------------------------------------------- | ------------------------------------- |
| Run Shell Script          | `is.workflow.actions.runshellscript`         | `WFShellScript`, `WFShellScriptShell` |
| Run JavaScript on Webpage | `is.workflow.actions.runjavascriptonwebpage` | `WFJavaScript`                        |
| Base64 Encode             | `is.workflow.actions.base64encode`           | `WFInput`, `WFEncodeMode`             |
| Generate Hash             | `is.workflow.actions.hash`                   | `WFInput`, `WFHashType`               |
| Get Dictionary from Input | `is.workflow.actions.detect.dictionary`      | `WFInput`                             |
| Stop Shortcut             | `is.workflow.actions.exit`                   | `WFResult`                            |
| Run Shortcut              | `is.workflow.actions.runworkflow`            | `WFWorkflowName`, `WFInput`           |
| Wait                      | `is.workflow.actions.delay`                  | `WFDelayTime`                         |

## Control Flow

| Action           | Identifier                           | Key Parameters                                                           |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| If               | `is.workflow.actions.conditional`    | `WFCondition`, `WFInput`, `GroupingIdentifier`, `WFControlFlowMode`      |
| Repeat           | `is.workflow.actions.repeat.count`   | `WFRepeatCount`, `GroupingIdentifier`, `WFControlFlowMode`               |
| Repeat with Each | `is.workflow.actions.repeat.each`    | `WFInput`, `GroupingIdentifier`, `WFControlFlowMode`                     |
| Choose from Menu | `is.workflow.actions.choosefrommenu` | `WFMenuItems`, `WFMenuPrompt`, `GroupingIdentifier`, `WFControlFlowMode` |

## Dates & Time

| Action                 | Identifier                                | Key Parameters                                      |
| ---------------------- | ----------------------------------------- | --------------------------------------------------- |
| Date                   | `is.workflow.actions.date`                | `WFDateActionMode`, `WFDateActionDate`              |
| Format Date            | `is.workflow.actions.format.date`         | `WFDate`, `WFDateFormat`                            |
| Adjust Date            | `is.workflow.actions.adjustdate`          | `WFDate`, `WFAdjustOperation`, `WFDuration`         |
| Get Time Between Dates | `is.workflow.actions.gettimebetweendates` | `WFInput`, `WFTimeUntilFromDate`, `WFTimeUntilUnit` |

## Notifications

| Action            | Identifier                         | Key Parameters                                          |
| ----------------- | ---------------------------------- | ------------------------------------------------------- |
| Show Notification | `is.workflow.actions.notification` | `WFNotificationActionTitle`, `WFNotificationActionBody` |
| Vibrate Device    | `is.workflow.actions.vibrate`      | —                                                       |
| Play Sound        | `is.workflow.actions.playsound`    | `WFSoundName`                                           |

## Device

| Action             | Identifier                             | Key Parameters   |
| ------------------ | -------------------------------------- | ---------------- |
| Get Battery Level  | `is.workflow.actions.getbatterylevel`  | —                |
| Set Brightness     | `is.workflow.actions.setbrightness`    | `WFBrightness`   |
| Set Volume         | `is.workflow.actions.setvolume`        | `WFVolume`       |
| Get Device Details | `is.workflow.actions.getdevicedetails` | `WFDeviceDetail` |
| Set Airplane Mode  | `is.workflow.actions.airplanemode.set` | `OnValue`        |
| Set Wi-Fi          | `is.workflow.actions.wifi.set`         | `OnValue`        |
| Set Bluetooth      | `is.workflow.actions.bluetooth.set`    | `OnValue`        |

## Clipboard

| Action            | Identifier                         | Key Parameters |
| ----------------- | ---------------------------------- | -------------- |
| Copy to Clipboard | `is.workflow.actions.setclipboard` | `WFInput`      |
| Get Clipboard     | `is.workflow.actions.getclipboard` | —              |

## Apps

| Action            | Identifier                        | Key Parameters                   |
| ----------------- | --------------------------------- | -------------------------------- |
| Open App          | `is.workflow.actions.openapp`     | `WFAppIdentifier`                |
| Hide App          | `is.workflow.actions.hide.app`    | `WFApp`                          |
| Split Screen Apps | `is.workflow.actions.splitscreen` | `WFPrimaryApp`, `WFSecondaryApp` |

## HTTP Methods

For `is.workflow.actions.downloadurl`:

| Method | `WFHTTPMethod` Value |
| ------ | -------------------- |
| GET    | `GET`                |
| POST   | `POST`               |
| PUT    | `PUT`                |
| PATCH  | `PATCH`              |
| DELETE | `DELETE`             |

### HTTP Body Types

| Type | `WFHTTPBodyType` Value |
| ---- | ---------------------- |
| JSON | `JSON`                 |
| Form | `Form`                 |
| File | `File`                 |

## WFItemSpecifier Values

For `is.workflow.actions.getitemfromlist`:

| Value            | Gets                                              |
| ---------------- | ------------------------------------------------- |
| `First Item`     | First element                                     |
| `Last Item`      | Last element                                      |
| `Random Item`    | Random element                                    |
| `Item At Index`  | Element at `WFItemIndex`                          |
| `Items in Range` | Range from `WFItemRangeStart` to `WFItemRangeEnd` |
