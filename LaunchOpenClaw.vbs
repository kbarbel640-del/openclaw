Option Explicit
On Error Resume Next

Dim WshShell, fso, currentDir, batPath, ret

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script sits
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' Build absolute path to the batch file
batPath = fso.BuildPath(currentDir, "LaunchOpenClaw.bat")

' Check if target exists
If Not fso.FileExists(batPath) Then
    MsgBox "Critical Error: Cannot find LaunchOpenClaw.bat at:" & vbCrLf & batPath, 16, "OpenClaw Launch Error"
    WScript.Quit 1
End If

' Run using cmd /c to ensure proper batch execution context
' 0 = SW_HIDE (Hidden window)
ret = WshShell.Run("cmd.exe /c """ & batPath & """", 0, False)

If Err.Number <> 0 Then
    MsgBox "Failed to execute launch command." & vbCrLf & "Error: " & Err.Description, 16, "OpenClaw Launch Error"
End If

Set WshShell = Nothing
